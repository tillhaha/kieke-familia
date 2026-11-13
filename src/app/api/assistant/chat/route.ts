// src/app/api/assistant/chat/route.ts
// POST { messages, approvals? } — runs one assistant turn and streams NDJSON events
// (see AssistantEvent in src/lib/assistant/chat.ts). The browser keeps the conversation.
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { type AssistantEvent, runAssistant } from "@/lib/assistant/chat"
import { OpenRouterError, assistantConfig } from "@/lib/assistant/openrouter"
import { ChatMessage } from "@/lib/assistant/messages"

const Body = z.object({
  messages: z.array(ChatMessage).min(1).max(400),
  approvals: z.array(z.object({ id: z.string().min(1), approved: z.boolean() })).max(20).optional(),
})

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  const familyId = session?.user?.familyId
  if (!userId || !familyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!assistantConfig().apiKey) return NextResponse.json({ error: "Assistant is not configured", code: "NOT_CONFIGURED" }, { status: 503 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const detail = `Invalid request: ${issue?.path.join(".") || "body"} — ${issue?.message ?? "?"}`
    console.error("[assistant]", detail)
    return NextResponse.json({ error: detail, code: "INVALID_REQUEST" }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AssistantEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"))
        } catch {
          // client went away
        }
      }
      try {
        await runAssistant({
          auth: { userId, familyId },
          messages: parsed.data.messages,
          approvals: parsed.data.approvals ?? [],
          emit,
          signal: request.signal,
        })
      } catch (err) {
        if (!request.signal.aborted) {
          console.error("[assistant] turn failed:", err)
          const code = err instanceof OpenRouterError ? err.code : "UNKNOWN"
          emit({ type: "error", code, message: err instanceof Error ? err.message : String(err) })
        }
      } finally {
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
    },
  })
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  })
}
