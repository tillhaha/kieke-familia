// src/app/api/mcp/route.ts
// Stateless MCP server (Streamable HTTP transport, JSON responses only) for
// the family shopping list. Clients authenticate with a personal API token
// created under Settings → Shopping: `Authorization: Bearer fam_…`.
import { prisma } from "@/lib/prisma"
import { authenticateBearer } from "@/lib/apiTokens"
import { categorizeShoppingItems } from "@/lib/shoppingCategorize"
import { NextResponse } from "next/server"
import { z } from "zod"

const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]

type JsonRpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> }
type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean }

const TOOLS = [
  {
    name: "add_shopping_items",
    description:
      "Add one or more items to the family shopping list. Items are sorted into the family's shopping categories automatically. Items already on the list are skipped.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Item name without quantity, e.g. \"milk\" or \"Zitrone\"" },
              quantity: { type: "string", description: "Optional amount, e.g. \"2\", \"500 g\", \"1 bunch\"" },
            },
            required: ["name"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "list_shopping_items",
    description: "List everything currently on the family shopping list, grouped by category.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "remove_shopping_items",
    description: "Remove items from the family shopping list by name (case-insensitive exact match), e.g. after buying them.",
    inputSchema: {
      type: "object",
      properties: {
        names: { type: "array", minItems: 1, items: { type: "string" } },
      },
      required: ["names"],
    },
  },
]

const AddArgs = z.object({
  items: z.array(z.object({ name: z.string().trim().min(1), quantity: z.string().trim().optional() })).min(1),
})
const RemoveArgs = z.object({ names: z.array(z.string().trim().min(1)).min(1) })

function text(t: string, isError = false): ToolResult {
  return { content: [{ type: "text", text: t }], ...(isError ? { isError } : {}) }
}

async function addItems(familyId: string, args: unknown): Promise<ToolResult> {
  const parsed = AddArgs.safeParse(args)
  if (!parsed.success) return text(`Invalid arguments: ${parsed.error.message}`, true)

  const existing = await prisma.shoppingItem.findMany({ where: { familyId }, select: { name: true } })
  const seen = new Set(existing.map((i) => i.name.toLowerCase()))
  const skipped: string[] = []
  const toAdd: Array<{ name: string; quantity: string | null }> = []
  for (const item of parsed.data.items) {
    const key = item.name.toLowerCase()
    if (seen.has(key)) {
      skipped.push(item.name)
      continue
    }
    seen.add(key)
    toAdd.push({ name: item.name, quantity: item.quantity || null })
  }

  if (toAdd.length > 0) {
    const categoryMap = await categorizeShoppingItems(familyId, toAdd.map((i) => i.name))
    await prisma.$transaction(async (tx) => {
      const maxSortOrder = await tx.shoppingItem.aggregate({ where: { familyId }, _max: { sortOrder: true } })
      const baseOrder = (maxSortOrder._max.sortOrder ?? -1) + 1
      await tx.shoppingItem.createMany({
        data: toAdd.map((item, index) => ({
          familyId,
          name: item.name,
          quantity: item.quantity,
          categoryId: categoryMap.get(item.name.toLowerCase()) ?? null,
          sortOrder: baseOrder + index,
        })),
      })
    })

    const categories = await prisma.shoppingCategory.findMany({ where: { familyId } })
    const categoryName = new Map(categories.map((c) => [c.id, c.name]))
    const lines = toAdd.map((i) => {
      const catId = categoryMap.get(i.name.toLowerCase())
      const qty = i.quantity ? ` (${i.quantity})` : ""
      return `- ${i.name}${qty} → ${(catId && categoryName.get(catId)) ?? "Other"}`
    })
    const summary = `Added ${toAdd.length} item(s):\n${lines.join("\n")}`
    return text(skipped.length ? `${summary}\nAlready on the list: ${skipped.join(", ")}` : summary)
  }

  return text(`Nothing added — already on the list: ${skipped.join(", ")}`)
}

async function listItems(familyId: string): Promise<ToolResult> {
  const items = await prisma.shoppingItem.findMany({
    where: { familyId },
    include: { category: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })
  if (items.length === 0) return text("The shopping list is empty.")

  const groups = new Map<string, { order: number; lines: string[] }>()
  for (const item of items) {
    const name = item.category?.name ?? "Other"
    if (!groups.has(name)) groups.set(name, { order: item.category?.order ?? Number.MAX_SAFE_INTEGER, lines: [] })
    groups.get(name)!.lines.push(`- ${item.name}${item.quantity ? ` (${item.quantity})` : ""}`)
  }
  const sections = [...groups.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([name, g]) => `${name}:\n${g.lines.join("\n")}`)
  return text(sections.join("\n\n"))
}

async function removeItems(familyId: string, args: unknown): Promise<ToolResult> {
  const parsed = RemoveArgs.safeParse(args)
  if (!parsed.success) return text(`Invalid arguments: ${parsed.error.message}`, true)

  const items = await prisma.shoppingItem.findMany({ where: { familyId }, select: { id: true, name: true } })
  const wanted = new Set(parsed.data.names.map((n) => n.toLowerCase()))
  const matches = items.filter((i) => wanted.has(i.name.toLowerCase()))
  if (matches.length > 0) {
    await prisma.shoppingItem.deleteMany({ where: { familyId, id: { in: matches.map((m) => m.id) } } })
  }
  const found = new Set(matches.map((m) => m.name.toLowerCase()))
  const missing = parsed.data.names.filter((n) => !found.has(n.toLowerCase()))
  const summary = matches.length ? `Removed: ${matches.map((m) => m.name).join(", ")}` : "Nothing removed."
  return text(missing.length ? `${summary}\nNot on the list: ${missing.join(", ")}` : summary)
}

async function callTool(familyId: string, params: Record<string, unknown> | undefined): Promise<ToolResult> {
  const name = params?.name
  const args = params?.arguments ?? {}
  try {
    if (name === "add_shopping_items") return await addItems(familyId, args)
    if (name === "list_shopping_items") return await listItems(familyId)
    if (name === "remove_shopping_items") return await removeItems(familyId, args)
  } catch (err) {
    console.error(`[mcp] ${String(name)} failed:`, err)
    return text("The shopping list could not be updated. Please try again.", true)
  }
  return text(`Unknown tool: ${String(name)}`, true)
}

async function handleMessage(familyId: string, msg: JsonRpcRequest): Promise<object | null> {
  // Notifications (no id) get no response
  if (msg.id === undefined || msg.id === null) return null
  const reply = (result: object) => ({ jsonrpc: "2.0", id: msg.id, result })
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id, error: { code, message } })

  switch (msg.method) {
    case "initialize": {
      const requested = msg.params?.protocolVersion
      const protocolVersion =
        typeof requested === "string" && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : SUPPORTED_PROTOCOL_VERSIONS[0]
      return reply({
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: "familia-shopping", version: "1.0.0" },
        instructions: "Manage the Familia family shopping list: add, list and remove items.",
      })
    }
    case "ping":
      return reply({})
    case "tools/list":
      return reply({ tools: TOOLS })
    case "tools/call":
      return reply(await callTool(familyId, msg.params))
    default:
      return fail(-32601, `Method not found: ${msg.method}`)
  }
}

export async function POST(request: Request) {
  const auth = await authenticateBearer(request)
  if (!auth) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Invalid or missing API token" } },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="familia"' } }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 })
  }

  const messages = (Array.isArray(body) ? body : [body]) as JsonRpcRequest[]
  if (messages.some((m) => !m || typeof m !== "object" || typeof m.method !== "string")) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request" } }, { status: 400 })
  }

  const responses = (await Promise.all(messages.map((m) => handleMessage(auth.familyId, m)))).filter((r) => r !== null)
  if (responses.length === 0) return new Response(null, { status: 202 })
  return NextResponse.json(Array.isArray(body) ? responses : responses[0])
}

// No server-initiated stream and no sessions in this stateless server
export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } })
}

export async function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } })
}
