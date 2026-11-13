// src/app/api/assistant/transcribe/route.ts
// POST { audio: base64 WAV } — spoken message → text via OPENROUTER_AUDIO_MODEL.
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { OpenRouterError, transcribe } from "@/lib/assistant/openrouter"

// ~2.5 minutes of 16 kHz mono 16-bit WAV, base64-encoded
const MAX_BASE64 = 8 * 1024 * 1024

const Body = z.object({
  audio: z.string().min(100).max(MAX_BASE64).regex(/^[A-Za-z0-9+/]+=*$/),
  format: z.enum(["wav", "mp3"]).default("wav"),
})

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.familyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid audio" }, { status: 400 })
  try {
    const text = await transcribe(parsed.data.audio, parsed.data.format, request.signal)
    return NextResponse.json({ text })
  } catch (err) {
    console.error("[assistant] transcribe", err)
    const code = err instanceof OpenRouterError ? err.code : "UNKNOWN"
    return NextResponse.json({ error: "Transcription failed", code }, { status: code === "NOT_CONFIGURED" ? 503 : 502 })
  }
}
