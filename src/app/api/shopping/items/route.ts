import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const items = await prisma.shoppingItem.findMany({
    where: { familyId },
    include: { category: true },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json({ items })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { name, quantity, categoryId } = body
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 })
  }
  if (quantity !== undefined && typeof quantity !== "string") {
    return NextResponse.json({ error: "quantity must be a string" }, { status: 400 })
  }

  // Validate categoryId belongs to this family
  if (categoryId) {
    const cat = await prisma.shoppingCategory.findFirst({ where: { id: categoryId, familyId } })
    if (!cat) return NextResponse.json({ error: "Invalid category" }, { status: 400 })
  }

  const item = await prisma.shoppingItem.create({
    data: {
      familyId,
      name: name.trim(),
      quantity: quantity?.trim() || null,
      categoryId: categoryId || null,
    },
    include: { category: true },
  })

  // Upsert memory: remember this item name → category mapping
  if (categoryId) {
    await prisma.shoppingItemMemory.upsert({
      where: { familyId_itemName: { familyId, itemName: name.trim().toLowerCase() } },
      update: { categoryId },
      create: { familyId, itemName: name.trim().toLowerCase(), categoryId },
    })
  }

  return NextResponse.json(item, { status: 201 })
}
