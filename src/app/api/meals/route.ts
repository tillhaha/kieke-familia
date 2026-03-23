// src/app/api/meals/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

const MEAL_TYPES = ["Meal", "Snack", "Drink", "Baked"] as const
const DIETS = ["Vegetarian", "Meat", "Fish"] as const

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""
  const mealType = searchParams.get("mealType") ?? ""
  const diet = searchParams.get("diet") ?? ""
  const officeFriendly = searchParams.get("officeFriendly")
  const thirtyMinute = searchParams.get("thirtyMinute")

  try {
    const meals = await prisma.meal.findMany({
      where: {
        familyId,
        ...(q ? { OR: [
          { name: { contains: q, mode: "insensitive" } },
          { notes: { contains: q, mode: "insensitive" } },
        ]} : {}),
        ...(MEAL_TYPES.includes(mealType as any) ? { mealType: mealType as any } : {}),
        ...(DIETS.includes(diet as any) ? { diet: diet as any } : {}),
        ...(officeFriendly === "true" ? { officeFriendly: true } : {}),
        ...(thirtyMinute === "true" ? { thirtyMinute: true } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, mealType: true, diet: true, officeFriendly: true, thirtyMinute: true },
    })

    return NextResponse.json({ meals })
  } catch (err) {
    console.error("[GET /api/meals]", err)
    return NextResponse.json({ error: "Failed to fetch meals" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const { name, mealType, diet, notes, servings, officeFriendly, thirtyMinute, ingredients, steps, imageUrl, source } = body as Record<string, unknown>
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  try {
    const meal = await prisma.meal.create({
      data: {
        name: name.trim(),
        mealType: MEAL_TYPES.includes(mealType as any) ? mealType as any : "Meal",
        diet: DIETS.includes(diet as any) ? diet as any : "Meat",
        notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
        servings: typeof servings === "number" && servings > 0 ? servings : 2,
        officeFriendly: officeFriendly === true,
        thirtyMinute: thirtyMinute === true,
        ingredients: Array.isArray(ingredients) ? ingredients.filter((i): i is string => typeof i === "string") : [],
        steps: Array.isArray(steps) ? steps.filter((s): s is string => typeof s === "string") : [],
        imageUrl: typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null,
        source: typeof source === "string" && source.trim() ? source.trim() : null,
        familyId,
      },
    })

    return NextResponse.json({ meal }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/meals]", err)
    return NextResponse.json({ error: "Failed to create meal" }, { status: 500 })
  }
}
