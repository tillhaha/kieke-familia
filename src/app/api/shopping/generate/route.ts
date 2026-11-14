import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"
import { categorizeShoppingItems } from "@/lib/shoppingCategorize"
import { describeSources, mealSources } from "@/lib/shoppingFromWeek"

const client = new Anthropic()

const UnifiedSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.string().nullable(),
      recipes: z.array(z.string()),
    })
  ),
})

/** "Lasagne, Curry" — which meals an item is for (shown under the item on the list) */
function recipeNote(recipes: string[]): string | null {
  const unique = [...new Set(recipes.map((r) => r.trim()).filter(Boolean))]
  return unique.length ? unique.join(", ").slice(0, 300) : null
}

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

  // 1. All planned meals of the week: linked recipes (scaled to our servings) and, for meals
  //    without a recipe, the ingredients written in the meal's note — see src/lib/shoppingFromWeek.ts
  const recipe = { select: { name: true, servings: true, ingredients: true } }
  const dayPlans = await prisma.dayPlan.findMany({
    where: { familyId: familyId as string, date: { gte: start, lt: end } },
    include: { lunchMeal: recipe, dinnerMeal: recipe },
    orderBy: { date: "asc" },
  })
  const sources = mealSources(dayPlans)

  if (sources.length === 0) {
    return NextResponse.json({ added: 0 })
  }

  // Call Claude to normalise, merge, and order ingredients
  let unified: Array<{ name: string; quantity: string | null; recipes: string[] }>
  try {
    const response = await client.messages.parse({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      output_config: {
        format: zodOutputFormat(UnifiedSchema),
      },
      system: `You are a shopping list assistant. Given the ingredients of the planned meals, return a clean, unified shopping list.

Rules:
- Each meal comes with a scaling instruction. Scale its quantities first (e.g. "multiply every quantity by 0.5": "400 g pasta" → "200 g", "1 onion" → "½ onion"), then merge. Round to sensible shopping amounts (whole eggs, ½ for produce, grams to 5–10 g); items without a quantity stay without one.
- For a meal whose ingredients are written in a note, read the ingredients out of that text (one per line or separated by commas) and use their quantities as written.
- Merge clearly identical ingredients and add up their (scaled) quantities (e.g. "2 chicken breasts" and "3 chicken pieces" → one "chicken breast" entry).
- For similar-but-potentially-different ingredients (e.g. "potatoes" and "small potatoes"), keep both but place them adjacent in the list.
- Strip quantities and units from the name field — put them in the quantity field (null if none).
- Strip all preparation descriptors from the name field — only keep the core ingredient (e.g. "garlic cloves, crushed" → "garlic", "olives, pitted and quartered lengthways" → "olive", "finely chopped onion" → "onion", "bone-in chicken thighs" → "chicken thigh").
- Normalise names to lowercase, singular where natural (e.g. "tomatoes" → "tomato").
- In "recipes", list the meal titles (exactly as written after "## ", without the part in brackets) that need this item, each title once.
- Return items in a logical shopping order (produce together, proteins together, etc.).`,
      messages: [
        {
          role: "user",
          content: `Planned meals:

${describeSources(sources)}`,
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

  // Drop blacklisted items: a term matches the normalised name exactly, so
  // "onion" filters "onion" but not "spring onion", and "salt" never hits "unsalted butter"
  const blacklist = await prisma.shoppingBlacklist.findMany({ where: { familyId } })
  const blacklistTerms = new Set(blacklist.map((b) => b.term.trim().toLowerCase()))
  unified = unified.filter((i) => !blacklistTerms.has(i.name.trim().toLowerCase()))

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

  // Category pre-assignment: remembered mapping, then AI for unknown names
  const categoryMap = await categorizeShoppingItems(
    familyId as string,
    newIngredients.map((i) => i.name)
  )

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
          note: recipeNote(item.recipes),
          categoryId: categoryMap.get(item.name.trim().toLowerCase()) ?? null,
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
