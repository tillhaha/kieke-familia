// src/app/api/shopping/categories/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

const DEFAULT_CATEGORIES = [
  "Fruit/Vegetables",
  "Meat",
  "Fish",
  "Milk Products",
  "Bread",
  "Condiments",
  "Sauces",
  "Drinks",
  "Frozen",
  "Nuts/Snacks",
]

const DEFAULT_BLACKLIST = [
  "oil", "vinegar", "salt", "pepper", "onion", "onions",
  "mustard", "sugar", "flour", "water", "garlic",
]

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  // Seed defaults if family has no categories yet
  const existing = await prisma.shoppingCategory.count({ where: { familyId } })
  if (existing === 0) {
    await prisma.$transaction([
      ...DEFAULT_CATEGORIES.map((name, i) =>
        prisma.shoppingCategory.create({ data: { familyId, name, order: i } })
      ),
      ...DEFAULT_BLACKLIST.map((term) =>
        prisma.shoppingBlacklist.upsert({
          where: { familyId_term: { familyId, term } },
          update: {},
          create: { familyId, term },
        })
      ),
    ])
  }

  const categories = await prisma.shoppingCategory.findMany({
    where: { familyId },
    orderBy: { order: "asc" },
  })
  return NextResponse.json({ categories })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { name } = body
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 })
  }

  const maxOrder = await prisma.shoppingCategory.aggregate({
    where: { familyId },
    _max: { order: true },
  })
  const order = (maxOrder._max.order ?? -1) + 1

  try {
    const category = await prisma.shoppingCategory.create({
      data: { familyId, name: name.trim(), order },
    })
    return NextResponse.json(category, { status: 201 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Category name already exists" }, { status: 409 })
    }
    console.error("Shopping category create error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
