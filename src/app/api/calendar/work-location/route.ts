// src/app/api/calendar/work-location/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const familyId = (session.user as { familyId?: string }).familyId
  if (!familyId) {
    return NextResponse.json({ error: "No family" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { date, userId, location } = body as { date?: string; userId?: string; location?: string | null }

  if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 })
  }
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }
  if (location !== "OFFICE" && location !== "HOME" && location !== null) {
    return NextResponse.json({ error: "location must be OFFICE, HOME, or null" }, { status: 400 })
  }

  const [y, m, d] = date.split("-").map(Number)
  const targetDate = new Date(Date.UTC(y, m - 1, d))

  // Only allow writing locations for a member of the caller's own family
  const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { familyId: true } })
  if (!targetUser || targetUser.familyId !== familyId) {
    return NextResponse.json({ error: "User not in your family" }, { status: 403 })
  }

  try {
    if (location === null) {
      await prisma.workLocation.deleteMany({ where: { date: targetDate, userId } })
      return NextResponse.json({ ok: true })
    }

    const entry = await prisma.workLocation.upsert({
      where: { date_userId: { date: targetDate, userId } },
      create: { date: targetDate, userId, location },
      update: { location },
    })
    return NextResponse.json({ entry: { ...entry, date: entry.date.toISOString().split("T")[0] } })
  } catch (error: unknown) {
    console.error("Work location upsert error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
