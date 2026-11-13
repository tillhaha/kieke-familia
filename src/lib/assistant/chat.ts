// src/lib/assistant/chat.ts
// The assistant's tool-calling loop. It runs as the signed-in user: family data plus only
// their own private todos/profile/Google calendars (the tools are scoped that way).
//
// Tools marked `confirm` (heating changes, deletions) are not run right away: the loop stops
// and the browser shows Confirm / Cancel. The next request carries the answer in `approvals`.
import { prisma } from "@/lib/prisma"
import { buildLifeContext } from "@/lib/personalProfile"
import { DEFAULT_TIME_ZONE, localClock, weekday } from "@/lib/localDate"
import { TOOLS } from "@/lib/mcp/tools"
import type { McpAuth } from "@/lib/mcp/types"
import { streamChat } from "./openrouter"
import { type ChatMessage, DECLINED_RESULT, type ToolCall, parseArgs, pendingCalls } from "./messages"

/** What the browser receives, one JSON object per line */
export type AssistantEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; ok: boolean }
  | { type: "confirm"; calls: { id: string; name: string; args: Record<string, unknown> }[] }
  | { type: "messages"; messages: ChatMessage[] }
  | { type: "error"; code: string; message: string }

export type Approval = { id: string; approved: boolean }

const MAX_ROUNDS = 8
const MAX_HISTORY = 40
const MAX_TOOL_RESULT = 15_000

const toolDefs = TOOLS.map((t) => ({
  type: "function" as const,
  function: { name: t.name, description: t.description, parameters: t.inputSchema },
}))

async function runTool(auth: McpAuth, call: ToolCall): Promise<{ content: string; ok: boolean }> {
  const tool = TOOLS.find((t) => t.name === call.function.name)
  if (!tool) return { content: `Unknown tool: ${call.function.name}`, ok: false }
  try {
    const result = await tool.handler(auth, parseArgs(call))
    const content = result.content.map((c) => c.text).join("\n")
    return {
      content: content.length > MAX_TOOL_RESULT ? `${content.slice(0, MAX_TOOL_RESULT)}\n… (truncated)` : content,
      ok: !result.isError,
    }
  } catch (err) {
    console.error(`[assistant] ${call.function.name} failed:`, err)
    return { content: "The tool failed. Tell the user it didn't work and suggest trying again.", ok: false }
  }
}

async function systemPrompt(auth: McpAuth): Promise<string> {
  const [user, members, lifeContext] = await Promise.all([
    prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } }),
    prisma.user.findMany({ where: { familyId: auth.familyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    buildLifeContext(auth.userId).catch(() => ""),
  ])
  const { date, minutes } = localClock()
  const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
  const name = user?.name ?? "the user"
  return `You are the assistant inside "Kieke", ${name}'s family app (week planner with meals and work locations, recipes, shopping list, family tasks, calendar, heating, private todos). You help ${name} find information and get organised.

Today is ${weekday(date)}, ${date}, ${time} (${DEFAULT_TIME_ZONE}). Weeks in the planner run Sunday to Saturday. Resolve "tomorrow", "next Monday" etc. from today.
Family members (ids for tools): ${members.map((m) => `${m.name ?? "?"} (${m.id})`).join(", ")}.

How to work:
- Answer in the language the user writes in. Be brief and warm; prefer short lists. Markdown is fine.
- Look things up with the tools instead of guessing, and never invent data. Combine sources when useful (e.g. calendar + week plan + tasks for "what's on this week?").
- Make everyday changes directly when asked (shopping list, family tasks, private todos, week planner meals and notes, work locations), then say in one line what you changed.
- Heating changes and deletions need the user's OK: just call the tool — the app shows ${name} Confirm/Cancel buttons. Don't ask for permission in text first. If an action was declined, don't retry it.
- Private todos and the "About me" profile belong to ${name} only. Family tasks, week plan and shopping list are shared with the family.
- If something can't be done with the tools, say so plainly.${lifeContext ? `\n\nAbout ${name} (private context):\n${lifeContext}` : ""}`
}

/** Keep the request small: the last messages, starting at a user message (never mid tool exchange). */
function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_HISTORY) return messages
  const start = messages.findIndex((m, i) => i >= messages.length - MAX_HISTORY && m.role === "user")
  return start >= 0 ? messages.slice(start) : messages.slice(-1)
}

export async function runAssistant(opts: {
  auth: McpAuth
  messages: ChatMessage[]
  approvals: Approval[]
  emit: (e: AssistantEvent) => void
  signal?: AbortSignal
}): Promise<void> {
  const { auth, emit } = opts
  const history = [...opts.messages]
  const added: ChatMessage[] = []
  const push = (m: ChatMessage) => {
    history.push(m)
    added.push(m)
  }
  const awaitingConfirm = new Set<string>()

  try {
    // Answers to a previous Confirm / Cancel
    for (const call of pendingCalls(history)) {
      const approval = opts.approvals.find((a) => a.id === call.id)
      if (approval?.approved) {
        const r = await runTool(auth, call)
        emit({ type: "tool", name: call.function.name, ok: r.ok })
        push({ role: "tool", tool_call_id: call.id, content: r.content })
      } else {
        push({ role: "tool", tool_call_id: call.id, content: DECLINED_RESULT })
      }
    }

    const system = await systemPrompt(auth)
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const { content, toolCalls } = await streamChat({
        system,
        messages: trimHistory(history),
        tools: toolDefs,
        onText: (delta) => emit({ type: "text", delta }),
        signal: opts.signal,
      })
      push({ role: "assistant", content: content || null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) })
      if (!toolCalls.length) break

      const toConfirm: ToolCall[] = []
      for (const call of toolCalls) {
        if (TOOLS.find((t) => t.name === call.function.name)?.confirm) {
          toConfirm.push(call)
          continue
        }
        const r = await runTool(auth, call)
        emit({ type: "tool", name: call.function.name, ok: r.ok })
        push({ role: "tool", tool_call_id: call.id, content: r.content })
      }
      if (toConfirm.length) {
        toConfirm.forEach((c) => awaitingConfirm.add(c.id))
        emit({ type: "confirm", calls: toConfirm.map((c) => ({ id: c.id, name: c.function.name, args: parseArgs(c) })) })
        break
      }
      if (round === MAX_ROUNDS - 1) {
        emit({ type: "text", delta: "\n\n…" })
      }
    }
  } finally {
    // Whatever happened so far is part of the conversation (also after an error or abort).
    // Calls that were cut off get a result, so only real confirmations stay pending.
    for (const call of pendingCalls(history)) {
      if (!awaitingConfirm.has(call.id)) push({ role: "tool", tool_call_id: call.id, content: "Not run (interrupted)." })
    }
    emit({ type: "messages", messages: added })
  }
}
