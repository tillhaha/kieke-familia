// src/app/api/personal-categories/route.ts
// The signed-in user's own todo categories/projects. Scoped by userId only.
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { MAX_DESCRIPTION_LENGTH, cleanCategoryName, listCategoriesWithCounts } from "@/lib/personalCategories"

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    return NextResponse.json({ categories: await listCategoriesWithCounts(userId) })
  } catch (err) {
    console.error("[GET /api/personal-categories]", err)
    return NextResponse.json({ error: "Failed to load categories" }, { status: 500 })
  }
}

// Body: { name, description? }
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { name, description } = (body ?? {}) as Record<string, unknown>
  if (typeof name !== "string" || !cleanCategoryName(name)) return NextResponse.json({ error: "name required" }, { status: 400 })
  const clean = cleanCategoryName(name)
  const desc = typeof description === "string" && description.trim() ? description.trim().slice(0, MAX_DESCRIPTION_LENGTH) : null

  try {
    const exists = await prisma.personalCategory.findFirst({
      where: { userId, name: { equals: clean, mode: "insensitive" } },
      select: { id: true },
    })
    if (exists) return NextResponse.json({ error: "Category already exists" }, { status: 409 })
    const category = await prisma.personalCategory.create({
      data: { userId, name: clean, description: desc },
      select: { id: true, name: true, description: true },
    })
    return NextResponse.json({ category: { ...category, count: 0 } }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/personal-categories]", err)
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 })
  }
}
