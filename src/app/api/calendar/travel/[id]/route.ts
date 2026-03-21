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
  const userId = (session.user as any).id

  const travel = await prisma.travel.findUnique({ where: { id } })
  if (!travel || travel.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { destination, startDate, endDate } = body as any

  if (!destination || typeof destination !== "string" || destination.trim() === "") {
    return NextResponse.json({ error: "Destination is required" }, { status: 400 })
  }

  const start = new Date(startDate)
  const end = new Date(endDate)

  if (isNaN(start.getTime())) {
    return NextResponse.json({ error: "Invalid start date" }, { status: 400 })
  }
  if (isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid end date" }, { status: 400 })
  }
  if (end < start) {
    return NextResponse.json({ error: "End date must be on or after start date" }, { status: 400 })
  }

  try {
    const updated = await prisma.travel.update({
      where: { id },
      data: { destination: destination.trim(), startDate: start, endDate: end },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "Failed to update travel" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const userId = (session.user as any).id

  const travel = await prisma.travel.findUnique({ where: { id } })
  if (!travel || travel.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    await prisma.travel.delete({ where: { id } })
    return NextResponse.json({ deleted: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete travel" }, { status: 500 })
  }
}
