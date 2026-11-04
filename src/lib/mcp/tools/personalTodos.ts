// src/lib/mcp/tools/personalTodos.ts
// MCP tools for the token owner's private todo list ("Gedanken"). Scoped by
// userId — other family members' items are never reachable.
import { prisma } from "@/lib/prisma"
import { captureThoughts } from "@/lib/personalTodos"
import { buildLifeContext } from "@/lib/personalProfile"
import { z } from "zod"
import { type McpTool, type ToolResult, text } from "../types"

const CaptureArgs = z.object({ text: z.string().trim().min(1).max(5000) })
const ListArgs = z.object({ category: z.string().trim().optional() })
const CompleteArgs = z.object({ ids: z.array(z.string().trim().min(1)).min(1) })

function formatTodo(t: { id: string; title: string; note: string | null; dueDate: Date | null }): string {
  const due = t.dueDate ? ` (due ${t.dueDate.toISOString().slice(0, 10)})` : ""
  const note = t.note ? ` — ${t.note}` : ""
  return `- ${t.title}${due}${note} [id: ${t.id}]`
}

async function capture(userId: string, args: unknown): Promise<ToolResult> {
  const parsed = CaptureArgs.safeParse(args)
  if (!parsed.success) return text(`Invalid arguments: ${parsed.error.message}`, true)
  const todos = await captureThoughts(userId, parsed.data.text)
  const lines = todos.map((t) => `${formatTodo(t)} → ${t.category}`)
  return text(`Saved ${todos.length} item(s) to the private todo list:\n${lines.join("\n")}`)
}

async function list(userId: string, args: unknown): Promise<ToolResult> {
  const parsed = ListArgs.safeParse(args)
  if (!parsed.success) return text(`Invalid arguments: ${parsed.error.message}`, true)
  const category = parsed.data.category
  const todos = await prisma.personalTodo.findMany({
    where: { userId, done: false, ...(category ? { category: { equals: category, mode: "insensitive" } } : {}) },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  })
  if (todos.length === 0) return text(category ? `No open items in "${category}".` : "The private todo list is empty.")

  const groups = new Map<string, string[]>()
  for (const t of todos) {
    if (!groups.has(t.category)) groups.set(t.category, [])
    groups.get(t.category)!.push(formatTodo(t))
  }
  return text([...groups.entries()].map(([name, lines]) => `${name}:\n${lines.join("\n")}`).join("\n\n"))
}

async function complete(userId: string, args: unknown): Promise<ToolResult> {
  const parsed = CompleteArgs.safeParse(args)
  if (!parsed.success) return text(`Invalid arguments: ${parsed.error.message}`, true)
  const todos = await prisma.personalTodo.findMany({
    where: { userId, id: { in: parsed.data.ids } },
    select: { id: true, title: true },
  })
  if (todos.length > 0) {
    await prisma.personalTodo.updateMany({
      where: { userId, id: { in: todos.map((t) => t.id) } },
      data: { done: true, doneAt: new Date() },
    })
  }
  const found = new Set(todos.map((t) => t.id))
  const missing = parsed.data.ids.filter((id) => !found.has(id))
  const summary = todos.length ? `Marked done: ${todos.map((t) => t.title).join(", ")}` : "Nothing marked done."
  return text(missing.length ? `${summary}\nUnknown ids: ${missing.join(", ")}` : summary)
}

async function profile(userId: string): Promise<ToolResult> {
  const context = await buildLifeContext(userId)
  const today = new Date().toISOString().slice(0, 10)
  return text(context ? `Today is ${today}.\n\n${context}` : "No profile information yet. The user can write an \"About me\" on the Thoughts page in Familia.")
}

export const personalTodoTools: McpTool[] = [
  {
    name: "get_personal_profile",
    description:
      "Get private context about the user's life: their own \"About me\" text (who they are, hobbies, friends and family, routines) plus what the family app knows (name, family members, city, birthdays with ages). Read this before helping with personal tasks, planning, gifts or messages so you understand who and what they mean.",
    inputSchema: { type: "object", properties: {} },
    handler: (auth) => profile(auth.userId),
  },
  {
    name: "capture_thoughts",
    description:
      "Save the user's thoughts, todos, ideas or reminders to their PRIVATE todo list (only they can see it, not the family). Pass the raw text as the user said it — it is split into separate items, categorised and given due dates automatically.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The user's thoughts/todos, verbatim. May contain several items." },
      },
      required: ["text"],
    },
    handler: (auth, args) => capture(auth.userId, args),
  },
  {
    name: "list_personal_todos",
    description: "List the open items on the user's private todo list, grouped by category, with their ids.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Optional: only this category (case-insensitive)" },
      },
    },
    handler: (auth, args) => list(auth.userId, args),
  },
  {
    name: "complete_personal_todos",
    description: "Mark items on the user's private todo list as done, by id (ids come from list_personal_todos).",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", minItems: 1, items: { type: "string" } },
      },
      required: ["ids"],
    },
    handler: (auth, args) => complete(auth.userId, args),
  },
]
