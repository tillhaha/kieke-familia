# Shopping List — Design Spec

**Date:** 2026-03-21
**Status:** Approved

---

## Overview

A family shopping list with two entry points: manual item entry on a dedicated `/shopping` page, and a per-week "push" button on the week planner that aggregates linked meal ingredients. One shared list per family. A configurable blacklist prevents pantry staples from polluting generated lists.

---

## Data Model

Four new Prisma models, all scoped to `familyId`.

### ShoppingCategory
Configurable display groups, ordered by `order`.

```prisma
model ShoppingCategory {
  id       String @id @default(cuid())
  familyId String
  family   Family @relation(fields: [familyId], references: [id])
  name     String
  order    Int
  items    ShoppingItem[]
  memories ShoppingItemMemory[]

  @@unique([familyId, name])
}
```

### ShoppingItem
Items on the active list. Checked items are deleted immediately (not flagged).

```prisma
model ShoppingItem {
  id         String            @id @default(cuid())
  familyId   String
  family     Family            @relation(fields: [familyId], references: [id])
  name       String
  quantity   String?
  categoryId String?
  category   ShoppingCategory? @relation(fields: [categoryId], references: [id])
  checked    Boolean           @default(false)
  createdAt  DateTime          @default(now())
}
```

### ShoppingItemMemory
Learned item name → category mapping. Upserted each time an item is added manually.

```prisma
model ShoppingItemMemory {
  id         String           @id @default(cuid())
  familyId   String
  family     Family           @relation(fields: [familyId], references: [id])
  itemName   String           // stored lowercased + trimmed
  categoryId String
  category   ShoppingCategory @relation(fields: [categoryId], references: [id])

  @@unique([familyId, itemName])
}
```

### ShoppingBlacklist
Terms that block ingredients from being added via Generate. Matched as substrings (case-insensitive).

```prisma
model ShoppingBlacklist {
  id       String @id @default(cuid())
  familyId String
  family   Family @relation(fields: [familyId], references: [id])
  term     String // stored lowercased + trimmed

  @@unique([familyId, term])
}
```

---

## Default Data (seeded on first `/shopping` visit)

**Default categories** (in order):
1. Fruit/Vegetables
2. Meat
3. Fish
4. Milk Products
5. Bread
6. Condiments
7. Sauces
8. Drinks
9. Frozen
10. Nuts/Snacks

**Default blacklist terms:**
`oil`, `vinegar`, `salt`, `pepper`, `onion`, `onions`, `mustard`, `sugar`, `flour`, `water`, `garlic`

Both are seeded only if the family has no existing rows in those tables.

---

## Pages

### `/shopping`

**Add form** (top of page):
`[Qty input] [Item name input] [Category dropdown] [Add button]`
- Enter key submits the form
- Category dropdown pre-selects from `ShoppingItemMemory` based on the typed item name (client-side lookup as user types)
- On submit: POST to `/api/shopping/items`, then upsert memory

**List body:**
- Items grouped by category; empty groups hidden
- Uncategorized items shown at the bottom under "Other"
- Each item row: `[22px checkbox] [qty, muted] [name] [category pill, clickable] [✕ delete]`
- Clicking the category pill opens a small inline dropdown to reassign the category; on change, PATCH `/api/shopping/items/[id]` and upsert memory
- Checking a checkbox: optimistically removes item from UI, then DELETE to API
- ✕: same DELETE, no confirmation needed

**Footer:**
- `[⚙ Manage]` button — opens inline panel for managing categories and blacklist

**Manage panel (inline, toggleable):**
- Categories section: list with rename/delete per item, add new category (no reorder UI — order set at creation time)
- Blacklist section: list of terms with delete, add new term

### `/week` — WeekBlock

Each week block gets an `🛒 Add to shopping list` button in its header (edit mode only, not read-only).
Clicking: POST `/api/shopping/generate` with the week's start date → on success, navigate to `/shopping`.

### Navbar

Add "Shopping" link pointing to `/shopping`.

---

## API Routes

All under `/api/shopping/`. All routes gate on `getServerSession` and check `familyId`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/items` | Return all unchecked items, grouped by category |
| POST | `/items` | Add item (`name`, `quantity?`, `categoryId?`); upsert `ShoppingItemMemory` |
| PATCH | `/items/[id]` | Update `categoryId` (inline reassign) |
| DELETE | `/items/[id]` | Delete item (used for both ✕ and check-off) |
| POST | `/generate` | Push week ingredients to list (see Generate Logic) |
| GET | `/categories` | List categories; seed defaults if none exist |
| POST | `/categories` | Create category (`name`, `order`) |
| PATCH | `/categories/[id]` | Rename |
| DELETE | `/categories/[id]` | Delete; set `categoryId = null` on orphaned items and memories |
| GET | `/blacklist` | List blacklist terms |
| POST | `/blacklist` | Add term |
| DELETE | `/blacklist/[id]` | Remove term |

---

## Generate Logic

Triggered by POST `/api/shopping/generate` with body `{ weekStartDate: string }`.

1. Fetch all `DayPlan` rows for the 7-day window starting at `weekStartDate` where `lunchMealId` or `dinnerMealId` is set, scoped to `familyId`
2. Load the linked `Meal` records; collect all `ingredients[]` strings
3. Normalize each: lowercase + trim
4. Filter: discard any ingredient that contains a `ShoppingBlacklist` term as a substring
5. Deduplicate: discard any ingredient whose normalized form exactly matches an existing `ShoppingItem.name` (case-insensitive). Note: meal ingredients are free-form strings (e.g. "2 tbsp olive oil") so exact-match dedup is a best-effort check — full normalization is out of scope
6. For surviving ingredients, look up `ShoppingItemMemory` to pre-assign `categoryId`
7. Bulk-insert as `ShoppingItem` rows

---

## State Management

- Client holds items in React state; mutations are optimistic (update state first, then API call)
- On error, revert state and show inline error
- Categories and blacklist are fetched once on page load; mutations update local state

---

## Error Handling

- Failed item add: show inline error below the form, keep form values
- Failed check-off/delete: revert item back into the list
- Generate failure: show error toast, do not navigate away from `/week`

---

## Out of Scope

- Ingredient quantity normalization (e.g. "2 tbsp olive oil" → "olive oil") — can be added later
- Multiple named lists
- Per-week list history
- Sharing lists outside the family
