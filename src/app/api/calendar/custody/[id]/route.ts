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

  const familyId = (session.user as { familyId?: string }).familyId
  const { id } = await params

  const entry = await prisma.custodySchedule.findUnique({ where: { id } })
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (entry.familyId !== familyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { location } = body as { location?: string }
  if (location !== "WITH_US" && location !== "WITH_MONA") {
    return NextResponse.json({ error: "location must be WITH_US or WITH_MONA" }, { status: 400 })
  }

  try {
    const updated = await prisma.custodySchedule.update({
      where: { id },
      data: { location },
    })
    return NextResponse.json({
      ...updated,
      date: updated.date.toISOString().split("T")[0],
    })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const familyId = (session.user as { familyId?: string }).familyId
  const { id } = await params

  const entry = await prisma.custodySchedule.findUnique({ where: { id } })
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (entry.familyId !== familyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    await prisma.custodySchedule.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
