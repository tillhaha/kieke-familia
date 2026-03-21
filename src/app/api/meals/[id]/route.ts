// src/app/api/meals/[id]/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ id: string }> }

async function getAuthedMeal(id: string, familyId: string) {
  return prisma.meal.findFirst({ where: { id, familyId } })
}

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  try {
    const meal = await getAuthedMeal(id, familyId)
    if (!meal) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({ meal })
  } catch (err) {
    console.error("[GET /api/meals/:id]", err)
    return NextResponse.json({ error: "Failed to fetch meal" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  let meal
  try {
    meal = await getAuthedMeal(id, familyId)
  } catch (err) {
    console.error("[PATCH /api/meals/:id] lookup", err)
    return NextResponse.json({ error: "Failed to fetch meal" }, { status: 500 })
  }
  if (!meal) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const { name, description, servings, ingredients, steps } = body as Record<string, unknown>
  const updates: Prisma.MealUpdateInput = {}

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 })
    }
    updates.name = name.trim()
  }
  if (description !== undefined) updates.description = typeof description === "string" && description.trim() ? description.trim() : null
  if (servings !== undefined) {
    if (typeof servings !== "number" || servings <= 0) {
      return NextResponse.json({ error: "servings must be a positive number" }, { status: 400 })
    }
    updates.servings = servings
  }
  if (ingredients !== undefined) updates.ingredients = Array.isArray(ingredients) ? ingredients.filter((i): i is string => typeof i === "string") : meal.ingredients
  if (steps !== undefined) updates.steps = Array.isArray(steps) ? steps.filter((s): s is string => typeof s === "string") : meal.steps

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  try {
    const updated = await prisma.meal.update({ where: { id }, data: updates })
    return NextResponse.json({ meal: updated })
  } catch (err) {
    console.error("[PATCH /api/meals/:id]", err)
    return NextResponse.json({ error: "Failed to update meal" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  try {
    const meal = await getAuthedMeal(id, familyId)
    if (!meal) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await prisma.meal.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[DELETE /api/meals/:id]", err)
    return NextResponse.json({ error: "Failed to delete meal" }, { status: 500 })
  }
}
