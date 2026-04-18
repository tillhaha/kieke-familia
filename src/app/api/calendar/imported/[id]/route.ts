// src/app/api/calendar/imported/[id]/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = (session.user as any).familyId
  const { id } = await params

  const calendar = await prisma.importedCalendar.findUnique({ where: { id } })
  if (!calendar || calendar.familyId !== familyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await request.json()
  const updated = await prisma.importedCalendar.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name.trim() } : {}),
      ...(body.color ? { color: body.color } : {}),
    },
    select: { id: true, url: true, name: true, color: true, createdAt: true },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = (session.user as any).familyId
  const { id } = await params

  const calendar = await prisma.importedCalendar.findUnique({ where: { id } })
  if (!calendar || calendar.familyId !== familyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.importedCalendar.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
