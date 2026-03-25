// src/app/api/tasks/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

const assigneeSelect = {
  userId: true,
  user: { select: { id: true, name: true } },
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const includeDone = searchParams.get("includeDone") === "true"

  try {
    const tasks = await prisma.task.findMany({
      where: {
        familyId,
        ...(includeDone ? {} : { done: false }),
      },
      orderBy: { dueDate: "asc" },
      include: { assignees: { select: assigneeSelect } },
    })
    return NextResponse.json({ tasks })
  } catch (err) {
    console.error("[GET /api/tasks]", err)
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { name, description, dueDate, assigneeIds } = body as Record<string, unknown>

  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }
  if (!dueDate || typeof dueDate !== "string") {
    return NextResponse.json({ error: "dueDate is required" }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return NextResponse.json({ error: "Invalid dueDate format" }, { status: 400 })
  }
  const parsedDate = new Date(`${dueDate}T00:00:00.000Z`)
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 })
  }

  const ids: string[] = Array.isArray(assigneeIds) ? assigneeIds.filter((id): id is string => typeof id === "string") : []

  try {
    // Validate all assigneeIds belong to the family
    if (ids.length > 0) {
      const count = await prisma.user.count({ where: { id: { in: ids }, familyId } })
      if (count !== ids.length) {
        return NextResponse.json({ error: "Invalid assignee" }, { status: 400 })
      }
    }

    const task = await prisma.task.create({
      data: {
        name: name.trim(),
        description: typeof description === "string" && description.trim() !== "" ? description.trim() : null,
        dueDate: parsedDate,
        familyId,
        assignees: {
          create: ids.map((userId) => ({ userId })),
        },
      },
      include: { assignees: { select: assigneeSelect } },
    })

    return NextResponse.json({ task }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/tasks]", err)
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
  }
}
