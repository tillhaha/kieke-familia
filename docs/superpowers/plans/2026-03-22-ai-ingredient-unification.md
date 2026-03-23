# AI Ingredient Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual blacklist-filter + exact-match dedup in the generate route with a Claude API call that normalises ingredients, merges duplicates, keeps similar-but-different items adjacent, and removes blacklisted terms.

**Architecture:** Three small changes — add `sortOrder` to the schema so Claude's ordering is preserved, rewrite the core of `generate/route.ts` to call Claude, and update the GET /items query to respect that order.

**Tech Stack:** Next.js 16 App Router, Prisma + PostgreSQL, `@anthropic-ai/sdk` (already installed), `zod` (already installed).

---

### Task 1: Add `sortOrder` to ShoppingItem schema

**Files:**
- Modify: `prisma/schema.prisma`

The `ShoppingItem` model needs a `sortOrder` field so generated items can be returned in the order Claude decided.

- [ ] **Step 1: Add the field**

In `prisma/schema.prisma`, find the `ShoppingItem` model and add `sortOrder Int @default(0)` before the `createdAt` field:

```prisma
model ShoppingItem {
  id         String            @id @default(cuid())
  familyId   String
  family     Family            @relation(fields: [familyId], references: [id])
  name       String
  quantity   String?
  categoryId String?
  category   ShoppingCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  sortOrder  Int               @default(0)
  createdAt  DateTime          @default(now())

  @@index([familyId])
}
```

- [ ] **Step 2: Push schema to DB**

```bash
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Verify build still passes**

```bash
npm run build 2>&1 | tail -5
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add sortOrder to ShoppingItem for AI-ordered generate"
```

---

### Task 2: Replace generate logic with Claude API call

**Files:**
- Modify: `src/app/api/shopping/generate/route.ts`

Replace steps 3–7 (normalise, blacklist filter, dedup, memory lookup, bulk insert) with:
1. Fetch raw ingredients + blacklist terms
2. Call Claude to normalise/merge/filter/order
3. Dedup against existing items (still needed — Claude doesn't know what's already on the list)
4. Look up memory for category pre-assignment
5. Insert items sequentially in Claude's order, assigning `sortOrder` from array index

The Claude call uses `zodOutputFormat` (same pattern as `src/app/api/meals/parse/route.ts`).

Look at `src/app/api/meals/parse/route.ts` to understand the `zodOutputFormat` + `client.messages.parse` pattern before implementing.

**Current generate route for reference** (`src/app/api/shopping/generate/route.ts` lines 1–97):
- Auth + familyId check (keep as-is)
- weekStartDate validation (keep as-is)
- DayPlan fetch + ingredient collection (keep as-is)
- Steps 3–7: replace entirely

**Replacement for steps 3–7:**

```typescript
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"

const client = new Anthropic()

const UnifiedSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.string().nullable(),
    })
  ),
})
```

After collecting `rawIngredients`:

```typescript
  if (rawIngredients.length === 0) {
    return NextResponse.json({ added: 0 })
  }

  // Fetch blacklist
  const blacklist = await prisma.shoppingBlacklist.findMany({ where: { familyId } })
  const blacklistTerms = blacklist.map((b) => b.term)

  // Call Claude to normalise, merge, filter, and order ingredients
  let unified: Array<{ name: string; quantity: string | null }>
  try {
    const response = await client.messages.parse({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      output_config: {
        format: zodOutputFormat(UnifiedSchema),
      },
      system: `You are a shopping list assistant. Given a list of raw meal ingredients, return a clean, unified shopping list.

Rules:
- Remove any ingredient that contains one of the blacklist terms as a substring (case-insensitive).
- Merge clearly identical ingredients (e.g. "2 chicken breasts" and "3 chicken pieces" → one "chicken breast" entry).
- For similar-but-potentially-different ingredients (e.g. "potatoes" and "small potatoes"), keep both but place them adjacent in the list.
- Strip quantities and units from the name field — put them in the quantity field (null if none).
- Normalise names to lowercase, singular where natural (e.g. "tomatoes" → "tomato").
- Return items in a logical shopping order (produce together, proteins together, etc.).`,
      messages: [
        {
          role: "user",
          content: `Blacklist terms: ${blacklistTerms.length > 0 ? blacklistTerms.join(", ") : "(none)"}

Ingredients:
${rawIngredients.map((i) => `- ${i}`).join("\n")}`,
        },
      ],
    })

    if (!response.parsed_output) {
      return NextResponse.json({ error: "AI unification failed" }, { status: 500 })
    }
    unified = response.parsed_output.items
  } catch (err) {
    console.error("[generate] Claude unification error:", err)
    return NextResponse.json({ error: "AI unification failed" }, { status: 500 })
  }

  if (unified.length === 0) {
    return NextResponse.json({ added: 0 })
  }

  // Deduplicate against existing items on the list
  const existingItems = await prisma.shoppingItem.findMany({
    where: { familyId },
    select: { name: true },
  })
  const existingNames = new Set(existingItems.map((i) => i.name.toLowerCase()))
  const newIngredients = unified.filter((i) => !existingNames.has(i.name.toLowerCase()))

  if (newIngredients.length === 0) {
    return NextResponse.json({ added: 0 })
  }

  // Look up memory for category pre-assignment
  const memories = await prisma.shoppingItemMemory.findMany({
    where: {
      familyId,
      itemName: { in: newIngredients.map((i) => i.name) },
    },
  })
  const memoryMap = new Map(memories.map((m) => [m.itemName, m.categoryId]))

  // Determine starting sortOrder (append after existing items)
  const maxSortOrder = await prisma.shoppingItem.aggregate({
    where: { familyId },
    _max: { sortOrder: true },
  })
  const baseOrder = (maxSortOrder._max.sortOrder ?? -1) + 1

  // Insert items in Claude's order, assigning sortOrder
  try {
    await prisma.shoppingItem.createMany({
      data: newIngredients.map((item, index) => ({
        familyId: familyId as string,
        name: item.name,
        quantity: item.quantity ?? null,
        categoryId: memoryMap.get(item.name) ?? null,
        sortOrder: baseOrder + index,
      })),
    })
  } catch (error: unknown) {
    console.error("Shopping generate insert error:", error)
    return NextResponse.json({ error: "Failed to add items" }, { status: 500 })
  }

  return NextResponse.json({ added: newIngredients.length })
```

- [ ] **Step 1: Rewrite `src/app/api/shopping/generate/route.ts`** using the code above. Keep the top section (auth, familyId, weekStartDate parsing, DayPlan fetch, rawIngredients collection) unchanged. Replace everything from the comment `// 3. Normalize` to the end.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors, `/api/shopping/generate` appears in route list.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/shopping/generate/route.ts
git commit -m "feat: use Claude to normalise and unify ingredients in generate route"
```

---

### Task 3: Respect `sortOrder` in GET /items

**Files:**
- Modify: `src/app/api/shopping/items/route.ts`

The GET handler currently orders by `createdAt: "asc"`. Update to `[{ sortOrder: "asc" }, { createdAt: "asc" }]` so Claude's within-category ordering (e.g. "potatoes" next to "small potatoes") is respected.

- [ ] **Step 1: Update the orderBy in GET /items**

In `src/app/api/shopping/items/route.ts`, change line 15:

```typescript
// Before
orderBy: { createdAt: "asc" },

// After
orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/shopping/items/route.ts
git commit -m "feat: order shopping items by sortOrder then createdAt"
```
