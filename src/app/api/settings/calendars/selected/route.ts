// src/app/api/settings/calendars/selected/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = (session.user as any).id

  try {
    const syncs = await prisma.calendarSync.findMany({
      where: { userId },
      select: { calendarId: true, name: true, color: true },
    })
    return NextResponse.json(syncs)
  } catch {
    return NextResponse.json({ error: "Failed to load saved calendars" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = (session.user as any).id

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (body.length > 50) {
    return NextResponse.json({ error: "Too many calendars (max 50)" }, { status: 400 })
  }

  for (const item of body) {
    if (!item.calendarId || typeof item.calendarId !== "string") {
      return NextResponse.json({ error: "Each calendar must have a calendarId" }, { status: 400 })
    }
    if (!item.name || typeof item.name !== "string") {
      return NextResponse.json({ error: "Each calendar must have a name" }, { status: 400 })
    }
  }

  // Deduplicate by calendarId, keeping first occurrence
  const seen = new Set<string>()
  const deduped = (body as Array<{ calendarId: string; name: string; color?: string }>).filter(
    (item) => {
      if (seen.has(item.calendarId)) return false
      seen.add(item.calendarId)
      return true
    }
  )

  try {
    // Atomic bulk-replace: delete existing, insert new selection in one transaction
    await prisma.$transaction([
      prisma.calendarSync.deleteMany({ where: { userId } }),
      ...deduped.map((item) =>
        prisma.calendarSync.create({
          data: {
            userId,
            calendarId: item.calendarId,
            name: item.name,
            color: item.color ?? null,
          },
        })
      ),
    ])
    return NextResponse.json({ saved: deduped.length })
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
