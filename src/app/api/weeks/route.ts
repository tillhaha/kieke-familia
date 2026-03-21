// src/app/api/weeks/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

// Returns the ISO date string (YYYY-MM-DD) of the Sunday starting the week
// that contains `date`. getDay() returns 0 for Sunday, so no shift needed.
function weekSunday(date: Date): string {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d.toISOString().split("T")[0]
}

function toDateStr(date: Date): string {
  return date.toISOString().split("T")[0]
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const dayPlans = await prisma.dayPlan.findMany({
      where: { familyId },
      orderBy: { date: "desc" },
    })

    // Group by Sun–Sat week
    const weekMap = new Map<string, typeof dayPlans>()
    for (const plan of dayPlans) {
      const sunday = weekSunday(plan.date)
      if (!weekMap.has(sunday)) weekMap.set(sunday, [])
      weekMap.get(sunday)!.push(plan)
    }

    // Sort weeks newest first
    const sortedSundays = Array.from(weekMap.keys()).sort((a, b) =>
      b.localeCompare(a)
    )

    const weeks = sortedSundays.map((sunday) => {
      const days = weekMap.get(sunday)!
      // Sort days Sun → Sat
      days.sort((a, b) => a.date.getTime() - b.date.getTime())
      const endDate = new Date(sunday + "T00:00:00.000Z")
      endDate.setUTCDate(endDate.getUTCDate() + 6)
      return {
        startDate: sunday,
        endDate: toDateStr(endDate),
        days: days.map((d) => ({
          id: d.id,
          date: toDateStr(d.date),
          note: d.note,
          lunch: d.lunch,
          dinner: d.dinner,
          dinnerActivity: d.dinnerActivity,
          lunchMealId: d.lunchMealId ?? null,
          dinnerMealId: d.dinnerMealId ?? null,
        })),
      }
    })

    return NextResponse.json({ weeks })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    // Find the latest planned day
    const latest = await prisma.dayPlan.findFirst({
      where: { familyId },
      orderBy: { date: "desc" },
    })

    let nextSunday: Date
    if (latest) {
      // Sunday of latest date's week + 7 days = next week's Sunday
      const latestDate = new Date(latest.date)
      const latestSunday = new Date(latestDate)
      latestSunday.setUTCDate(latestDate.getUTCDate() - latestDate.getUTCDay())
      nextSunday = new Date(latestSunday)
      nextSunday.setUTCDate(latestSunday.getUTCDate() + 7)
    } else {
      // No plans yet: find the upcoming Sunday (today if today is Sunday)
      const today = new Date()
      today.setUTCHours(0, 0, 0, 0)
      const daysUntilSunday = (7 - today.getUTCDay()) % 7
      nextSunday = new Date(today)
      nextSunday.setUTCDate(today.getUTCDate() + daysUntilSunday)
    }

    // Build the 7 dates (Sun–Sat)
    const nextWeekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(nextSunday)
      d.setUTCDate(nextSunday.getUTCDate() + i)
      return d
    })

    // Check if already fully planned
    const existingCount = await prisma.dayPlan.count({
      where: {
        familyId,
        date: { in: nextWeekDates },
      },
    })
    if (existingCount === 7) {
      return NextResponse.json(
        { error: "Next week already planned" },
        { status: 409 }
      )
    }

    // Create 7 blank days
    await prisma.dayPlan.createMany({
      data: nextWeekDates.map((d) => ({ date: d, familyId })),
      skipDuplicates: true,
    })

    // Fetch and return the newly created week
    const created = await prisma.dayPlan.findMany({
      where: { familyId, date: { in: nextWeekDates } },
      orderBy: { date: "asc" },
    })

    const endDate = new Date(nextSunday)
    endDate.setUTCDate(nextSunday.getUTCDate() + 6)

    const week = {
      startDate: toDateStr(nextSunday),
      endDate: toDateStr(endDate),
      days: created.map((d) => ({
        id: d.id,
        date: toDateStr(d.date),
        note: d.note,
        lunch: d.lunch,
        dinner: d.dinner,
        dinnerActivity: d.dinnerActivity,
        lunchMealId: d.lunchMealId ?? null,
        dinnerMealId: d.dinnerMealId ?? null,
      })),
    }

    return NextResponse.json({ week }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/weeks]", err)
    return NextResponse.json({ error: "Failed to create week" }, { status: 500 })
  }
}
