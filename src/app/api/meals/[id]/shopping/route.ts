// src/app/api/meals/[id]/shopping/route.ts
// POST — "Add to shopping list" on a recipe page: the recipe's ingredients 1:1 (its own
// servings, no scaling), merged into the family's list like the week planner does.
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { recipeSource } from "@/lib/shoppingFromWeek"
import { addMealsToShoppingList, failureBody } from "@/lib/shoppingGenerate"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  const familyId = session?.user?.familyId
  if (!familyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  try {
    const meal = await prisma.meal.findFirst({
      where: { id, familyId },
      select: { name: true, servings: true, ingredients: true },
    })
    if (!meal) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (!meal.ingredients.length) return NextResponse.json({ added: 0 })
    return NextResponse.json(await addMealsToShoppingList(familyId, [recipeSource(meal)]))
  } catch (err) {
    return NextResponse.json(failureBody(err, "load-recipe"), { status: 500 })
  }
}
