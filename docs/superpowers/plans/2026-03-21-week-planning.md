# Week Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the disabled "Meal Planning" feature with a "Week Planning" page where families plan each day of a Sun–Sat week in an inline grid — days as columns, fields (Note, Lunch, Dinner, Activity) as rows.

**Architecture:** A `DayPlan` Prisma model (one row per day per family) replaces the unused `MealPlan`. Three API routes handle listing weeks, creating the next week, and patching a single day. The page is a vertical scroll of week grids rendered by a `WeekBlock` component; each textarea cell auto-saves on blur via PATCH.

**Tech Stack:** Next.js 16 App Router, Prisma 7 / PostgreSQL, NextAuth v4 (JWT sessions), CSS Modules, TypeScript, lucide-react

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `prisma/schema.prisma` | Modify | Remove `MealPlan`/`MealType`; add `DayPlan`, `CustodySchedule`, `CustodyLocation`; update `Family` |
| `src/app/api/weeks/route.ts` | Create | GET (all weeks) + POST (create next week) |
| `src/app/api/weeks/days/[date]/route.ts` | Create | PATCH (update one day's fields) |
| `src/app/week/WeekBlock.tsx` | Create | Single-week grid component with per-cell auto-save |
| `src/app/week/page.tsx` | Create | Page: loads weeks, "Plan next week" button, renders WeekBlock list |
| `src/app/week/week.module.css` | Create | All styles for the week planning page |
| `src/components/Navbar.tsx` | Modify | `/meals` → `/week`, label, icon, enabled |
| `src/app/page.tsx` | Modify | Update "Meal Planning" feature card to "Week planning" |

---

## Task 1: Update Prisma schema and migrate

**Files:**
- Modify: `prisma/schema.prisma`

**Context:** The current schema has unused `MealPlan` + `MealType` models. We replace them with `DayPlan` (all planning fields per day) and add `CustodySchedule` (schema only, no API/UI yet). `@db.Date` stores date-only values in PostgreSQL.

- [ ] **Step 1: Open `prisma/schema.prisma` and make the following changes**

  **Remove** the `MealPlan` model (lines 82–91) and `MealType` enum (lines 93–96) entirely.

  **Replace** the `Family` model with:
  ```prisma
  model Family {
    id               String            @id @default(cuid())
    name             String
    users            User[]
    birthdays        Birthday[]
    dayPlans         DayPlan[]
    custodySchedule  CustodySchedule[]
  }
  ```

  **Add** these models and enum at the end of the file (after `CalendarSync`):
  ```prisma
  model DayPlan {
    id             String   @id @default(cuid())
    date           DateTime @db.Date
    note           String?
    lunch          String?
    dinner         String?
    dinnerActivity String?
    familyId       String
    family         Family   @relation(fields: [familyId], references: [id])

    @@unique([date, familyId])
  }

  enum CustodyLocation {
    WITH_US
    WITH_MONA
  }

  model CustodySchedule {
    id         String          @id @default(cuid())
    date       DateTime        @db.Date
    personName String
    location   CustodyLocation
    familyId   String
    family     Family          @relation(fields: [familyId], references: [id])

    @@unique([date, personName, familyId])
  }
  ```

- [ ] **Step 2: Run the migration**

  ```bash
  cd /Users/till/Development/familia
  npx prisma migrate dev --name add-week-planning
  ```

  Expected: Migration created and applied. Prisma client regenerated.

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: No errors. (The removed `MealPlan` import in no files — it was never used in routes.)

- [ ] **Step 4: Commit**

  ```bash
  git add prisma/schema.prisma prisma/migrations/
  git commit -m "feat: replace MealPlan with DayPlan + CustodySchedule schema"
  ```

---

## Task 2: GET + POST /api/weeks

**Files:**
- Create: `src/app/api/weeks/route.ts`

**Context:**
- GET returns all DayPlans grouped into Sun–Sat week objects, newest first.
- POST creates 7 blank DayPlan rows for the next unplanned week.
- Auth: `getServerSession(authOptions)` from `next-auth/next`. User's `familyId` is on `(session.user as any).familyId`.
- `@db.Date` stores dates as UTC midnight. When creating dates for the 7 days, use `new Date(\`${dateStr}T00:00:00.000Z\`)`.

- [ ] **Step 1: Create `src/app/api/weeks/route.ts`**

  ```typescript
  // src/app/api/weeks/route.ts
  import { getServerSession } from "next-auth/next"
  import { authOptions } from "@/lib/auth"
  import { prisma } from "@/lib/prisma"
  import { NextResponse } from "next/server"

  // Returns the ISO date string (YYYY-MM-DD) of the Sunday starting the week
  // that contains `date`. getDay() returns 0 for Sunday, so no shift needed.
  function weekSunday(date: Date): string {
    const d = new Date(date)
    d.setUTCDate(d.getUTCDate() - d.getUTCDay())
    return d.toISOString().split("T")[0]
  }

  function toDateStr(date: Date): string {
    return date.toISOString().split("T")[0]
  }

  export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const familyId = (session.user as any).familyId as string | undefined
    if (!familyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    try {
      const dayPlans = await prisma.dayPlan.findMany({
        where: { familyId },
        orderBy: { date: "desc" },
      })

      // Group by Sun–Sat week
      const weekMap = new Map<string, typeof dayPlans>()
      for (const plan of dayPlans) {
        const sunday = weekSunday(plan.date)
        if (!weekMap.has(sunday)) weekMap.set(sunday, [])
        weekMap.get(sunday)!.push(plan)
      }

      // Sort weeks newest first
      const sortedSundays = Array.from(weekMap.keys()).sort((a, b) =>
        b.localeCompare(a)
      )

      const weeks = sortedSundays.map((sunday) => {
        const days = weekMap.get(sunday)!
        // Sort days Sun → Sat
        days.sort((a, b) => a.date.getTime() - b.date.getTime())
        const endDate = new Date(sunday + "T00:00:00.000Z")
        endDate.setUTCDate(endDate.getUTCDate() + 6)
        return {
          startDate: sunday,
          endDate: toDateStr(endDate),
          days: days.map((d) => ({
            id: d.id,
            date: toDateStr(d.date),
            note: d.note,
            lunch: d.lunch,
            dinner: d.dinner,
            dinnerActivity: d.dinnerActivity,
          })),
        }
      })

      return NextResponse.json({ weeks })
    } catch {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }

  export async function POST() {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const familyId = (session.user as any).familyId as string | undefined
    if (!familyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    try {
      // Find the latest planned day
      const latest = await prisma.dayPlan.findFirst({
        where: { familyId },
        orderBy: { date: "desc" },
      })

      let nextSunday: Date
      if (latest) {
        // Sunday of latest date's week + 7 days = next week's Sunday
        const latestDate = new Date(latest.date)
        const latestSunday = new Date(latestDate)
        latestSunday.setUTCDate(latestDate.getUTCDate() - latestDate.getUTCDay())
        nextSunday = new Date(latestSunday)
        nextSunday.setUTCDate(latestSunday.getUTCDate() + 7)
      } else {
        // No plans yet: find the upcoming Sunday (today if today is Sunday)
        const today = new Date()
        today.setUTCHours(0, 0, 0, 0)
        const daysUntilSunday = (7 - today.getUTCDay()) % 7
        nextSunday = new Date(today)
        nextSunday.setUTCDate(today.getUTCDate() + daysUntilSunday)
      }

      // Build the 7 dates (Sun–Sat)
      const nextWeekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(nextSunday)
        d.setUTCDate(nextSunday.getUTCDate() + i)
        return d
      })

      // Check if already fully planned
      const existingCount = await prisma.dayPlan.count({
        where: {
          familyId,
          date: { in: nextWeekDates },
        },
      })
      if (existingCount === 7) {
        return NextResponse.json(
          { error: "Next week already planned" },
          { status: 409 }
        )
      }

      // Create 7 blank days
      await prisma.dayPlan.createMany({
        data: nextWeekDates.map((d) => ({ date: d, familyId })),
        skipDuplicates: true,
      })

      // Fetch and return the newly created week
      const created = await prisma.dayPlan.findMany({
        where: { familyId, date: { in: nextWeekDates } },
        orderBy: { date: "asc" },
      })

      const endDate = new Date(nextSunday)
      endDate.setUTCDate(nextSunday.getUTCDate() + 6)

      const week = {
        startDate: toDateStr(nextSunday),
        endDate: toDateStr(endDate),
        days: created.map((d) => ({
          id: d.id,
          date: toDateStr(d.date),
          note: d.note,
          lunch: d.lunch,
          dinner: d.dinner,
          dinnerActivity: d.dinnerActivity,
        })),
      }

      return NextResponse.json({ week }, { status: 201 })
    } catch {
      return NextResponse.json({ error: "Failed to create week" }, { status: 500 })
    }
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/api/weeks/route.ts
  git commit -m "feat: add GET + POST /api/weeks endpoints"
  ```

---

## Task 3: PATCH /api/weeks/days/[date]

**Files:**
- Create: `src/app/api/weeks/days/[date]/route.ts`

**Context:**
- `[date]` is a `YYYY-MM-DD` string in the URL (e.g. `/api/weeks/days/2026-03-22`).
- In Next.js 16 App Router, dynamic route params are a `Promise` — use `await params`.
- The Prisma unique constraint `@@unique([date, familyId])` generates the compound accessor `date_familyId` for `where` clauses.
- Any subset of fields may be in the body. A field set to `""` (empty string) should be saved as `null`.

- [ ] **Step 1: Create `src/app/api/weeks/days/[date]/route.ts`**

  ```typescript
  // src/app/api/weeks/days/[date]/route.ts
  import { getServerSession } from "next-auth/next"
  import { authOptions } from "@/lib/auth"
  import { prisma } from "@/lib/prisma"
  import { NextResponse } from "next/server"

  type Params = { params: Promise<{ date: string }> }

  export async function PATCH(request: Request, { params }: Params) {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const familyId = (session.user as any).familyId as string | undefined
    if (!familyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { date: dateStr } = await params
    const parsedDate = new Date(`${dateStr}T00:00:00.000Z`)
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { note, lunch, dinner, dinnerActivity } = body as Record<string, unknown>

    // Only include fields that were explicitly sent
    const updates: Record<string, string | null> = {}
    if (note !== undefined) updates.note = typeof note === "string" && note !== "" ? note : null
    if (lunch !== undefined) updates.lunch = typeof lunch === "string" && lunch !== "" ? lunch : null
    if (dinner !== undefined) updates.dinner = typeof dinner === "string" && dinner !== "" ? dinner : null
    if (dinnerActivity !== undefined)
      updates.dinnerActivity =
        typeof dinnerActivity === "string" && dinnerActivity !== "" ? dinnerActivity : null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    let dayPlan
    try {
      dayPlan = await prisma.dayPlan.findUnique({
        where: { date_familyId: { date: parsedDate, familyId } },
      })
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (!dayPlan) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    try {
      const updated = await prisma.dayPlan.update({
        where: { date_familyId: { date: parsedDate, familyId } },
        data: updates,
      })
      return NextResponse.json(updated)
    } catch {
      return NextResponse.json({ error: "Failed to update day" }, { status: 500 })
    }
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/api/weeks/days/
  git commit -m "feat: add PATCH /api/weeks/days/[date] endpoint"
  ```

---

## Task 4: WeekBlock component

**Files:**
- Create: `src/app/week/WeekBlock.tsx`

**Context:**
- One component per week. Receives `week` data and a callback `onDayUpdate` for when a PATCH succeeds.
- Local state: `drafts` (current textarea values), `cellErrors` (keys of cells with a save error), `saving` (keys currently being saved).
- Cell key format: `"${date}:${field}"` (e.g. `"2026-03-22:note"`).
- On blur: if the current draft differs from the saved value, PATCH. On success call `onDayUpdate`. On error: revert draft, mark error for 2 s.
- Past week = all 7 days are before today → all textareas disabled.
- The grid structure: `<table>` with a header row (day name + date number) and 4 body rows (Note, Lunch, Dinner, Activity). The first column is a `<th>` row label.

- [ ] **Step 1: Create `src/app/week/WeekBlock.tsx`**

  ```tsx
  // src/app/week/WeekBlock.tsx
  "use client"

  import { useState, useCallback } from "react"
  import styles from "./week.module.css"

  export type DayData = {
    id: string
    date: string // YYYY-MM-DD
    note: string | null
    lunch: string | null
    dinner: string | null
    dinnerActivity: string | null
  }

  export type WeekData = {
    startDate: string
    endDate: string
    days: DayData[]
  }

  type Props = {
    week: WeekData
    onDayUpdate: (date: string, field: string, value: string | null) => void
  }

  type Field = "note" | "lunch" | "dinner" | "dinnerActivity"

  const ROWS: { field: Field; label: string; placeholder: string }[] = [
    { field: "note", label: "Note", placeholder: "Add a note…" },
    { field: "lunch", label: "Lunch", placeholder: "Lunch…" },
    { field: "dinner", label: "Dinner", placeholder: "Dinner…" },
    { field: "dinnerActivity", label: "Activity", placeholder: "Activity…" },
  ]

  function formatWeekHeader(startDate: string, endDate: string): string {
    const fmt = (s: string) =>
      new Date(s + "T00:00:00").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })
    const year = new Date(endDate + "T00:00:00").getFullYear()
    return `${fmt(startDate)} – ${fmt(endDate)}, ${year}`
  }

  function formatDayHeader(dateStr: string): { weekday: string; day: number } {
    const d = new Date(dateStr + "T00:00:00")
    return {
      weekday: d.toLocaleDateString("en-GB", { weekday: "short" }),
      day: d.getDate(),
    }
  }

  function isPastWeek(endDate: string): boolean {
    const end = new Date(endDate + "T00:00:00")
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return end < today
  }

  export function WeekBlock({ week, onDayUpdate }: Props) {
    const past = isPastWeek(week.endDate)

    // Initialise drafts from saved data
    const [drafts, setDrafts] = useState<Record<string, string>>(() => {
      const init: Record<string, string> = {}
      for (const day of week.days) {
        for (const { field } of ROWS) {
          init[`${day.date}:${field}`] = day[field] ?? ""
        }
      }
      return init
    })

    const [cellErrors, setCellErrors] = useState<Set<string>>(new Set())
    const [saving, setSaving] = useState<Set<string>>(new Set())

    const getSaved = useCallback(
      (date: string, field: Field): string => {
        const day = week.days.find((d) => d.date === date)
        return day?.[field] ?? ""
      },
      [week]
    )

    const handleChange = (key: string, value: string) => {
      setDrafts((prev) => ({ ...prev, [key]: value }))
    }

    const handleBlur = async (date: string, field: Field) => {
      const key = `${date}:${field}`
      const current = drafts[key] ?? ""
      const saved = getSaved(date, field)
      if (current === saved) return

      setSaving((prev) => new Set(prev).add(key))
      try {
        const res = await fetch(`/api/weeks/days/${date}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: current || null }),
        })
        if (!res.ok) throw new Error()
        onDayUpdate(date, field, current || null)
      } catch {
        // Revert to saved value
        setDrafts((prev) => ({ ...prev, [key]: saved }))
        setCellErrors((prev) => {
          const next = new Set(prev).add(key)
          setTimeout(() => {
            setCellErrors((p) => {
              const n = new Set(p)
              n.delete(key)
              return n
            })
          }, 2000)
          return next
        })
      } finally {
        setSaving((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      }
    }

    return (
      <div className={styles.weekBlock}>
        <h2 className={styles.weekHeader}>
          {formatWeekHeader(week.startDate, week.endDate)}
        </h2>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.cornerCell} />
                {week.days.map((day) => {
                  const { weekday, day: dayNum } = formatDayHeader(day.date)
                  return (
                    <th key={day.date} className={styles.dayHeader}>
                      <span className={styles.dayName}>{weekday}</span>
                      <span className={styles.dayNum}>{dayNum}</span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(({ field, label, placeholder }) => (
                <tr key={field}>
                  <td className={styles.rowLabel}>{label}</td>
                  {week.days.map((day) => {
                    const key = `${day.date}:${field}`
                    const hasError = cellErrors.has(key)
                    return (
                      <td
                        key={day.date}
                        className={`${styles.cell} ${hasError ? styles.cellError : ""}`}
                      >
                        <textarea
                          className={styles.cellInput}
                          value={drafts[key] ?? ""}
                          placeholder={placeholder}
                          disabled={past || saving.has(key)}
                          rows={2}
                          onChange={(e) => handleChange(key, e.target.value)}
                          onBlur={() => handleBlur(day.date, field)}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/week/WeekBlock.tsx
  git commit -m "feat: add WeekBlock grid component with auto-save"
  ```

---

## Task 5: Week page + CSS

**Files:**
- Create: `src/app/week/page.tsx`
- Create: `src/app/week/week.module.css`

**Context:**
- The page fetches all weeks on mount, shows a "Plan next week" button at the top, and renders a `WeekBlock` per week.
- `onDayUpdate` callback keeps the `weeks` state in sync after a successful PATCH without refetching.
- CSS uses the same design tokens as the rest of the app: `var(--border)`, `var(--surface)`, `var(--foreground)`, `var(--secondary)`, `var(--primary)`, `var(--radius)`, `var(--background)`, `var(--surface-hover)`.
- The table needs `table-layout: fixed` with the label column at fixed width and 7 equal day columns.

- [ ] **Step 1: Create `src/app/week/week.module.css`**

  ```css
  /* src/app/week/week.module.css */

  .container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
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

  .planBtn {
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
  }

  .planBtn:hover {
    opacity: 0.88;
  }

  .planBtn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .weeksList {
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
  }

  .emptyState {
    font-size: 0.9375rem;
    color: var(--secondary);
    padding: 2rem 0;
    text-align: center;
  }

  /* ── Week Block ───────────────────────────────────────── */

  .weekBlock {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .weekHeader {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--secondary);
    letter-spacing: 0.01em;
  }

  .tableWrapper {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  /* Label column width; 7 day columns share the rest equally */
  .cornerCell,
  .rowLabel {
    width: 80px;
    min-width: 80px;
  }

  /* ── Header row ───────────────────────────────────────── */

  .cornerCell {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    border-right: 1px solid var(--border);
  }

  .dayHeader {
    background: var(--surface);
    padding: 0.5rem 0.375rem;
    text-align: center;
    border-bottom: 1px solid var(--border);
    border-right: 1px solid var(--border);
    vertical-align: middle;
  }

  .dayHeader:last-child {
    border-right: none;
  }

  .dayName {
    display: block;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--secondary);
  }

  .dayNum {
    display: block;
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--foreground);
    margin-top: 0.1rem;
  }

  /* ── Body rows ────────────────────────────────────────── */

  .rowLabel {
    padding: 0.5rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: var(--surface);
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
    white-space: nowrap;
  }

  tr:last-child .rowLabel,
  tr:last-child .cell {
    border-bottom: none;
  }

  .cell {
    padding: 0;
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    vertical-align: top;
    transition: background-color 150ms;
  }

  .cell:last-child {
    border-right: none;
  }

  .cell:focus-within {
    background: var(--surface);
  }

  .cellError {
    background: #fef2f2;
  }

  @media (prefers-color-scheme: dark) {
    .cellError {
      background: #2d0a0a;
    }
  }

  .cellInput {
    display: block;
    width: 100%;
    min-height: 56px;
    padding: 0.4rem 0.5rem;
    border: none;
    background: transparent;
    color: var(--foreground);
    font-size: 0.8125rem;
    font-family: inherit;
    resize: none;
    outline: none;
    line-height: 1.45;
  }

  .cellInput::placeholder {
    color: var(--secondary);
    opacity: 0.45;
  }

  .cellInput:disabled {
    cursor: default;
    opacity: 0.6;
  }
  ```

- [ ] **Step 2: Create `src/app/week/page.tsx`**

  ```tsx
  // src/app/week/page.tsx
  "use client"

  import { useSession } from "next-auth/react"
  import { useState, useEffect } from "react"
  import { Plus } from "lucide-react"
  import { WeekBlock, WeekData } from "./WeekBlock"
  import styles from "./week.module.css"

  export default function WeekPage() {
    const { status } = useSession()
    const [weeks, setWeeks] = useState<WeekData[]>([])
    const [loading, setLoading] = useState(true)
    const [planning, setPlanning] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
      if (status !== "authenticated") return
      fetch("/api/weeks")
        .then((r) => r.json())
        .then((data) => setWeeks(data.weeks ?? []))
        .catch(() => setError("Failed to load weeks."))
        .finally(() => setLoading(false))
    }, [status])

    const handlePlanNextWeek = async () => {
      setPlanning(true)
      setError(null)
      try {
        const res = await fetch("/api/weeks", { method: "POST" })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? "Failed to create week.")
          return
        }
        setWeeks((prev) => [data.week, ...prev])
      } catch {
        setError("Failed to create week.")
      } finally {
        setPlanning(false)
      }
    }

    const handleDayUpdate = (
      weekStart: string,
      date: string,
      field: string,
      value: string | null
    ) => {
      setWeeks((prev) =>
        prev.map((w) =>
          w.startDate === weekStart
            ? {
                ...w,
                days: w.days.map((d) =>
                  d.date === date ? { ...d, [field]: value } : d
                ),
              }
            : w
        )
      )
    }

    if (status === "loading" || loading) return null

    return (
      <div className={styles.container}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Week planning</h1>
          <button
            className={styles.planBtn}
            onClick={handlePlanNextWeek}
            disabled={planning}
          >
            <Plus size={14} strokeWidth={2.5} />
            {planning ? "Planning…" : "Plan next week"}
          </button>
        </div>

        {error && <p style={{ color: "var(--primary)", fontSize: "0.875rem" }}>{error}</p>}

        {weeks.length === 0 ? (
          <p className={styles.emptyState}>
            No weeks planned yet. Click "Plan next week" to get started.
          </p>
        ) : (
          <div className={styles.weeksList}>
            {weeks.map((week) => (
              <WeekBlock
                key={week.startDate}
                week={week}
                onDayUpdate={(date, field, value) =>
                  handleDayUpdate(week.startDate, date, field, value)
                }
              />
            ))}
          </div>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/week/
  git commit -m "feat: add week planning page and WeekBlock grid component"
  ```

---

## Task 6: Navigation and home page

**Files:**
- Modify: `src/components/Navbar.tsx`
- Modify: `src/app/page.tsx`

**Context:**
- Navbar currently imports `UtensilsCrossed` and has `{ href: "/meals", label: "Meals", icon: UtensilsCrossed, enabled: false }`.
- Replace with `CalendarDays` icon (already in lucide-react), route `/week`, label `"Week planning"`, enabled `true`.
- Home page has a `UtensilsCrossed` card for "Meal Planning" — update icon, title, description, href, and enabled flag.

- [ ] **Step 1: Update `src/components/Navbar.tsx`**

  Change the import line from:
  ```typescript
  import { Home, Calendar, UtensilsCrossed, Briefcase, Settings, LogOut } from "lucide-react"
  ```
  To:
  ```typescript
  import { Home, Calendar, CalendarDays, Briefcase, Settings, LogOut } from "lucide-react"
  ```

  Change the navLinks entry from:
  ```typescript
  { href: "/meals", label: "Meals", icon: UtensilsCrossed, enabled: false },
  ```
  To:
  ```typescript
  { href: "/week", label: "Week planning", icon: CalendarDays, enabled: true },
  ```

- [ ] **Step 2: Update `src/app/page.tsx`**

  Change the import line from:
  ```typescript
  import { Calendar, UtensilsCrossed, Briefcase, LogIn } from "lucide-react"
  ```
  To:
  ```typescript
  import { Calendar, CalendarDays, Briefcase, LogIn } from "lucide-react"
  ```

  Change the features array entry from:
  ```typescript
  {
    icon: UtensilsCrossed,
    title: "Meal Planning",
    description: "Plan weekly meals together.",
    href: "#",
    enabled: false,
  },
  ```
  To:
  ```typescript
  {
    icon: CalendarDays,
    title: "Week planning",
    description: "Plan the week ahead together.",
    href: "/week",
    enabled: true,
  },
  ```

- [ ] **Step 3: Run full build to verify everything compiles and routes resolve**

  ```bash
  cd /Users/till/Development/familia && npm run build
  ```

  Expected: Build succeeds with no TypeScript errors. You should see routes for `/week`, `/api/weeks`, and `/api/weeks/days/[date]` listed in the output.

- [ ] **Step 4: Smoke test manually**

  ```
  npm run dev
  ```

  1. Navigate to http://localhost:3000 — confirm "Week planning" card is visible and linked
  2. Click the nav link — confirm the week page loads with empty state message
  3. Click "Plan next week" — confirm a week block appears with 4 rows × 7 columns
  4. Type in a cell, click away — confirm the value persists after page refresh
  5. Click "Plan next week" again — confirm a second (older) week appears below the first

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/Navbar.tsx src/app/page.tsx
  git commit -m "feat: enable week planning in nav and home page"
  ```
