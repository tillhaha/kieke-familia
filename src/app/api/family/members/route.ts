// src/app/api/family/members/route.ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sessionUser = session.user as Record<string, unknown>
  const familyId = sessionUser.familyId as string | undefined
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const members = await prisma.user.findMany({
    where: { familyId },
    select: { id: true, name: true, email: true, username: true, role: true, active: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json({ members })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sessionUser = session.user as Record<string, unknown>
  const familyId = sessionUser.familyId as string | undefined
  const role = sessionUser.role as string | undefined

  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })
  if (role !== "PARENT" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { name, username, password } = body as { name?: string; username?: string; password?: string }

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }
  if (!username || typeof username !== "string" || username.trim().length === 0) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 })
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { username: username.trim() } })
  if (existing) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      username: username.trim(),
      passwordHash,
      familyId,
      role: "MEMBER",
    },
    select: { id: true, name: true, username: true },
  })

  return NextResponse.json({ member: user }, { status: 201 })
}
