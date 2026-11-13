// src/app/api/assistant/route.ts
// GET — whether the assistant is set up and whether spoken messages go to an audio model.
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { assistantConfig } from "@/lib/assistant/openrouter"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.familyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const cfg = assistantConfig()
  return NextResponse.json({ enabled: !!cfg.apiKey, voice: !!(cfg.apiKey && cfg.audioModel) })
}
