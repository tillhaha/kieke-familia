// src/app/api/personal-profile/route.ts
// The signed-in user's private "About me" profile. Scoped by userId only —
// never readable by other family members.
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { MAX_PROFILE_LENGTH, getProfileText, saveProfileText } from "@/lib/personalProfile"

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    return NextResponse.json({ text: await getProfileText(userId) })
  } catch (err) {
    console.error("[GET /api/personal-profile]", err)
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 })
  }
}

// Body: { text } — replaces the whole profile (empty string clears it).
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { text } = (body ?? {}) as Record<string, unknown>
  if (typeof text !== "string") return NextResponse.json({ error: "text required" }, { status: 400 })
  if (text.length > MAX_PROFILE_LENGTH) return NextResponse.json({ error: "Text too long" }, { status: 400 })

  try {
    const profile = await saveProfileText(userId, text.trim())
    return NextResponse.json(profile)
  } catch (err) {
    console.error("[PUT /api/personal-profile]", err)
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 })
  }
}
