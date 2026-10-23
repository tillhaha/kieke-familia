// src/lib/mcp/server.ts
// Stateless MCP server (Streamable HTTP transport, JSON responses only) for
// Familia. Clients authenticate with a personal API token created under
// Settings → Integrations, either as `Authorization: Bearer fam_…`
// (/api/mcp, Claude Code) or in the URL (/api/mcp/fam_…, claude.ai connectors,
// which can't send custom headers). Tools are grouped per feature in ./tools.
import { NextResponse } from "next/server"
import { type McpTool, type ToolResult, text } from "./types"
import { shoppingTools } from "./tools/shopping"

const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]

const TOOLS: McpTool[] = [...shoppingTools]

type JsonRpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> }

async function callTool(familyId: string, params: Record<string, unknown> | undefined): Promise<ToolResult> {
  const name = params?.name
  const tool = TOOLS.find((t) => t.name === name)
  if (!tool) return text(`Unknown tool: ${String(name)}`, true)
  try {
    return await tool.handler(familyId, params?.arguments ?? {})
  } catch (err) {
    console.error(`[mcp] ${tool.name} failed:`, err)
    return text("Something went wrong. Please try again.", true)
  }
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
        serverInfo: { name: "familia", version: "1.0.0" },
        instructions: "Access the family's Familia data. Currently: the shopping list (add, list and remove items).",
      })
    }
    case "ping":
      return reply({})
    case "tools/list":
      return reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) })
    case "tools/call":
      return reply(await callTool(familyId, msg.params))
    default:
      return fail(-32601, `Method not found: ${msg.method}`)
  }
}

export async function handleMcpRequest(
  request: Request,
  auth: { userId: string; familyId: string } | null
): Promise<Response> {
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
export function methodNotAllowed(): Response {
  return new Response(null, { status: 405, headers: { Allow: "POST" } })
}
