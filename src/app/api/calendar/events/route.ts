// src/app/api/calendar/events/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { listEventsFromCalendars } from "@/lib/google/calendar"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const timeMin = searchParams.get("timeMin")
    ? new Date(searchParams.get("timeMin")!)
    : new Date()
  const timeMax = searchParams.get("timeMax")
    ? new Date(searchParams.get("timeMax")!)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  try {
    const userId = (session.user as any).id
    const familyId = (session.user as any).familyId

    // Fetch selected calendar IDs for this user
    const calendarSyncs = await prisma.calendarSync.findMany({
      where: { userId },
      select: { calendarId: true },
    })
    const calendarIds = calendarSyncs.map((s) => s.calendarId)
    const calendarSyncCount = calendarIds.length

    // Only call Google if the user has selected calendars
    const googleEvents =
      calendarSyncCount > 0
        ? await listEventsFromCalendars(userId, calendarIds, timeMin, timeMax)
        : []

    const birthdays = familyId
      ? await prisma.birthday.findMany({ where: { familyId } })
      : []

    const travels = familyId
      ? await prisma.travel.findMany({ where: { user: { familyId } } })
      : await prisma.travel.findMany({ where: { userId } })

    return NextResponse.json({ googleEvents, calendarSyncCount, birthdays, travels })
  } catch (error: any) {
    console.error("Calendar fetch error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
