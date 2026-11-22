// src/app/api/shopping/generate/route.ts
// POST { weekStartDate } — "Add to shopping list" in the week planner. The meals of the week
// (see src/lib/shoppingFromWeek.ts) go through the shared generator in src/lib/shoppingGenerate.ts.
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { mealSources } from "@/lib/shoppingFromWeek"
import { addMealsToShoppingList, failureBody } from "@/lib/shoppingGenerate"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as Record<string, unknown>).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { weekStartDate } = body
  if (!weekStartDate || typeof weekStartDate !== "string") {
    return NextResponse.json({ error: "weekStartDate required" }, { status: 400 })
  }

  const start = new Date(weekStartDate + "T00:00:00Z")
  if (isNaN(start.getTime())) {
    return NextResponse.json({ error: "Invalid weekStartDate" }, { status: 400 })
  }
  const end = new Date(start)
  end.setDate(end.getDate() + 7)

  try {
    // All planned meals of the week: linked recipes (scaled to our servings) and, for meals
    // without a recipe, the ingredients written in the meal's note
    const recipe = { select: { name: true, servings: true, ingredients: true } }
    const dayPlans = await prisma.dayPlan.findMany({
      where: { familyId: familyId as string, date: { gte: start, lt: end } },
      include: { lunchMeal: recipe, dinnerMeal: recipe },
      orderBy: { date: "asc" },
    })
    return NextResponse.json(await addMealsToShoppingList(familyId as string, mealSources(dayPlans)))
  } catch (err) {
    return NextResponse.json(failureBody(err, "load-week"), { status: 500 })
  }
}
