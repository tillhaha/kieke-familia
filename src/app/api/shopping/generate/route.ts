import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"

const client = new Anthropic()

const UnifiedSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.string().nullable(),
    })
  ),
})

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

  if (rawIngredients.length === 0) {
    return NextResponse.json({ added: 0 })
  }

  // Fetch blacklist
  const blacklist = await prisma.shoppingBlacklist.findMany({ where: { familyId } })
  const blacklistTerms = blacklist.map((b) => b.term)

  // Call Claude to normalise, merge, filter, and order ingredients
  let unified: Array<{ name: string; quantity: string | null }>
  try {
    const response = await client.messages.parse({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      output_config: {
        format: zodOutputFormat(UnifiedSchema),
      },
      system: `You are a shopping list assistant. Given a list of raw meal ingredients, return a clean, unified shopping list.

Rules:
- Remove any ingredient that contains one of the blacklist terms as a substring (case-insensitive).
- Merge clearly identical ingredients (e.g. "2 chicken breasts" and "3 chicken pieces" → one "chicken breast" entry).
- For similar-but-potentially-different ingredients (e.g. "potatoes" and "small potatoes"), keep both but place them adjacent in the list.
- Strip quantities and units from the name field — put them in the quantity field (null if none).
- Normalise names to lowercase, singular where natural (e.g. "tomatoes" → "tomato").
- Return items in a logical shopping order (produce together, proteins together, etc.).`,
      messages: [
        {
          role: "user",
          content: `Blacklist terms: ${blacklistTerms.length > 0 ? blacklistTerms.join(", ") : "(none)"}

Ingredients:
${rawIngredients.map((i) => `- ${i}`).join("\n")}`,
        },
      ],
    })

    if (!response.parsed_output) {
      return NextResponse.json({ error: "AI unification failed" }, { status: 500 })
    }
    unified = response.parsed_output.items
  } catch (err) {
    console.error("[generate] Claude unification error:", err)
    return NextResponse.json({ error: "AI unification failed" }, { status: 500 })
  }

  if (unified.length === 0) {
    return NextResponse.json({ added: 0 })
  }

  // Deduplicate against existing items on the list
  const existingItems = await prisma.shoppingItem.findMany({
    where: { familyId },
    select: { name: true },
  })
  const existingNames = new Set(existingItems.map((i) => i.name.toLowerCase()))
  const newIngredients = unified.filter((i) => !existingNames.has(i.name.toLowerCase()))

  if (newIngredients.length === 0) {
    return NextResponse.json({ added: 0 })
  }

  // Look up memory for category pre-assignment
  const memories = await prisma.shoppingItemMemory.findMany({
    where: {
      familyId,
      itemName: { in: newIngredients.map((i) => i.name.toLowerCase()) },
    },
  })
  const memoryMap = new Map(memories.map((m) => [m.itemName, m.categoryId]))

  // Insert items in Claude's order, assigning sortOrder (atomic to avoid race conditions)
  try {
    await prisma.$transaction(async (tx) => {
      const maxSortOrder = await tx.shoppingItem.aggregate({
        where: { familyId },
        _max: { sortOrder: true },
      })
      const baseOrder = (maxSortOrder._max.sortOrder ?? -1) + 1

      await tx.shoppingItem.createMany({
        data: newIngredients.map((item, index) => ({
          familyId: familyId as string,
          name: item.name,
          quantity: item.quantity ?? null,
          categoryId: memoryMap.get(item.name) ?? null,
          sortOrder: baseOrder + index,
        })),
      })
    })
  } catch (error: unknown) {
    console.error("Shopping generate insert error:", error)
    return NextResponse.json({ error: "Failed to add items" }, { status: 500 })
  }

  return NextResponse.json({ added: newIngredients.length })
}
