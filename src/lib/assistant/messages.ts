// src/lib/assistant/messages.ts
// Conversation format shared by server and browser (OpenAI chat format). No server imports here.
import { z } from "zod"

export const ToolCall = z.object({
  id: z.string().min(1).max(200),
  type: z.literal("function"),
  function: z.object({ name: z.string().min(1).max(100), arguments: z.string().max(20_000) }),
})
export type ToolCall = z.infer<typeof ToolCall>

export const ChatMessage = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), content: z.string().min(1).max(20_000) }),
  z.object({ role: z.literal("assistant"), content: z.string().max(50_000).nullable(), tool_calls: z.array(ToolCall).max(20).optional() }),
  z.object({ role: z.literal("tool"), tool_call_id: z.string().min(1).max(200), content: z.string().max(50_000) }),
])
export type ChatMessage = z.infer<typeof ChatMessage>

export function parseArgs(call: ToolCall): Record<string, unknown> {
  try {
    const v = JSON.parse(call.function.arguments || "{}")
    return v && typeof v === "object" && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

/** Tool calls of the last assistant message that have no result yet (awaiting confirmation) */
export function pendingCalls(messages: ChatMessage[]): ToolCall[] {
  let idx = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      idx = i
      break
    }
  }
  const msg = messages[idx]
  if (!msg || msg.role !== "assistant" || !msg.tool_calls?.length) return []
  const answered = new Set(messages.slice(idx + 1).flatMap((m) => (m.role === "tool" ? [m.tool_call_id] : [])))
  return msg.tool_calls.filter((c) => !answered.has(c.id))
}

export const DECLINED_RESULT = "The user declined this action. Do not retry it unless they ask again."
