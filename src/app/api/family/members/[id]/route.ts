// src/app/api/family/members/[id]/route.ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sessionUser = session.user as Record<string, unknown>
  const familyId = sessionUser.familyId as string | undefined
  const sessionRole = sessionUser.role as string | undefined

  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })
  if (sessionRole !== "PARENT" && sessionRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const target = await prisma.user.findUnique({
    where: { id },
    select: { familyId: true, username: true },
  })
  if (!target || target.familyId !== familyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { password, role, active } = body as {
    password?: string
    role?: string
    active?: boolean
  }

  // role and active changes require ADMIN
  if ((role !== undefined || active !== undefined) && sessionRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (role !== undefined && !["ADMIN", "PARENT", "MEMBER"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  // password reset only valid for credential users
  if (password !== undefined) {
    if (!target.username) {
      return NextResponse.json({ error: "Cannot set password on Google account" }, { status: 400 })
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }
  }

  const data: Record<string, unknown> = {}
  if (password !== undefined) data.passwordHash = await bcrypt.hash(password, 10)
  if (role !== undefined) data.role = role
  if (active !== undefined) data.active = active

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  await prisma.user.update({ where: { id }, data })

  return NextResponse.json({ ok: true })
}
