// src/app/api/shopping/categories/[id]/route.ts
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
  const { name } = await request.json()
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 })
  }

  const category = await prisma.shoppingCategory.findFirst({ where: { id, familyId } })
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await prisma.shoppingCategory.update({
    where: { id },
    data: { name: name.trim() },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const { id } = await params
  const category = await prisma.shoppingCategory.findFirst({ where: { id, familyId } })
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.shoppingCategory.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
