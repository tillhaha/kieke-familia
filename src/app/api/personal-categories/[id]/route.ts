// src/app/api/personal-categories/[id]/route.ts
// Rename / describe / delete one of the user's own categories. Todos store the
// category by name, so renames and deletes move the user's todos along.
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { FALLBACK_CATEGORY, MAX_DESCRIPTION_LENGTH, cleanCategoryName, ensureCategories } from "@/lib/personalCategories"

type Params = { params: Promise<{ id: string }> }

async function ownCategory(id: string) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const category = await prisma.personalCategory.findUnique({ where: { id } })
  if (!category || category.userId !== userId) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  return { category, userId }
}

// Body: { name?, description? }. Renaming onto another existing category merges
// the two (todos move over, this one is removed) and returns { merged: true }.
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const { category, userId, error } = await ownCategory(id)
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { name, description } = (body ?? {}) as Record<string, unknown>

  const data: { name?: string; description?: string | null } = {}
  if (description !== undefined) {
    data.description = typeof description === "string" && description.trim() ? description.trim().slice(0, MAX_DESCRIPTION_LENGTH) : null
  }
  if (name !== undefined) {
    if (typeof name !== "string" || !cleanCategoryName(name)) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
    data.name = cleanCategoryName(name)
  }

  try {
    const newName = data.name
    if (newName && newName !== category.name) {
      const other = await prisma.personalCategory.findFirst({
        where: { userId, id: { not: id }, name: { equals: newName, mode: "insensitive" } },
      })
      if (other) {
        // Merge into the existing category
        await prisma.$transaction([
          prisma.personalTodo.updateMany({ where: { userId, category: category.name }, data: { category: other.name } }),
          ...(data.description !== undefined && !other.description
            ? [prisma.personalCategory.update({ where: { id: other.id }, data: { description: data.description } })]
            : []),
          prisma.personalCategory.delete({ where: { id } }),
        ])
        return NextResponse.json({ merged: true, into: other.name })
      }
    }

    const [updated] = await prisma.$transaction([
      prisma.personalCategory.update({ where: { id }, data, select: { id: true, name: true, description: true } }),
      ...(newName && newName !== category.name
        ? [prisma.personalTodo.updateMany({ where: { userId, category: category.name }, data: { category: newName } })]
        : []),
    ])
    return NextResponse.json({ category: updated })
  } catch (err) {
    console.error("[PATCH /api/personal-categories/:id]", err)
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }
}

// Removes the category; its todos (open and done) move to the Inbox.
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const { category, userId, error } = await ownCategory(id)
  if (error) return error

  try {
    const used = await prisma.personalTodo.count({ where: { userId, category: category.name } })
    if (used > 0 && category.name.toLowerCase() === FALLBACK_CATEGORY.toLowerCase()) {
      return NextResponse.json({ error: "Move the items out of the Inbox first" }, { status: 400 })
    }
    if (used > 0) await ensureCategories(userId, [FALLBACK_CATEGORY])
    const inbox = await prisma.personalCategory.findFirst({
      where: { userId, name: { equals: FALLBACK_CATEGORY, mode: "insensitive" } },
      select: { name: true },
    })
    await prisma.$transaction([
      prisma.personalTodo.updateMany({ where: { userId, category: category.name }, data: { category: inbox?.name ?? FALLBACK_CATEGORY } }),
      prisma.personalCategory.delete({ where: { id } }),
    ])
    return NextResponse.json({ ok: true, moved: used })
  } catch (err) {
    console.error("[DELETE /api/personal-categories/:id]", err)
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}
