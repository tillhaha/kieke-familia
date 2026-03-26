// src/app/api/family/create/route.ts

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function generateJoinCode(): string {
  return Math.floor(Math.random() * 9000000000 + 1000000000).toString()
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as Record<string, unknown>).id as string
  const existingFamilyId = (session.user as Record<string, unknown>).familyId as string | undefined
  if (existingFamilyId) return NextResponse.json({ error: "Already in a family" }, { status: 400 })

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  const city = typeof body.city === "string" ? body.city.trim() : ""

  try {
    const family = await prisma.$transaction(async (tx) => {
      // Generate a unique join code inside the transaction so any DB error is caught
      let joinCode = generateJoinCode()
      for (let i = 0; i < 10; i++) {
        const existing = await tx.family.findUnique({ where: { joinCode } })
        if (!existing) break
        joinCode = generateJoinCode()
      }

      const fam = await tx.family.create({
        data: {
          name: name || "My Family",
          city: city || null,
          joinCode,
        },
      })
      await tx.user.update({
        where: { id: userId },
        data: { familyId: fam.id, role: "ADMIN" },
      })
      return fam
    })

    return NextResponse.json({
      family: { id: family.id, name: family.name, joinCode: family.joinCode },
    })
  } catch {
    return NextResponse.json({ error: "Failed to create family" }, { status: 500 })
  }
}
