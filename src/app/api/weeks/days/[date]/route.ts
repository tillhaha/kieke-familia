// src/app/api/weeks/days/[date]/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ date: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { date: dateStr } = await params
  const parsedDate = new Date(`${dateStr}T00:00:00.000Z`)
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { note, lunch, dinner, dinnerActivity, lunchMealId, dinnerMealId } = body as Record<string, unknown>

  // Only include fields that were explicitly sent
  const updates: Record<string, string | null> = {}
  if (note !== undefined) updates.note = typeof note === "string" && note !== "" ? note : null
  if (lunch !== undefined) updates.lunch = typeof lunch === "string" && lunch !== "" ? lunch : null
  if (dinner !== undefined) updates.dinner = typeof dinner === "string" && dinner !== "" ? dinner : null
  if (dinnerActivity !== undefined)
    updates.dinnerActivity = typeof dinnerActivity === "string" && dinnerActivity !== "" ? dinnerActivity : null
  if (lunchMealId !== undefined)
    updates.lunchMealId = typeof lunchMealId === "string" && lunchMealId !== "" ? lunchMealId : null
  if (dinnerMealId !== undefined)
    updates.dinnerMealId = typeof dinnerMealId === "string" && dinnerMealId !== "" ? dinnerMealId : null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  let dayPlan
  try {
    dayPlan = await prisma.dayPlan.findUnique({
      where: { date_familyId: { date: parsedDate, familyId } },
    })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (!dayPlan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const updated = await prisma.dayPlan.update({
      where: { date_familyId: { date: parsedDate, familyId } },
      data: updates,
    })
    return NextResponse.json(updated)
  } catch (err) {
    console.error("[PATCH /api/weeks/days]", err)
    return NextResponse.json({ error: "Failed to update day" }, { status: 500 })
  }
}
