// src/app/api/meals/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""

  try {
    const meals = await prisma.meal.findMany({
      where: {
        familyId,
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true, servings: true, createdAt: true },
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

  const { name, description, servings, ingredients, steps } = body as Record<string, unknown>
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  try {
    const meal = await prisma.meal.create({
      data: {
        name: name.trim(),
        description: typeof description === "string" && description.trim() ? description.trim() : null,
        servings: typeof servings === "number" && servings > 0 ? servings : 2,
        ingredients: Array.isArray(ingredients) ? ingredients.filter((i): i is string => typeof i === "string") : [],
        steps: Array.isArray(steps) ? steps.filter((s): s is string => typeof s === "string") : [],
        familyId,
      },
    })

    return NextResponse.json({ meal }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/meals]", err)
    return NextResponse.json({ error: "Failed to create meal" }, { status: 500 })
  }
}
