# Shopping List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a family shopping list with manual item entry grouped by category, a learned item→category memory, a configurable blacklist, and a per-week "push" button on the week planner that aggregates linked meal ingredients.

**Architecture:** Four new Prisma models (`ShoppingCategory`, `ShoppingItem`, `ShoppingItemMemory`, `ShoppingBlacklist`) all scoped to `familyId`. A `/shopping` page handles manual entry and list display. The week planner pushes ingredients to the list via `POST /api/shopping/generate`. All state is optimistic on the client — mutations fire and update local React state immediately.

**Tech Stack:** Next.js 16, Prisma + PostgreSQL, React (client components), CSS Modules, lucide-react icons. No new dependencies required.

**Spec:** `docs/superpowers/specs/2026-03-21-shopping-list-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add 4 new models + Family relations |
| `src/app/api/shopping/categories/route.ts` | Create | GET (with seed), POST |
| `src/app/api/shopping/categories/[id]/route.ts` | Create | PATCH (rename), DELETE |
| `src/app/api/shopping/blacklist/route.ts` | Create | GET, POST |
| `src/app/api/shopping/blacklist/[id]/route.ts` | Create | DELETE |
| `src/app/api/shopping/items/route.ts` | Create | GET, POST (with memory upsert) |
| `src/app/api/shopping/items/[id]/route.ts` | Create | PATCH (category), DELETE |
| `src/app/api/shopping/generate/route.ts` | Create | POST — aggregate week meals → list |
| `src/app/shopping/page.tsx` | Create | Shopping list UI |
| `src/app/shopping/shopping.module.css` | Create | Page styles |
| `src/components/Navbar.tsx` | Modify | Add Shopping nav link |
| `src/app/week/WeekBlock.tsx` | Modify | Add `onGenerateShopping` prop + button |
| `src/app/week/week.module.css` | Modify | Add `.generateBtn` style |
| `src/app/week/page.tsx` | Modify | Pass `onGenerateShopping` to WeekBlock |

---

## Task 1: Prisma Schema — Add Shopping Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add 4 models and Family relations to prisma/schema.prisma**

Add to `model Family { ... }` (after the existing relations):
```prisma
  shoppingCategories ShoppingCategory[]
  shoppingItems      ShoppingItem[]
  shoppingMemory     ShoppingItemMemory[]
  shoppingBlacklist  ShoppingBlacklist[]
```

Add at the bottom of the file:
```prisma
model ShoppingCategory {
  id       String  @id @default(cuid())
  familyId String
  family   Family  @relation(fields: [familyId], references: [id])
  name     String
  order    Int     @default(0)

  items    ShoppingItem[]
  memories ShoppingItemMemory[]

  @@unique([familyId, name])
}

model ShoppingItem {
  id         String            @id @default(cuid())
  familyId   String
  family     Family            @relation(fields: [familyId], references: [id])
  name       String
  quantity   String?
  categoryId String?
  category   ShoppingCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  createdAt  DateTime          @default(now())
}

model ShoppingItemMemory {
  id         String           @id @default(cuid())
  familyId   String
  family     Family           @relation(fields: [familyId], references: [id])
  itemName   String
  categoryId String
  category   ShoppingCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@unique([familyId, itemName])
}

model ShoppingBlacklist {
  id       String @id @default(cuid())
  familyId String
  family   Family @relation(fields: [familyId], references: [id])
  term     String

  @@unique([familyId, term])
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-shopping-list
```

Expected: migration created and applied, Prisma client regenerated.

- [ ] **Step 3: Verify build compiles**

```bash
npm run build
```

Expected: no TypeScript or Prisma errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add shopping list prisma models"
```

---

## Task 2: Categories API

**Files:**
- Create: `src/app/api/shopping/categories/route.ts`
- Create: `src/app/api/shopping/categories/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/shopping/categories/route.ts`**

```typescript
// src/app/api/shopping/categories/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

const DEFAULT_CATEGORIES = [
  "Fruit/Vegetables",
  "Meat",
  "Fish",
  "Milk Products",
  "Bread",
  "Condiments",
  "Sauces",
  "Drinks",
  "Frozen",
  "Nuts/Snacks",
]

const DEFAULT_BLACKLIST = [
  "oil", "vinegar", "salt", "pepper", "onion", "onions",
  "mustard", "sugar", "flour", "water", "garlic",
]

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  // Seed defaults if family has no categories yet
  const existing = await prisma.shoppingCategory.count({ where: { familyId } })
  if (existing === 0) {
    await prisma.$transaction([
      ...DEFAULT_CATEGORIES.map((name, i) =>
        prisma.shoppingCategory.create({ data: { familyId, name, order: i } })
      ),
      ...DEFAULT_BLACKLIST.map((term) =>
        prisma.shoppingBlacklist.upsert({
          where: { familyId_term: { familyId, term } },
          update: {},
          create: { familyId, term },
        })
      ),
    ])
  }

  const categories = await prisma.shoppingCategory.findMany({
    where: { familyId },
    orderBy: { order: "asc" },
  })
  return NextResponse.json({ categories })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const { name } = await request.json()
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 })
  }

  const maxOrder = await prisma.shoppingCategory.aggregate({
    where: { familyId },
    _max: { order: true },
  })
  const order = (maxOrder._max.order ?? -1) + 1

  try {
    const category = await prisma.shoppingCategory.create({
      data: { familyId, name: name.trim(), order },
    })
    return NextResponse.json(category, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Category name already exists" }, { status: 409 })
  }
}
```

- [ ] **Step 2: Create `src/app/api/shopping/categories/[id]/route.ts`**

```typescript
// src/app/api/shopping/categories/[id]/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const { id } = await params
  const { name } = await request.json()
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 })
  }

  const category = await prisma.shoppingCategory.findFirst({ where: { id, familyId } })
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await prisma.shoppingCategory.update({
    where: { id },
    data: { name: name.trim() },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const { id } = await params
  const category = await prisma.shoppingCategory.findFirst({ where: { id, familyId } })
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Null out categoryId on orphaned items (cascade handled by onDelete: SetNull)
  await prisma.shoppingCategory.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verify lint**

```bash
npm run lint
```

Expected: no errors in the new files.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/shopping/categories/
git commit -m "feat: add shopping categories API"
```

---

## Task 3: Blacklist API

**Files:**
- Create: `src/app/api/shopping/blacklist/route.ts`
- Create: `src/app/api/shopping/blacklist/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/shopping/blacklist/route.ts`**

```typescript
// src/app/api/shopping/blacklist/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const terms = await prisma.shoppingBlacklist.findMany({
    where: { familyId },
    orderBy: { term: "asc" },
  })
  return NextResponse.json({ terms })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const { term } = await request.json()
  if (!term || typeof term !== "string" || !term.trim()) {
    return NextResponse.json({ error: "term required" }, { status: 400 })
  }

  const normalized = term.trim().toLowerCase()
  try {
    const entry = await prisma.shoppingBlacklist.create({
      data: { familyId, term: normalized },
    })
    return NextResponse.json(entry, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Term already exists" }, { status: 409 })
  }
}
```

- [ ] **Step 2: Create `src/app/api/shopping/blacklist/[id]/route.ts`**

```typescript
// src/app/api/shopping/blacklist/[id]/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const { id } = await params
  const entry = await prisma.shoppingBlacklist.findFirst({ where: { id, familyId } })
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.shoppingBlacklist.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verify lint**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/shopping/blacklist/
git commit -m "feat: add shopping blacklist API"
```

---

## Task 4: Items API

**Files:**
- Create: `src/app/api/shopping/items/route.ts`
- Create: `src/app/api/shopping/items/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/shopping/items/route.ts`**

```typescript
// src/app/api/shopping/items/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const items = await prisma.shoppingItem.findMany({
    where: { familyId },
    include: { category: true },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json({ items })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const { name, quantity, categoryId } = await request.json()
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 })
  }

  // Validate categoryId belongs to this family
  if (categoryId) {
    const cat = await prisma.shoppingCategory.findFirst({ where: { id: categoryId, familyId } })
    if (!cat) return NextResponse.json({ error: "Invalid category" }, { status: 400 })
  }

  const item = await prisma.shoppingItem.create({
    data: {
      familyId,
      name: name.trim(),
      quantity: quantity?.trim() || null,
      categoryId: categoryId || null,
    },
    include: { category: true },
  })

  // Upsert memory: remember this item name → category mapping
  if (categoryId) {
    await prisma.shoppingItemMemory.upsert({
      where: { familyId_itemName: { familyId, itemName: name.trim().toLowerCase() } },
      update: { categoryId },
      create: { familyId, itemName: name.trim().toLowerCase(), categoryId },
    })
  }

  return NextResponse.json(item, { status: 201 })
}
```

- [ ] **Step 2: Create `src/app/api/shopping/items/[id]/route.ts`**

```typescript
// src/app/api/shopping/items/[id]/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const { id } = await params
  const item = await prisma.shoppingItem.findFirst({ where: { id, familyId } })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { categoryId } = await request.json()

  // Validate categoryId belongs to this family
  if (categoryId) {
    const cat = await prisma.shoppingCategory.findFirst({ where: { id: categoryId, familyId } })
    if (!cat) return NextResponse.json({ error: "Invalid category" }, { status: 400 })
  }

  const updated = await prisma.shoppingItem.update({
    where: { id },
    data: { categoryId: categoryId ?? null },
    include: { category: true },
  })

  // Update memory for this item name
  if (categoryId) {
    await prisma.shoppingItemMemory.upsert({
      where: { familyId_itemName: { familyId, itemName: item.name.toLowerCase() } },
      update: { categoryId },
      create: { familyId, itemName: item.name.toLowerCase(), categoryId },
    })
  }

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const { id } = await params
  const item = await prisma.shoppingItem.findFirst({ where: { id, familyId } })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.shoppingItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verify lint**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/shopping/items/
git commit -m "feat: add shopping items API with memory upsert"
```

---

## Task 5: Generate API

**Files:**
- Create: `src/app/api/shopping/generate/route.ts`

- [ ] **Step 1: Create `src/app/api/shopping/generate/route.ts`**

```typescript
// src/app/api/shopping/generate/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const { weekStartDate } = await request.json()
  if (!weekStartDate || typeof weekStartDate !== "string") {
    return NextResponse.json({ error: "weekStartDate required" }, { status: 400 })
  }

  const start = new Date(weekStartDate + "T00:00:00")
  const end = new Date(start)
  end.setDate(end.getDate() + 7)

  // 1. Fetch DayPlans for the week that have linked meals
  const dayPlans = await prisma.dayPlan.findMany({
    where: {
      familyId,
      date: { gte: start, lt: end },
      OR: [{ lunchMealId: { not: null } }, { dinnerMealId: { not: null } }],
    },
    include: {
      lunchMeal: { select: { ingredients: true } },
      dinnerMeal: { select: { ingredients: true } },
    },
  })

  // 2. Collect all ingredients
  const rawIngredients: string[] = []
  for (const plan of dayPlans) {
    if (plan.lunchMeal) rawIngredients.push(...plan.lunchMeal.ingredients)
    if (plan.dinnerMeal) rawIngredients.push(...plan.dinnerMeal.ingredients)
  }

  // 3. Normalize: lowercase + trim, deduplicate within this batch
  const normalized = [...new Set(rawIngredients.map((i) => i.trim().toLowerCase()).filter(Boolean))]

  // 4. Filter against blacklist (substring match)
  const blacklist = await prisma.shoppingBlacklist.findMany({ where: { familyId } })
  const blacklistTerms = blacklist.map((b) => b.term)
  const filtered = normalized.filter(
    (ingredient) => !blacklistTerms.some((term) => ingredient.includes(term))
  )

  // 5. Deduplicate against existing items
  const existingItems = await prisma.shoppingItem.findMany({
    where: { familyId },
    select: { name: true },
  })
  const existingNames = new Set(existingItems.map((i) => i.name.toLowerCase()))
  const newIngredients = filtered.filter((i) => !existingNames.has(i))

  if (newIngredients.length === 0) {
    return NextResponse.json({ added: 0 })
  }

  // 6. Look up memory for category pre-assignment
  const memories = await prisma.shoppingItemMemory.findMany({
    where: {
      familyId,
      itemName: { in: newIngredients },
    },
  })
  const memoryMap = new Map(memories.map((m) => [m.itemName, m.categoryId]))

  // 7. Bulk insert
  await prisma.shoppingItem.createMany({
    data: newIngredients.map((name) => ({
      familyId,
      name,
      categoryId: memoryMap.get(name) ?? null,
    })),
  })

  return NextResponse.json({ added: newIngredients.length })
}
```

- [ ] **Step 2: Verify lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/shopping/generate/
git commit -m "feat: add shopping list generate API"
```

---

## Task 6: Shopping Page

**Files:**
- Create: `src/app/shopping/page.tsx`
- Create: `src/app/shopping/shopping.module.css`

- [ ] **Step 1: Create `src/app/shopping/shopping.module.css`**

```css
/* src/app/shopping/shopping.module.css */

.container {
  max-width: 700px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.pageHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pageTitle {
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* ── Add form ─────────────────────────────────────────── */

.addForm {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.qtyInput {
  width: 72px;
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  font-size: 0.875rem;
  color: var(--foreground);
  outline: none;
}

.qtyInput:focus {
  border-color: var(--primary);
}

.nameInput {
  flex: 1;
  min-width: 120px;
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  font-size: 0.875rem;
  color: var(--foreground);
  outline: none;
}

.nameInput:focus {
  border-color: var(--primary);
}

.categorySelect {
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  font-size: 0.875rem;
  color: var(--foreground);
  outline: none;
  cursor: pointer;
}

.categorySelect:focus {
  border-color: var(--primary);
}

.addBtn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: none;
  background: var(--primary);
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 150ms;
  white-space: nowrap;
}

.addBtn:hover { opacity: 0.88; }
.addBtn:disabled { opacity: 0.5; cursor: not-allowed; }

.addError {
  font-size: 0.8125rem;
  color: var(--primary);
}

/* ── Item list ────────────────────────────────────────── */

.list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.group {}

.groupLabel {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--secondary);
  margin-bottom: 0.375rem;
}

.groupItems {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  border-bottom: 1px solid var(--border);
  transition: background-color 150ms;
}

.item:last-child {
  border-bottom: none;
}

.item:hover {
  background: var(--surface);
}

.checkbox {
  width: 22px;
  height: 22px;
  min-width: 22px;
  cursor: pointer;
  accent-color: var(--primary);
}

.itemQty {
  font-size: 0.8125rem;
  color: var(--secondary);
  white-space: nowrap;
}

.itemName {
  flex: 1;
  font-size: 0.9375rem;
}

.categoryPill {
  font-size: 0.72rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 150ms;
}

.categoryPill:hover {
  border-color: var(--primary);
}

.categoryPillSelect {
  font-size: 0.72rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--primary);
  color: var(--foreground);
  cursor: pointer;
  outline: none;
}

.deleteBtn {
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  color: var(--secondary);
  opacity: 0.4;
  transition: opacity 150ms;
  display: flex;
  align-items: center;
}

.deleteBtn:hover {
  opacity: 1;
}

.emptyState {
  text-align: center;
  color: var(--secondary);
  font-size: 0.9375rem;
  padding: 3rem 0;
}

/* ── Footer ───────────────────────────────────────────── */

.footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
}

.manageBtn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--foreground);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: border-color 150ms;
}

.manageBtn:hover {
  border-color: var(--primary);
}

/* ── Manage panel ─────────────────────────────────────── */

.managePanel {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.manageSection {}

.manageSectionTitle {
  font-size: 0.8125rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.manageList {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
}

.manageRow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.manageRowName {
  flex: 1;
}

.manageInput {
  flex: 1;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  font-size: 0.8125rem;
  color: var(--foreground);
  outline: none;
}

.manageInput:focus {
  border-color: var(--primary);
}

.manageAddRow {
  display: flex;
  gap: 0.5rem;
}

.manageSaveBtn {
  padding: 0.3rem 0.6rem;
  border-radius: 5px;
  border: none;
  background: var(--primary);
  color: white;
  font-size: 0.78rem;
  cursor: pointer;
  transition: opacity 150ms;
}

.manageSaveBtn:hover { opacity: 0.88; }

.manageDeleteBtn {
  background: none;
  border: none;
  padding: 0.2rem;
  cursor: pointer;
  color: var(--secondary);
  opacity: 0.45;
  display: flex;
  align-items: center;
  transition: opacity 150ms;
}

.manageDeleteBtn:hover { opacity: 1; }

@media (prefers-color-scheme: dark) {
  .categoryPill {
    background: rgba(255,255,255,0.04);
  }
}
```

- [ ] **Step 2: Create `src/app/shopping/page.tsx`**

```typescript
// src/app/shopping/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect, useRef } from "react"
import { Plus, X, Settings } from "lucide-react"
import styles from "./shopping.module.css"

type Category = { id: string; name: string; order: number }
type ShoppingItem = { id: string; name: string; quantity: string | null; categoryId: string | null; category: Category | null }
type BlacklistTerm = { id: string; term: string }

export default function ShoppingPage() {
  const { status } = useSession()
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [blacklist, setBlacklist] = useState<BlacklistTerm[]>([])
  const [loading, setLoading] = useState(true)

  // Add form
  const [qty, setQty] = useState("")
  const [name, setName] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [addError, setAddError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Inline category reassign
  const [editingCategoryFor, setEditingCategoryFor] = useState<string | null>(null)

  // Manage panel
  const [manageOpen, setManageOpen] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [newBlacklistTerm, setNewBlacklistTerm] = useState("")
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingCatName, setEditingCatName] = useState("")

  // Memory lookup: item name → categoryId
  const [memory, setMemory] = useState<Record<string, string>>({})

  useEffect(() => {
    if (status !== "authenticated") return
    Promise.all([
      fetch("/api/shopping/categories").then((r) => r.json()),
      fetch("/api/shopping/items").then((r) => r.json()),
      fetch("/api/shopping/blacklist").then((r) => r.json()),
    ]).then(([catData, itemData, blData]) => {
      setCategories(catData.categories ?? [])
      setItems(itemData.items ?? [])
      setBlacklist(blData.terms ?? [])
    }).finally(() => setLoading(false))
  }, [status])

  // Update memory index whenever items change
  useEffect(() => {
    const m: Record<string, string> = {}
    for (const item of items) {
      if (item.categoryId) m[item.name.toLowerCase()] = item.categoryId
    }
    setMemory(m)
  }, [items])

  // Auto-fill category from memory as user types the item name
  useEffect(() => {
    const key = name.trim().toLowerCase()
    if (key && memory[key]) {
      setCategoryId(memory[key])
    }
  }, [name, memory])

  const handleAdd = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!name.trim()) return
    setAddError(null)

    const optimisticItem: ShoppingItem = {
      id: `optimistic-${Date.now()}`,
      name: name.trim(),
      quantity: qty.trim() || null,
      categoryId: categoryId || null,
      category: categories.find((c) => c.id === categoryId) ?? null,
    }
    setItems((prev) => [...prev, optimisticItem])

    const savedQty = qty
    const savedName = name
    const savedCatId = categoryId
    setQty("")
    setName("")
    setCategoryId("")
    nameInputRef.current?.focus()

    try {
      const res = await fetch("/api/shopping/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: savedName.trim(), quantity: savedQty.trim() || undefined, categoryId: savedCatId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== optimisticItem.id))
        setAddError(data.error ?? "Failed to add item")
        return
      }
      setItems((prev) => prev.map((i) => (i.id === optimisticItem.id ? data : i)))
    } catch {
      setItems((prev) => prev.filter((i) => i.id !== optimisticItem.id))
      setAddError("Failed to add item")
    }
  }

  const handleDelete = async (id: string) => {
    const removed = items.find((i) => i.id === id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    try {
      const res = await fetch(`/api/shopping/items/${id}`, { method: "DELETE" })
      if (!res.ok && removed) setItems((prev) => [...prev, removed])
    } catch {
      if (removed) setItems((prev) => [...prev, removed])
    }
  }

  const handleCategoryChange = async (itemId: string, newCategoryId: string) => {
    setEditingCategoryFor(null)
    const oldItem = items.find((i) => i.id === itemId)
    const newCat = categories.find((c) => c.id === newCategoryId) ?? null
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, categoryId: newCategoryId || null, category: newCat } : i))
    try {
      const res = await fetch(`/api/shopping/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: newCategoryId || null }),
      })
      if (!res.ok && oldItem) setItems((prev) => prev.map((i) => i.id === itemId ? oldItem : i))
    } catch {
      if (oldItem) setItems((prev) => prev.map((i) => i.id === itemId ? oldItem : i))
    }
  }

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    try {
      const res = await fetch("/api/shopping/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setCategories((prev) => [...prev, data])
        setNewCatName("")
      }
    } catch { /* ignore */ }
  }

  const handleRenameCategory = async (id: string) => {
    if (!editingCatName.trim()) return
    try {
      const res = await fetch(`/api/shopping/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingCatName.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setCategories((prev) => prev.map((c) => c.id === id ? data : c))
        setEditingCatId(null)
        setEditingCatName("")
      }
    } catch { /* ignore */ }
  }

  const handleDeleteCategory = async (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id))
    setItems((prev) => prev.map((i) => i.categoryId === id ? { ...i, categoryId: null, category: null } : i))
    await fetch(`/api/shopping/categories/${id}`, { method: "DELETE" })
  }

  const handleAddBlacklist = async () => {
    if (!newBlacklistTerm.trim()) return
    try {
      const res = await fetch("/api/shopping/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: newBlacklistTerm.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setBlacklist((prev) => [...prev, data])
        setNewBlacklistTerm("")
      }
    } catch { /* ignore */ }
  }

  const handleDeleteBlacklist = async (id: string) => {
    setBlacklist((prev) => prev.filter((t) => t.id !== id))
    await fetch(`/api/shopping/blacklist/${id}`, { method: "DELETE" })
  }

  // Group items by category
  const grouped = (() => {
    const catMap = new Map<string | null, ShoppingItem[]>()
    for (const item of items) {
      const key = item.categoryId ?? null
      if (!catMap.has(key)) catMap.set(key, [])
      catMap.get(key)!.push(item)
    }
    const result: { category: Category | null; items: ShoppingItem[] }[] = []
    for (const cat of categories) {
      const catItems = catMap.get(cat.id)
      if (catItems?.length) result.push({ category: cat, items: catItems })
    }
    const uncategorized = catMap.get(null)
    if (uncategorized?.length) result.push({ category: null, items: uncategorized })
    return result
  })()

  if (status === "loading" || loading) return null

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Shopping List</h1>
      </div>

      {/* Add form */}
      <form className={styles.addForm} onSubmit={handleAdd}>
        <input
          className={styles.qtyInput}
          placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <input
          ref={nameInputRef}
          className={styles.nameInput}
          placeholder="Add item…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
        <select
          className={styles.categorySelect}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button type="submit" className={styles.addBtn} disabled={!name.trim()}>
          <Plus size={14} strokeWidth={2.5} />
          Add
        </button>
      </form>
      {addError && <p className={styles.addError}>{addError}</p>}

      {/* Item list */}
      {items.length === 0 ? (
        <p className={styles.emptyState}>No items yet. Add something above.</p>
      ) : (
        <div className={styles.list}>
          {grouped.map(({ category, items: groupItems }) => (
            <div key={category?.id ?? "uncategorized"} className={styles.group}>
              <div className={styles.groupLabel}>{category?.name ?? "Other"}</div>
              <div className={styles.groupItems}>
                {groupItems.map((item) => (
                  <div key={item.id} className={styles.item}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      onChange={() => handleDelete(item.id)}
                    />
                    {item.quantity && <span className={styles.itemQty}>{item.quantity}</span>}
                    <span className={styles.itemName}>{item.name}</span>
                    {editingCategoryFor === item.id ? (
                      <select
                        className={styles.categoryPillSelect}
                        value={item.categoryId ?? ""}
                        autoFocus
                        onBlur={() => setEditingCategoryFor(null)}
                        onChange={(e) => handleCategoryChange(item.id, e.target.value)}
                      >
                        <option value="">Other</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        className={styles.categoryPill}
                        onClick={() => setEditingCategoryFor(item.id)}
                        title="Change category"
                      >
                        {item.category?.name ?? "Other"}
                      </button>
                    )}
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(item.id)}
                      aria-label="Remove item"
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        <button className={styles.manageBtn} onClick={() => setManageOpen((v) => !v)}>
          <Settings size={13} strokeWidth={2} />
          {manageOpen ? "Close" : "Manage"}
        </button>
      </div>

      {/* Manage panel */}
      {manageOpen && (
        <div className={styles.managePanel}>
          {/* Categories */}
          <div className={styles.manageSection}>
            <div className={styles.manageSectionTitle}>Categories</div>
            <div className={styles.manageList}>
              {categories.map((cat) => (
                <div key={cat.id} className={styles.manageRow}>
                  {editingCatId === cat.id ? (
                    <>
                      <input
                        className={styles.manageInput}
                        value={editingCatName}
                        autoFocus
                        onChange={(e) => setEditingCatName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRenameCategory(cat.id) }}
                      />
                      <button className={styles.manageSaveBtn} onClick={() => handleRenameCategory(cat.id)}>Save</button>
                      <button className={styles.manageDeleteBtn} onClick={() => { setEditingCatId(null); setEditingCatName("") }}><X size={13} /></button>
                    </>
                  ) : (
                    <>
                      <span className={styles.manageRowName}>{cat.name}</span>
                      <button className={styles.manageSaveBtn} onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name) }}>Rename</button>
                      <button className={styles.manageDeleteBtn} onClick={() => handleDeleteCategory(cat.id)}><X size={13} /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className={styles.manageAddRow}>
              <input
                className={styles.manageInput}
                placeholder="New category…"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddCategory() }}
              />
              <button className={styles.manageSaveBtn} onClick={handleAddCategory}>Add</button>
            </div>
          </div>

          {/* Blacklist */}
          <div className={styles.manageSection}>
            <div className={styles.manageSectionTitle}>Blacklist (excluded from Generate)</div>
            <div className={styles.manageList}>
              {blacklist.map((entry) => (
                <div key={entry.id} className={styles.manageRow}>
                  <span className={styles.manageRowName}>{entry.term}</span>
                  <button className={styles.manageDeleteBtn} onClick={() => handleDeleteBlacklist(entry.id)}><X size={13} /></button>
                </div>
              ))}
            </div>
            <div className={styles.manageAddRow}>
              <input
                className={styles.manageInput}
                placeholder="New term…"
                value={newBlacklistTerm}
                onChange={(e) => setNewBlacklistTerm(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddBlacklist() }}
              />
              <button className={styles.manageSaveBtn} onClick={handleAddBlacklist}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify lint and build**

```bash
npm run lint && npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/shopping/
git commit -m "feat: add shopping list page"
```

---

## Task 7: Navbar — Add Shopping Link

**Files:**
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: Add ShoppingCart icon and Shopping nav link**

In `src/components/Navbar.tsx`, update the import line:
```typescript
import { Home, Calendar, CalendarDays, Settings, LogOut, UtensilsCrossed, ChevronDown, ShoppingCart } from "lucide-react"
```

Update the `navLinks` array:
```typescript
const navLinks = [
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/week", label: "Week Planner", icon: CalendarDays },
  { href: "/meals", label: "Recipes", icon: UtensilsCrossed },
  { href: "/shopping", label: "Shopping", icon: ShoppingCart },
]
```

- [ ] **Step 2: Verify lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat: add Shopping link to navbar"
```

---

## Task 8: WeekBlock — Add Generate Button

**Files:**
- Modify: `src/app/week/WeekBlock.tsx`
- Modify: `src/app/week/week.module.css`
- Modify: `src/app/week/page.tsx`

- [ ] **Step 1: Add `.generateBtn` style to `src/app/week/week.module.css`**

Add after the existing `.planBtn:disabled` rule:
```css
.generateBtn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--foreground);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 150ms;
  margin-left: auto;
}

.generateBtn:hover {
  border-color: var(--primary);
}

.generateBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 2: Update `WeekBlock.tsx` — add prop and button**

Add `onGenerateShopping` to the `Props` type:
```typescript
type Props = {
  week: WeekData
  onDayUpdate: (date: string, field: string, value: string | null) => void
  weather?: Record<string, DayWeather>
  custodyEntries?: CustodyEntry[]
  readOnly?: boolean
  id?: string
  editHref?: string
  onGenerateShopping?: (weekStartDate: string) => Promise<void>
}
```

Add state inside the component function (after the existing `useState` declarations):
```typescript
const [generating, setGenerating] = useState(false)
```

Add the handler inside the component function (before the `return`):
```typescript
const handleGenerateShopping = async () => {
  if (!onGenerateShopping) return
  setGenerating(true)
  try {
    await onGenerateShopping(week.startDate)
  } finally {
    setGenerating(false)
  }
}
```

In the JSX, update the `<h2 className={styles.weekHeader}>` block to add the button. Replace:
```typescript
      <h2 className={styles.weekHeader}>
        {formatWeekHeader(week.startDate, week.endDate)}
        {editHref && (
          <a href={editHref} className={styles.weekEditLink} aria-label="Edit this week">
            <Pencil size={13} strokeWidth={2} />
          </a>
        )}
      </h2>
```
With:
```typescript
      <h2 className={styles.weekHeader}>
        {formatWeekHeader(week.startDate, week.endDate)}
        {editHref && (
          <a href={editHref} className={styles.weekEditLink} aria-label="Edit this week">
            <Pencil size={13} strokeWidth={2} />
          </a>
        )}
        {onGenerateShopping && !readOnly && (
          <button
            className={styles.generateBtn}
            onClick={handleGenerateShopping}
            disabled={generating}
          >
            🛒 {generating ? "Adding…" : "Add to shopping list"}
          </button>
        )}
      </h2>
```

Add `ShoppingCart` import is not needed here — the emoji is used inline. No icon import change needed.

- [ ] **Step 3: Update `src/app/week/page.tsx` — wire the generate handler**

Add `useRouter` import at the top:
```typescript
import { useRouter } from "next/navigation"
```

Add inside `WeekPage` component (after the existing state declarations):
```typescript
const router = useRouter()
```

Add the handler function:
```typescript
const handleGenerateShopping = async (weekStartDate: string) => {
  const res = await fetch("/api/shopping/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weekStartDate }),
  })
  if (res.ok) {
    router.push("/shopping")
  } else {
    setError("Failed to generate shopping list.")
  }
}
```

Pass the prop to `WeekBlock`:
```typescript
<WeekBlock
  key={week.startDate}
  id={`week-${week.startDate}`}
  week={week}
  onDayUpdate={(date, field, value) =>
    handleDayUpdate(week.startDate, date, field, value)
  }
  onGenerateShopping={handleGenerateShopping}
/>
```

- [ ] **Step 4: Verify lint and build**

```bash
npm run lint && npm run build
```

Expected: no errors.

- [ ] **Step 5: Smoke test in dev**

```bash
npm run dev
```

Verify:
1. `/shopping` loads — shows empty state with add form
2. Adding an item works and it appears grouped correctly
3. Checking an item removes it immediately
4. Category pill opens inline dropdown; selecting a category updates the item
5. "Manage" opens the panel; add/rename/delete categories and blacklist terms work
6. `/week` shows "🛒 Add to shopping list" on each week block
7. Clicking generate adds items from linked meals and navigates to `/shopping`

- [ ] **Step 6: Commit**

```bash
git add src/app/week/WeekBlock.tsx src/app/week/week.module.css src/app/week/page.tsx
git commit -m "feat: add generate shopping list button to week planner"
```
