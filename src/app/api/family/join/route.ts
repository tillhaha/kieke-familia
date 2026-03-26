// src/app/api/family/join/route.ts

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as Record<string, unknown>).id as string
  const existingFamilyId = (session.user as Record<string, unknown>).familyId as string | undefined
  if (existingFamilyId) return NextResponse.json({ error: "Already in a family" }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const code = typeof body.code === "string" ? body.code.trim() : ""
  if (!code) return NextResponse.json({ error: "Join code is required" }, { status: 400 })

  const family = await prisma.family.findUnique({ where: { joinCode: code } })
  if (!family) return NextResponse.json({ error: "Invalid join code" }, { status: 404 })

  await prisma.user.update({
    where: { id: userId },
    data: { familyId: family.id, role: "MEMBER" },
  })

  return NextResponse.json({ family: { id: family.id, name: family.name } })
}
