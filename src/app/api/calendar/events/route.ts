// src/app/api/calendar/events/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { listEventsFromCalendars } from "@/lib/google/calendar"
import { fetchAndParseIcal } from "@/lib/ical"
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

  if (isNaN(timeMin.getTime()) || isNaN(timeMax.getTime())) {
    return NextResponse.json({ error: "Invalid date parameters" }, { status: 400 })
  }

  try {
    const userId = (session.user as any).id
    const familyId = (session.user as any).familyId

    // Fetch selected calendar IDs + names for this user
    const calendarSyncs = await prisma.calendarSync.findMany({
      where: { userId },
      select: { calendarId: true, name: true },
    })
    const calendarIds = calendarSyncs.map((s: { calendarId: string; name: string }) => s.calendarId)
    const calendarNameMap = Object.fromEntries(calendarSyncs.map((s: { calendarId: string; name: string }) => [s.calendarId, s.name]))
    const calendarSyncCount = calendarIds.length

    // Only call Google if the user has selected calendars
    const googleEvents =
      calendarSyncCount > 0
        ? (await listEventsFromCalendars(userId, calendarIds, timeMin, timeMax)).map((e) => ({
            ...e,
            calendarName: calendarNameMap[e.calendarId] ?? null,
          }))
        : []

    const birthdays = familyId
      ? await prisma.birthday.findMany({ where: { familyId } })
      : []

    const travels = familyId
      ? await prisma.travel.findMany({ where: { user: { familyId } } })
      : await prisma.travel.findMany({ where: { userId } })

    const custodyEntries = familyId
      ? await prisma.custodySchedule.findMany({
          where: {
            familyId,
            date: { gte: timeMin, lte: timeMax },
          },
          orderBy: { date: "asc" },
        })
      : [] as Awaited<ReturnType<typeof prisma.custodySchedule.findMany>>

    const serializedCustody = custodyEntries.map((c) => ({
      ...c,
      date: c.date.toISOString().split("T")[0],
    }))

    const importedCalendars = await prisma.importedCalendar.findMany({
      where: { userId },
      select: { id: true, url: true, name: true, color: true },
    })

    const importedEventsNested = await Promise.all(
      importedCalendars.map((cal) =>
        fetchAndParseIcal(cal.url, cal.id, cal.name, cal.color, timeMin, timeMax)
      )
    )
    const importedEvents = importedEventsNested.flat()

    return NextResponse.json({ googleEvents, calendarSyncCount, birthdays, travels, custodyEntries: serializedCustody, importedEvents })
  } catch (error: unknown) {
    console.error("Calendar fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
