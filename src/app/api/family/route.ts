// src/app/api/family/route.ts

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const familySelect = {
  id: true, name: true, city: true, joinCode: true,
  heatingEnabled: true, custodyEnabled: true, calendarTitle: true,
} as const

type FamilyRow = {
  id: string; name: string; city: string | null; joinCode: string | null
  heatingEnabled: boolean; custodyEnabled: boolean; calendarTitle: string | null
}

/** The family plus its optional modules as `features` */
function withFeatures(f: FamilyRow | null) {
  if (!f) return null
  const { heatingEnabled, custodyEnabled, calendarTitle, ...family } = f
  return { ...family, features: { heating: heatingEnabled, custody: custodyEnabled, calendarTitle } }
}

function generateJoinCode(): string {
  return Math.floor(Math.random() * 9000000000 + 1000000000).toString()
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = session.user.familyId
  if (!familyId) return NextResponse.json({ family: null })

  try {
    const family = await prisma.family.findUnique({ where: { id: familyId }, select: familySelect })
    return NextResponse.json({ family: withFeatures(family) })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = session.user.familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { city, name, features } = body as Record<string, unknown>

  if (city !== undefined && typeof city !== "string") {
    return NextResponse.json({ error: "Invalid city" }, { status: 400 })
  }
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 })
  }

  // Optional modules: { heating?: boolean, custody?: boolean, calendarTitle?: string } — admins/parents only
  let featureData: { heatingEnabled?: boolean; custodyEnabled?: boolean; calendarTitle?: string | null } = {}
  if (features !== undefined) {
    if (session.user.role !== "ADMIN" && session.user.role !== "PARENT") {
      return NextResponse.json({ error: "Only admins and parents can change features" }, { status: 403 })
    }
    const f = features as Record<string, unknown>
    if (typeof f !== "object" || f === null) return NextResponse.json({ error: "Invalid features" }, { status: 400 })
    if (f.heating !== undefined && typeof f.heating !== "boolean") return NextResponse.json({ error: "Invalid heating" }, { status: 400 })
    if (f.custody !== undefined && typeof f.custody !== "boolean") return NextResponse.json({ error: "Invalid custody" }, { status: 400 })
    if (f.calendarTitle !== undefined && typeof f.calendarTitle !== "string") return NextResponse.json({ error: "Invalid calendarTitle" }, { status: 400 })
    featureData = {
      ...(f.heating !== undefined ? { heatingEnabled: f.heating as boolean } : {}),
      ...(f.custody !== undefined ? { custodyEnabled: f.custody as boolean } : {}),
      ...(f.calendarTitle !== undefined ? { calendarTitle: (f.calendarTitle as string).trim().slice(0, 60) || null } : {}),
    }
  }

  const generateCode = (body as Record<string, unknown>).generateJoinCode === true

  try {
    let newJoinCode: string | undefined
    if (generateCode) {
      newJoinCode = generateJoinCode()
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
        ...featureData,
      },
      select: familySelect,
    })
    return NextResponse.json({ family: withFeatures(family) })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
