// src/app/api/family/route.ts

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ family: null })

  try {
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      select: { id: true, name: true, city: true },
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

  const { city } = body as Record<string, unknown>

  if (city !== undefined && typeof city !== "string") {
    return NextResponse.json({ error: "Invalid city" }, { status: 400 })
  }

  try {
    const family = await prisma.family.update({
      where: { id: familyId },
      data: { city: (city as string | undefined) || null },
      select: { id: true, name: true, city: true },
    })
    return NextResponse.json({ family })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
