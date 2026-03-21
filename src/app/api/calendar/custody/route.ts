// src/app/api/calendar/custody/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const familyId = (session.user as any).familyId
  if (!familyId) {
    return NextResponse.json({ error: "No family" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { startDate, startsWith, recurring, until } = body as any

  if (!startDate || typeof startDate !== "string") {
    return NextResponse.json({ error: "startDate is required" }, { status: 400 })
  }
  if (startsWith !== "WITH_US" && startsWith !== "WITH_MONA") {
    return NextResponse.json({ error: "startsWith must be WITH_US or WITH_MONA" }, { status: 400 })
  }
  if (typeof recurring !== "boolean") {
    return NextResponse.json({ error: "recurring must be a boolean" }, { status: 400 })
  }

  const start = new Date(startDate)
  if (isNaN(start.getTime())) {
    return NextResponse.json({ error: "Invalid startDate" }, { status: 400 })
  }

  if (recurring) {
    if (!until || typeof until !== "string") {
      return NextResponse.json({ error: "until is required when recurring is true" }, { status: 400 })
    }
    const end = new Date(until)
    if (isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid until date" }, { status: 400 })
    }
    if (end < start) {
      return NextResponse.json({ error: "until must be on or after startDate" }, { status: 400 })
    }
    const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    if (diffDays > 730) {
      return NextResponse.json({ error: "Date range cannot exceed 730 days" }, { status: 400 })
    }
  }

  // Build upsert operations
  const ops: ReturnType<typeof prisma.custodySchedule.upsert>[] = []
  const personName = "Emilia"

  if (!recurring) {
    // Single day
    ops.push(
      prisma.custodySchedule.upsert({
        where: { date_personName_familyId: { date: start, personName, familyId } },
        create: { date: start, personName, location: startsWith, familyId },
        update: { location: startsWith },
      })
    )
  } else {
    // Expand recurring: iterate day-by-day, flip location every Sunday (except startDate)
    const end = new Date(until)
    let currentLocation: "WITH_US" | "WITH_MONA" = startsWith
    const cursor = new Date(start)

    while (cursor <= end) {
      // Flip on every Sunday except the very first day
      const isStartDate = cursor.getTime() === start.getTime()
      if (!isStartDate && cursor.getDay() === 0) {
        currentLocation = currentLocation === "WITH_US" ? "WITH_MONA" : "WITH_US"
      }

      const dateSnapshot = new Date(cursor)
      ops.push(
        prisma.custodySchedule.upsert({
          where: { date_personName_familyId: { date: dateSnapshot, personName, familyId } },
          create: { date: dateSnapshot, personName, location: currentLocation, familyId },
          update: { location: currentLocation },
        })
      )

      cursor.setDate(cursor.getDate() + 1)
    }
  }

  try {
    await prisma.$transaction(ops)
    return NextResponse.json({ count: ops.length }, { status: 201 })
  } catch (error: any) {
    console.error("Custody create error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
