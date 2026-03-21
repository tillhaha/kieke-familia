import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

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

  const start = new Date(weekStartDate + "T00:00:00")
  const end = new Date(start)
  end.setDate(end.getDate() + 7)

  // 1. Fetch DayPlans for the week that have linked meals
  const dayPlans = await prisma.dayPlan.findMany({
    where: {
      familyId,
      date: { gte: start, lt: end },
      OR: [{ lunchMealId: { not: null } }, { dinnerMealId: { not: null } }],
    },
    include: {
      lunchMeal: { select: { ingredients: true } },
      dinnerMeal: { select: { ingredients: true } },
    },
  })

  // 2. Collect all ingredients
  const rawIngredients: string[] = []
  for (const plan of dayPlans) {
    if (plan.lunchMeal) rawIngredients.push(...plan.lunchMeal.ingredients)
    if (plan.dinnerMeal) rawIngredients.push(...plan.dinnerMeal.ingredients)
  }

  // 3. Normalize: lowercase + trim, deduplicate within this batch
  const normalized = [...new Set(rawIngredients.map((i) => i.trim().toLowerCase()).filter(Boolean))]

  // 4. Filter against blacklist (substring match)
  const blacklist = await prisma.shoppingBlacklist.findMany({ where: { familyId } })
  const blacklistTerms = blacklist.map((b) => b.term)
  const filtered = normalized.filter(
    (ingredient) => !blacklistTerms.some((term) => ingredient.includes(term))
  )

  // 5. Deduplicate against existing items
  const existingItems = await prisma.shoppingItem.findMany({
    where: { familyId },
    select: { name: true },
  })
  const existingNames = new Set(existingItems.map((i) => i.name.toLowerCase()))
  const newIngredients = filtered.filter((i) => !existingNames.has(i))

  if (newIngredients.length === 0) {
    return NextResponse.json({ added: 0 })
  }

  // 6. Look up memory for category pre-assignment
  const memories = await prisma.shoppingItemMemory.findMany({
    where: {
      familyId,
      itemName: { in: newIngredients },
    },
  })
  const memoryMap = new Map(memories.map((m) => [m.itemName, m.categoryId]))

  // 7. Bulk insert
  await prisma.shoppingItem.createMany({
    data: newIngredients.map((name) => ({
      familyId,
      name,
      categoryId: memoryMap.get(name) ?? null,
    })),
  })

  return NextResponse.json({ added: newIngredients.length })
}
