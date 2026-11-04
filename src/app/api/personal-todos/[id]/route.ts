// src/app/api/personal-todos/[id]/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { cleanCategoryName, ensureCategories, resolveCategoryName } from "@/lib/personalCategories"

type Params = { params: Promise<{ id: string }> }

async function ownTodo(id: string) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const todo = await prisma.personalTodo.findUnique({ where: { id } })
  // Someone else's item answers exactly like a missing one
  if (!todo || todo.userId !== userId) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  return { todo }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const { todo: current, error } = await ownTodo(id)
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { title, note, category, dueDate, done } = (body ?? {}) as Record<string, unknown>

  const data: Record<string, unknown> = {}
  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 })
    data.title = title.trim()
  }
  if (note !== undefined) {
    data.note = typeof note === "string" && note.trim() ? note.trim() : null
  }
  if (category !== undefined) {
    if (typeof category !== "string" || !cleanCategoryName(category)) return NextResponse.json({ error: "Category cannot be empty" }, { status: 400 })
    // Reuse the existing spelling ("arbeit" → "Arbeit") so groups don't split
    data.category = await resolveCategoryName(current.userId, category)
  }
  if (dueDate !== undefined) {
    if (dueDate === null || dueDate === "") {
      data.dueDate = null
    } else {
      if (typeof dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 })
      }
      const parsed = new Date(`${dueDate}T00:00:00.000Z`)
      if (isNaN(parsed.getTime())) return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 })
      data.dueDate = parsed
    }
  }
  if (done !== undefined) {
    data.done = Boolean(done)
    data.doneAt = done ? new Date() : null
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 })

  try {
    const todo = await prisma.personalTodo.update({ where: { id }, data })
    if (typeof data.category === "string") await ensureCategories(current.userId, [data.category])
    return NextResponse.json({ todo })
  } catch (err) {
    console.error("[PATCH /api/personal-todos/:id]", err)
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const { error } = await ownTodo(id)
  if (error) return error
  try {
    await prisma.personalTodo.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[DELETE /api/personal-todos/:id]", err)
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}
