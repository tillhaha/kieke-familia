import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const userFamilyId = (session.user as any).familyId

  const birthday = await prisma.birthday.findUnique({ where: { id } })
  if (!birthday || !userFamilyId || birthday.familyId !== userFamilyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { name, month, day } = body as any

  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Month must be between 1 and 12" }, { status: 400 })
  }
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return NextResponse.json({ error: "Day must be between 1 and 31" }, { status: 400 })
  }

  try {
    const updated = await prisma.birthday.update({
      where: { id },
      data: { name: name.trim(), month, day },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "Failed to update birthday" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const userFamilyId = (session.user as any).familyId

  const birthday = await prisma.birthday.findUnique({ where: { id } })
  if (!birthday || !userFamilyId || birthday.familyId !== userFamilyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    await prisma.birthday.delete({ where: { id } })
    return NextResponse.json({ deleted: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete birthday" }, { status: 500 })
  }
}
