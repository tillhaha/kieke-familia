// src/app/api/heating/automation/run/route.ts
// POST — apply today's smart heating rules right now (doesn't affect the daily scheduled run).
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { runAutomation } from "@/lib/homematic/automation"

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = session.user.familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const exists = await prisma.heatingAutomation.findUnique({ where: { familyId }, select: { id: true } })
  if (!exists) return NextResponse.json({ error: "Save the settings first" }, { status: 400 })

  const run = await runAutomation(familyId, "MANUAL")
  return NextResponse.json({ run })
}
