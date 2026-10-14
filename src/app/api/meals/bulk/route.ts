// src/app/api/meals/bulk/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { isMealType, isDiet } from "@/lib/mealFields"

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = session.user.familyId
  if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const { ids, mealType, diet, officeFriendly, thirtyMinute } = body as Record<string, unknown>

  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "ids must be a non-empty array of strings" }, { status: 400 })
  }

  const data: Prisma.MealUpdateManyMutationInput = {}
  if (mealType !== undefined) {
    if (!isMealType(mealType)) return NextResponse.json({ error: "Invalid mealType" }, { status: 400 })
    data.mealType = mealType
  }
  if (diet !== undefined) {
    if (!isDiet(diet)) return NextResponse.json({ error: "Invalid diet" }, { status: 400 })
    data.diet = diet
  }
  if (officeFriendly !== undefined) {
    if (typeof officeFriendly !== "boolean") return NextResponse.json({ error: "Invalid officeFriendly" }, { status: 400 })
    data.officeFriendly = officeFriendly
  }
  if (thirtyMinute !== undefined) {
    if (typeof thirtyMinute !== "boolean") return NextResponse.json({ error: "Invalid thirtyMinute" }, { status: 400 })
    data.thirtyMinute = thirtyMinute
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  try {
    await prisma.meal.updateMany({
      where: { id: { in: ids as string[] }, familyId },
      data,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[PATCH /api/meals/bulk]", err)
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }
}
