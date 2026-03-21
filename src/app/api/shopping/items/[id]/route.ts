import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const { id } = await params
  const item = await prisma.shoppingItem.findFirst({ where: { id, familyId } })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { categoryId } = body

  // Validate categoryId belongs to this family
  if (categoryId) {
    const cat = await prisma.shoppingCategory.findFirst({ where: { id: categoryId, familyId } })
    if (!cat) return NextResponse.json({ error: "Invalid category" }, { status: 400 })
  }

  const updated = await prisma.shoppingItem.update({
    where: { id },
    data: { categoryId: categoryId ?? null },
    include: { category: true },
  })

  // Update memory for this item name
  if (categoryId) {
    await prisma.shoppingItemMemory.upsert({
      where: { familyId_itemName: { familyId, itemName: item.name.toLowerCase() } },
      update: { categoryId },
      create: { familyId, itemName: item.name.toLowerCase(), categoryId },
    })
  }

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const { id } = await params
  const item = await prisma.shoppingItem.findFirst({ where: { id, familyId } })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.shoppingItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
