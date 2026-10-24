import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { isShoppingTagList, type ShoppingTag } from "@/lib/shoppingTags"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = session.user.familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const { id } = await params
  const item = await prisma.shoppingItem.findFirst({ where: { id, familyId } })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const bodyObj = body as Record<string, unknown>
  const { name, quantity, categoryId, tags } = bodyObj
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 })
  }
  if (quantity !== undefined && quantity !== null && typeof quantity !== "string") {
    return NextResponse.json({ error: "quantity must be a string" }, { status: 400 })
  }
  if (categoryId !== undefined && categoryId !== null && typeof categoryId !== "string") {
    return NextResponse.json({ error: "categoryId must be a string" }, { status: 400 })
  }
  if (tags !== undefined && !isShoppingTagList(tags)) {
    return NextResponse.json({ error: "Invalid tags" }, { status: 400 })
  }

  // Build update data — only include fields explicitly provided in body
  const updateData: { name?: string; quantity?: string | null; categoryId?: string | null; tags?: ShoppingTag[] } = {}
  if (typeof name === "string") updateData.name = name.trim()
  if ("quantity" in bodyObj) updateData.quantity = (quantity as string | null)?.trim() || null
  if (tags !== undefined) updateData.tags = [...new Set(tags)]
  if ("categoryId" in bodyObj) {
    updateData.categoryId = categoryId ?? null
  }

  // Validate categoryId belongs to this family (only if provided)
  if (updateData.categoryId !== undefined && updateData.categoryId !== null) {
    const cat = await prisma.shoppingCategory.findFirst({ where: { id: updateData.categoryId, familyId } })
    if (!cat) return NextResponse.json({ error: "Invalid category" }, { status: 400 })
  }

  const updated = await prisma.shoppingItem.update({
    where: { id },
    data: updateData,
    include: { category: true },
  })

  // Overwrite the remembered category for this item name (only if category explicitly set).
  // Moving an item to "Other" forgets the mapping so it isn't re-applied next time.
  if (updateData.categoryId !== undefined) {
    const itemName = updated.name.toLowerCase()
    if (updateData.categoryId) {
      await prisma.shoppingItemMemory.upsert({
        where: { familyId_itemName: { familyId, itemName } },
        update: { categoryId: updateData.categoryId },
        create: { familyId, itemName, categoryId: updateData.categoryId },
      })
    } else {
      await prisma.shoppingItemMemory.deleteMany({ where: { familyId, itemName } })
    }
  }

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = session.user.familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const { id } = await params
  const item = await prisma.shoppingItem.findFirst({ where: { id, familyId } })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.shoppingItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
