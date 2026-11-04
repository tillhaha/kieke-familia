// src/lib/personalCategories.ts
// The user's own categories/projects for the private todo list. Todos store
// their category by name; PersonalCategory rows add an optional description
// (used by the thoughts assistant) and keep empty categories around.
// Every query is scoped to a single userId.
import { prisma } from "@/lib/prisma"

export const FALLBACK_CATEGORY = "Inbox"
export const MAX_CATEGORY_LENGTH = 40
export const MAX_DESCRIPTION_LENGTH = 300

export type CategoryInfo = { id: string; name: string; description: string | null; count: number }

export function cleanCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, MAX_CATEGORY_LENGTH)
}

// Make sure every given name has a row (todos may reference names that were
// created before categories existed, or by the assistant).
export async function ensureCategories(userId: string, names: string[]): Promise<void> {
  const unique = [...new Set(names.map(cleanCategoryName).filter(Boolean))]
  if (unique.length === 0) return
  const existing = await prisma.personalCategory.findMany({ where: { userId }, select: { name: true } })
  const known = new Set(existing.map((c) => c.name.toLowerCase()))
  const missing = unique.filter((n) => !known.has(n.toLowerCase()))
  if (missing.length === 0) return
  await prisma.personalCategory.createMany({
    data: missing.map((name) => ({ userId, name })),
    skipDuplicates: true,
  })
}

// Existing spelling of a name, case-insensitively ("arbeit" → "Arbeit"), or the cleaned input.
export async function resolveCategoryName(userId: string, name: string): Promise<string> {
  const clean = cleanCategoryName(name)
  const match = await prisma.personalCategory.findFirst({
    where: { userId, name: { equals: clean, mode: "insensitive" } },
    select: { name: true },
  })
  return match?.name ?? clean
}

// All categories with their number of open items, most used first.
export async function listCategoriesWithCounts(userId: string): Promise<CategoryInfo[]> {
  const used = await prisma.personalTodo.groupBy({ by: ["category"], where: { userId }, _count: { _all: true } })
  await ensureCategories(userId, used.map((u) => u.category))

  const [rows, open] = await Promise.all([
    prisma.personalCategory.findMany({ where: { userId }, select: { id: true, name: true, description: true } }),
    prisma.personalTodo.groupBy({ by: ["category"], where: { userId, done: false }, _count: { _all: true } }),
  ])
  const counts = new Map(open.map((o) => [o.category.toLowerCase(), o._count._all]))
  return rows
    .map((r) => ({ ...r, count: counts.get(r.name.toLowerCase()) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}
