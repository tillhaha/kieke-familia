// src/app/api/family/route.ts

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function generateJoinCode(): string {
  return Math.floor(Math.random() * 9000000000 + 1000000000).toString()
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ family: null })

  try {
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      select: { id: true, name: true, city: true, joinCode: true },
    })
    return NextResponse.json({ family })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { city, name } = body as Record<string, unknown>

  if (city !== undefined && typeof city !== "string") {
    return NextResponse.json({ error: "Invalid city" }, { status: 400 })
  }
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 })
  }

  const generateCode = (body as Record<string, unknown>).generateJoinCode === true

  try {
    let newJoinCode: string | undefined
    if (generateCode) {
      newJoinCode = generateJoinCode()
      // Ensure uniqueness
      for (let i = 0; i < 10; i++) {
        const existing = await prisma.family.findUnique({ where: { joinCode: newJoinCode } })
        if (!existing) break
        newJoinCode = generateJoinCode()
      }
    }

    const family = await prisma.family.update({
      where: { id: familyId },
      data: {
        ...(city !== undefined ? { city: (city as string) || null } : {}),
        ...(name !== undefined ? { name: (name as string).trim() } : {}),
        ...(newJoinCode !== undefined ? { joinCode: newJoinCode } : {}),
      },
      select: { id: true, name: true, city: true, joinCode: true },
    })
    return NextResponse.json({ family })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
