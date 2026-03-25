// src/app/api/tasks/[id]/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ id: string }> }

const assigneeSelect = {
  userId: true,
  user: { select: { id: true, name: true } },
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const existing = await prisma.task.findUnique({ where: { id } })
  if (!existing || existing.familyId !== familyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { name, description, dueDate, done, assigneeIds } = body as Record<string, unknown>

  const data: Record<string, unknown> = {}
  if (name !== undefined) {
    if (typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
    }
    data.name = name.trim()
  }
  if (description !== undefined) {
    data.description = typeof description === "string" && description.trim() !== "" ? description.trim() : null
  }
  if (dueDate !== undefined) {
    if (typeof dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return NextResponse.json({ error: "Invalid dueDate format" }, { status: 400 })
    }
    const parsedDate = new Date(`${dueDate}T00:00:00.000Z`)
    if (isNaN(parsedDate.getTime())) return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 })
    data.dueDate = parsedDate
  }
  if (done !== undefined) {
    data.done = Boolean(done)
  }

  // Handle assignee replacement in a transaction
  if (assigneeIds !== undefined) {
    const ids: string[] = Array.isArray(assigneeIds)
      ? assigneeIds.filter((i): i is string => typeof i === "string")
      : []

    if (ids.length > 0) {
      const count = await prisma.user.count({ where: { id: { in: ids }, familyId } })
      if (count !== ids.length) {
        return NextResponse.json({ error: "Invalid assignee" }, { status: 400 })
      }
    }

    try {
      const task = await prisma.$transaction(async (tx) => {
        await tx.taskAssignee.deleteMany({ where: { taskId: id } })
        return tx.task.update({
          where: { id },
          data: {
            ...data,
            assignees: { create: ids.map((userId) => ({ userId })) },
          },
          include: { assignees: { select: assigneeSelect } },
        })
      })
      return NextResponse.json({ task })
    } catch (err) {
      console.error("[PATCH /api/tasks/:id] transaction", err)
      return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
    }
  }

  try {
    const task = await prisma.task.update({
      where: { id },
      data,
      include: { assignees: { select: assigneeSelect } },
    })
    return NextResponse.json({ task })
  } catch (err) {
    console.error("[PATCH /api/tasks/:id]", err)
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const existing = await prisma.task.findUnique({ where: { id } })
  if (!existing || existing.familyId !== familyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    await prisma.task.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[DELETE /api/tasks/:id]", err)
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 })
  }
}
