# Custody Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a custody schedule feature to the calendar page so parents can track where Emilia sleeps each night, with a bulk-create modal and inline single-day editing via a popover.

**Architecture:** The existing `CustodySchedule` Prisma model stores one row per day per person. Recurrence is a server-side expansion — the POST route expands a date range + alternating-week rule into individual rows using an array-form Prisma transaction. The calendar page reads custody entries via the existing `/api/calendar/events` aggregator (which gets a new custody query), renders them as colored pills, and opens a React-portal popover on click for single-day edits.

**Tech Stack:** Next.js 16 App Router, Prisma + PostgreSQL, CSS Modules, NextAuth, React `createPortal`, lucide-react icons.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/app/api/calendar/custody/route.ts` | POST: validate + expand recurring schedule into DB rows |
| Create | `src/app/api/calendar/custody/[id]/route.ts` | PATCH + DELETE: single-day edit/clear with ownership check |
| Modify | `src/app/api/calendar/events/route.ts` | Add custody query to aggregator response |
| Create | `src/app/calendar/CustodyPopover.tsx` | Portal popover component for single-day editing |
| Modify | `src/app/calendar/page.tsx` | State, pill rendering, modal, toolbar button |
| Modify | `src/app/calendar/calendar.module.css` | Custody pill + popover CSS classes |

---

## Task 1: POST /api/calendar/custody

**Files:**
- Create: `src/app/api/calendar/custody/route.ts`

- [ ] **Step 1: Create the route file with auth + validation**

```ts
// src/app/api/calendar/custody/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const familyId = (session.user as any).familyId
  if (!familyId) {
    return NextResponse.json({ error: "No family" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { startDate, startsWith, recurring, until } = body as any

  if (!startDate || typeof startDate !== "string") {
    return NextResponse.json({ error: "startDate is required" }, { status: 400 })
  }
  if (startsWith !== "WITH_US" && startsWith !== "WITH_MONA") {
    return NextResponse.json({ error: "startsWith must be WITH_US or WITH_MONA" }, { status: 400 })
  }
  if (typeof recurring !== "boolean") {
    return NextResponse.json({ error: "recurring must be a boolean" }, { status: 400 })
  }

  const start = new Date(startDate)
  if (isNaN(start.getTime())) {
    return NextResponse.json({ error: "Invalid startDate" }, { status: 400 })
  }

  if (recurring) {
    if (!until || typeof until !== "string") {
      return NextResponse.json({ error: "until is required when recurring is true" }, { status: 400 })
    }
    const end = new Date(until)
    if (isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid until date" }, { status: 400 })
    }
    if (end < start) {
      return NextResponse.json({ error: "until must be on or after startDate" }, { status: 400 })
    }
    const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    if (diffDays > 730) {
      return NextResponse.json({ error: "Date range cannot exceed 730 days" }, { status: 400 })
    }
  }

  // Build upsert operations
  const ops: ReturnType<typeof prisma.custodySchedule.upsert>[] = []
  const personName = "Emilia"

  if (!recurring) {
    // Single day
    ops.push(
      prisma.custodySchedule.upsert({
        where: { date_personName_familyId: { date: start, personName, familyId } },
        create: { date: start, personName, location: startsWith, familyId },
        update: { location: startsWith },
      })
    )
  } else {
    // Expand recurring: iterate day-by-day, flip location every Sunday (except startDate)
    const end = new Date(until)
    let currentLocation: "WITH_US" | "WITH_MONA" = startsWith
    const cursor = new Date(start)

    while (cursor <= end) {
      // Flip on every Sunday except the very first day
      const isStartDate = cursor.getTime() === start.getTime()
      if (!isStartDate && cursor.getDay() === 0) {
        currentLocation = currentLocation === "WITH_US" ? "WITH_MONA" : "WITH_US"
      }

      const dateSnapshot = new Date(cursor)
      ops.push(
        prisma.custodySchedule.upsert({
          where: { date_personName_familyId: { date: dateSnapshot, personName, familyId } },
          create: { date: dateSnapshot, personName, location: currentLocation, familyId },
          update: { location: currentLocation },
        })
      )

      cursor.setDate(cursor.getDate() + 1)
    }
  }

  try {
    await prisma.$transaction(ops)
    return NextResponse.json({ count: ops.length }, { status: 201 })
  } catch (error: any) {
    console.error("Custody create error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify the route compiles**

```bash
cd /Users/till/Development/familia && npm run build 2>&1 | grep -E "error|Error|✓" | head -20
```

Expected: no TypeScript errors for the new file.

- [ ] **Step 3: Manual test — create a recurring schedule**

Start the dev server (`npm run dev`), sign in, then in another terminal:

```bash
# Get a session cookie first by signing in through the browser, then:
curl -s -X POST http://localhost:3000/api/calendar/custody \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<your-session-token>" \
  -d '{"startDate":"2026-03-22","startsWith":"WITH_US","recurring":true,"until":"2026-04-05"}'
```

Expected: `{"count":15}` (15 days from Mar 22 to Apr 5 inclusive).

Verify in Prisma Studio (`npx prisma studio`) that rows exist with alternating locations, switching every Sunday.

- [ ] **Step 4: Manual test — validation errors**

```bash
# Missing until when recurring=true
curl -s -X POST http://localhost:3000/api/calendar/custody \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<token>" \
  -d '{"startDate":"2026-03-22","startsWith":"WITH_US","recurring":true}'
# Expected: {"error":"until is required when recurring is true"}

# until before startDate
curl -s -X POST http://localhost:3000/api/calendar/custody \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<token>" \
  -d '{"startDate":"2026-03-22","startsWith":"WITH_US","recurring":true,"until":"2026-03-20"}'
# Expected: {"error":"until must be on or after startDate"}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/calendar/custody/route.ts
git commit -m "feat: add POST /api/calendar/custody with recurring expansion"
```

---

## Task 2: PATCH + DELETE /api/calendar/custody/[id]

**Files:**
- Create: `src/app/api/calendar/custody/[id]/route.ts`

- [ ] **Step 1: Create the [id] route file**

```ts
// src/app/api/calendar/custody/[id]/route.ts
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

  const familyId = (session.user as any).familyId
  const { id } = await params

  const entry = await prisma.custodySchedule.findUnique({ where: { id } })
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (entry.familyId !== familyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { location } = body as any
  if (location !== "WITH_US" && location !== "WITH_MONA") {
    return NextResponse.json({ error: "location must be WITH_US or WITH_MONA" }, { status: 400 })
  }

  try {
    const updated = await prisma.custodySchedule.update({
      where: { id },
      data: { location },
    })
    return NextResponse.json({
      ...updated,
      date: updated.date.toISOString().split("T")[0],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const familyId = (session.user as any).familyId
  const { id } = await params

  const entry = await prisma.custodySchedule.findUnique({ where: { id } })
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (entry.familyId !== familyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    await prisma.custodySchedule.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify compilation**

```bash
npm run build 2>&1 | grep -E "error|Error" | grep -v "node_modules" | head -10
```

Expected: no errors.

- [ ] **Step 3: Manual test — PATCH**

From Prisma Studio, copy the `id` of one of the rows created in Task 1, then:

```bash
curl -s -X PATCH http://localhost:3000/api/calendar/custody/<id> \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<token>" \
  -d '{"location":"WITH_MONA"}'
# Expected: JSON with updated entry, date as YYYY-MM-DD string
```

- [ ] **Step 4: Manual test — DELETE**

```bash
curl -s -X DELETE http://localhost:3000/api/calendar/custody/<id> \
  -H "Cookie: next-auth.session-token=<token>"
# Expected: {"ok":true}
```

Confirm row is gone in Prisma Studio.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/calendar/custody/[id]/route.ts
git commit -m "feat: add PATCH + DELETE /api/calendar/custody/[id]"
```

---

## Task 3: Add custody to /api/calendar/events aggregator

**Files:**
- Modify: `src/app/api/calendar/events/route.ts`

- [ ] **Step 1: Add custody query to the aggregator**

In `src/app/api/calendar/events/route.ts`, add the custody fetch alongside the existing `birthdays` and `travels` queries, then include it in the response.

After the line `const travels = familyId ? ...`, add:

```ts
const custodyEntries = familyId
  ? await prisma.custodySchedule.findMany({
      where: {
        familyId,
        date: { gte: timeMin, lte: timeMax },
      },
      orderBy: { date: "asc" },
    })
  : []

const serializedCustody = custodyEntries.map((c) => ({
  ...c,
  date: c.date.toISOString().split("T")[0],
}))
```

Then update the return statement from:
```ts
return NextResponse.json({ googleEvents, calendarSyncCount, birthdays, travels })
```
to:
```ts
return NextResponse.json({ googleEvents, calendarSyncCount, birthdays, travels, custodyEntries: serializedCustody })
```

- [ ] **Step 2: Verify compilation**

```bash
npm run build 2>&1 | grep -E "error|Error" | grep -v "node_modules" | head -10
```

- [ ] **Step 3: Manual test — fetch events includes custody**

```bash
curl -s "http://localhost:3000/api/calendar/events?timeMin=2026-03-01T00:00:00Z&timeMax=2026-04-30T00:00:00Z" \
  -H "Cookie: next-auth.session-token=<token>" | \
  node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); console.log('custody count:', j.custodyEntries?.length, 'sample:', JSON.stringify(j.custodyEntries?.[0]))"
```

Expected: `custody count: 15 sample: {"id":"...","date":"2026-03-22","personName":"Emilia","location":"WITH_US","familyId":"..."}`

Confirm `date` is a `YYYY-MM-DD` string, not a full ISO timestamp.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/calendar/events/route.ts
git commit -m "feat: include custody entries in calendar events aggregator"
```

---

## Task 4: CustodyPopover component

**Files:**
- Create: `src/app/calendar/CustodyPopover.tsx`

- [ ] **Step 1: Create the CustodyPopover component**

```tsx
// src/app/calendar/CustodyPopover.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import ReactDOM from "react-dom"
import styles from "./calendar.module.css"

type CustodyEntry = {
  id: string
  date: string
  personName: string
  location: "WITH_US" | "WITH_MONA"
}

type Props = {
  entry: CustodyEntry
  anchorRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
  onSave: () => void
}

export default function CustodyPopover({ entry, anchorRef, onClose, onSave }: Props) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Position popover below the anchor pill
  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      })
    }
  }, [anchorRef])

  // Click-outside dismissal
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  const handlePatch = async (location: "WITH_US" | "WITH_MONA") => {
    if (location === entry.location) {
      onClose()
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/calendar/custody/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to update")
      await onSave()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update")
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/calendar/custody/${entry.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to delete")
      await onSave()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete")
      setLoading(false)
    }
  }

  // Format date label: "22 March · Emilia"
  const [year, month, day] = entry.date.split("-").map(Number)
  const dateLabel = new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
  })

  const popover = (
    <div
      ref={popoverRef}
      className={styles.custodyPopover}
      style={{ top: pos.top, left: pos.left }}
    >
      <div className={styles.custodyPopoverLabel}>{dateLabel} · {entry.personName}</div>

      <button
        className={`${styles.custodyPopoverBtn} ${entry.location === "WITH_US" ? `${styles.custodyPopoverBtnActive} ${styles.custodyHomeEvent}` : ""}`}
        onClick={(e) => { e.stopPropagation(); handlePatch("WITH_US") }}
        disabled={loading}
      >
        🏠 With us
      </button>

      <button
        className={`${styles.custodyPopoverBtn} ${entry.location === "WITH_MONA" ? `${styles.custodyPopoverBtnActive} ${styles.custodyMonaEvent}` : ""}`}
        onClick={(e) => { e.stopPropagation(); handlePatch("WITH_MONA") }}
        disabled={loading}
      >
        👤 With Mona
      </button>

      <button
        className={styles.custodyPopoverBtn}
        onClick={(e) => { e.stopPropagation(); handleDelete() }}
        disabled={loading}
        style={{ color: "var(--secondary)", fontSize: "11px" }}
      >
        ✕ Clear this day
      </button>

      {error && <p className={styles.custodyPopoverError}>{error}</p>}
    </div>
  )

  if (typeof document === "undefined") return null
  return ReactDOM.createPortal(popover, document.body)
}
```

- [ ] **Step 2: Verify compilation**

```bash
npm run build 2>&1 | grep -E "error|Error" | grep -v "node_modules" | head -10
```

Expected: no errors (the CSS classes referenced don't exist yet — that's fine, they'll be added in Task 5).

- [ ] **Step 3: Commit**

```bash
git add src/app/calendar/CustodyPopover.tsx
git commit -m "feat: add CustodyPopover portal component"
```

---

## Task 5: Calendar page — CSS, state, pills, modal, toolbar

**Files:**
- Modify: `src/app/calendar/calendar.module.css`
- Modify: `src/app/calendar/page.tsx`

- [ ] **Step 1: Add CSS classes to calendar.module.css**

At the end of `src/app/calendar/calendar.module.css`, add:

```css
/* ── Custody ─────────────────────────────────────────────── */

.custodyHomeEvent {
  background: #eff6ff;
  color: #1d4ed8;
}

.custodyMonaEvent {
  background: #fdf2f8;
  color: #9d174d;
}

/* Popover (portal — fixed position, appended to document.body) */
.custodyPopover {
  position: fixed;
  z-index: 200;
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 160px;
}

.custodyPopoverLabel {
  font-size: 11px;
  font-weight: 600;
  color: var(--secondary);
  margin-bottom: 2px;
}

.custodyPopoverBtn {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--foreground);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background-color 150ms;
  font-family: inherit;
}

.custodyPopoverBtn:hover:not(:disabled) {
  background: var(--surface-hover);
}

.custodyPopoverBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.custodyPopoverBtnActive {
  border-width: 2px;
  font-weight: 700;
}

.custodyPopoverBtnActive.custodyHomeEvent {
  border-color: #3b82f6;
  background: #eff6ff;
  color: #1d4ed8;
}

.custodyPopoverBtnActive.custodyMonaEvent {
  border-color: #ec4899;
  background: #fdf2f8;
  color: #9d174d;
}

.custodyPopoverError {
  font-size: 11px;
  color: #dc2626;
  margin-top: 2px;
}

@media (prefers-color-scheme: dark) {
  .custodyHomeEvent {
    background: #1e3a5f;
    color: #93c5fd;
  }
  .custodyMonaEvent {
    background: #4a1030;
    color: #f9a8d4;
  }
  .custodyPopoverBtnActive.custodyHomeEvent {
    border-color: #3b82f6;
    background: #1e3a5f;
    color: #93c5fd;
  }
  .custodyPopoverBtnActive.custodyMonaEvent {
    border-color: #ec4899;
    background: #4a1030;
    color: #f9a8d4;
  }
  .custodyPopoverError {
    color: #f87171;
  }
}
```

- [ ] **Step 2: Wire custody state into page.tsx**

Open `src/app/calendar/page.tsx`. Make the following changes:

**a) Add import** at the top of the file (after the existing imports):
```tsx
import CustodyPopover from "./CustodyPopover"
import { Home } from "lucide-react"
```

**b) Extend ModalType:**
Change:
```ts
type ModalType = "NONE" | "BIRTHDAY" | "TRAVEL"
```
to:
```ts
type ModalType = "NONE" | "BIRTHDAY" | "TRAVEL" | "CUSTODY"
```

**c) Extend the events state** to include `custodyEntries: any[]`:
```ts
const [events, setEvents] = useState<{
  googleEvents: any[]
  birthdays: any[]
  travels: any[]
  custodyEntries: any[]
  calendarSyncCount: number
}>({
  googleEvents: [],
  birthdays: [],
  travels: [],
  custodyEntries: [],
  calendarSyncCount: 0,
})
```

**d) Add popover + modal form state** after the existing state declarations:
```ts
const [openCustodyId, setOpenCustodyId] = useState<string | null>(null)

// Add Custody modal form state
const [cStart, setCStart] = useState("")
const [cStartsWith, setCStartsWith] = useState<"WITH_US" | "WITH_MONA">("WITH_US")
const [cRecurring, setCRecurring] = useState(true)
const [cUntil, setCUntil] = useState("")
```

**e) Update fetchEvents response handler** — in the `setEvents(...)` call inside `fetchEvents`, add `custodyEntries: data.custodyEntries ?? []`:
```ts
setEvents({
  googleEvents: data.googleEvents ?? [],
  birthdays: data.birthdays ?? [],
  travels: data.travels ?? [],
  custodyEntries: data.custodyEntries ?? [],
  calendarSyncCount: data.calendarSyncCount ?? 0,
})
```

**f) Reset openCustodyId on navigation** — update `prevMonth` and `nextMonth`:
```ts
const nextMonth = () => { setOpenCustodyId(null); setCurrentDate(new Date(year, month + 1, 1)) }
const prevMonth = () => { setOpenCustodyId(null); setCurrentDate(new Date(year, month - 1, 1)) }
```

**g) Update closeModal** to also reset openCustodyId:
```ts
const closeModal = () => {
  setModal("NONE")
  setDeleteConfirming(false)
  setModalError(null)
  setOpenCustodyId(null)
}
```

- [ ] **Step 3: Update getEventsForDay to include custody**

Find the `getEventsForDay` function and update its return shape:

```ts
const getEventsForDay = (date: Date) => {
  const dStr = date.toDateString()

  const google = events.googleEvents.filter((e) => {
    const start = e.start.dateTime || e.start.date
    return new Date(start).toDateString() === dStr
  })

  const birthdays = events.birthdays.filter(
    (b) => b.month === date.getMonth() + 1 && b.day === date.getDate()
  )

  const travels = events.travels.filter((t) => {
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    const s = new Date(t.startDate)
    s.setHours(0, 0, 0, 0)
    const e = new Date(t.endDate)
    e.setHours(0, 0, 0, 0)
    return checkDate >= s && checkDate <= e
  })

  // Custody: compare as YYYY-MM-DD strings to avoid timezone issues
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  const custody = events.custodyEntries.filter((c) => c.date === dateStr)

  return { google, birthdays, travels, custody }
}
```

- [ ] **Step 4: Add CustodyPill sub-component and pill rendering**

An inline `{ current: null }` object inside `.map()` is not a React ref — it never gets populated. The fix is a small `CustodyPill` component that calls `useRef` at the component level. Add this component near the top of `page.tsx` (inside the file, before `CalendarPage`, but after the imports):

```tsx
function CustodyPill({
  entry,
  isOpen,
  onToggle,
  onClose,
  onSave,
}: {
  entry: any
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onSave: () => void
}) {
  const anchorRef = useRef<HTMLDivElement>(null)
  return (
    <div ref={anchorRef}>
      <div
        className={`${styles.eventItem} ${entry.location === "WITH_US" ? styles.custodyHomeEvent : styles.custodyMonaEvent}`}
        style={{ cursor: "pointer" }}
        onClick={(e) => { e.stopPropagation(); onToggle() }}
      >
        <span>{entry.location === "WITH_US" ? "🏠 Emilia home" : "👤 Emilia @ Mona"}</span>
      </div>
      {isOpen && (
        <CustodyPopover
          entry={entry}
          anchorRef={anchorRef}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </div>
  )
}
```

Then in the day cell JSX, find the section that maps over `dayEvents.google`, `dayEvents.birthdays`, and `dayEvents.travels`. Add custody pills **before** the Google events block using the new component:

```tsx
{dayEvents.custody.map((c) => (
  <CustodyPill
    key={c.id}
    entry={c}
    isOpen={openCustodyId === c.id}
    onToggle={() => setOpenCustodyId(openCustodyId === c.id ? null : c.id)}
    onClose={() => setOpenCustodyId(null)}
    onSave={fetchEvents}
  />
))}
```

- [ ] **Step 5: Add the "Add Custody" toolbar button**

In the toolbar `<div className={styles.toolbar}>`, add a third button after "Add Travel":

```tsx
<button
  onClick={() => {
    const today = new Date().toISOString().split("T")[0]
    const sixMonths = new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString().split("T")[0]
    setCStart(today)
    setCStartsWith("WITH_US")
    setCRecurring(true)
    setCUntil(sixMonths)
    setDeleteConfirming(false)
    setModalError(null)
    setOpenCustodyId(null)
    setModal("CUSTODY")
  }}
  className={styles.toolbarBtn}
>
  <Home size={14} />
  Add Custody
</button>
```

- [ ] **Step 6: Add the Custody modal JSX**

After the closing `)}` of the Travel modal block, add the Custody modal:

```tsx
{/* Custody Modal */}
{modal === "CUSTODY" && (
  <div className={styles.modalBackdrop} onClick={closeModal}>
    <form
      className={styles.modalContent}
      onSubmit={async (e) => {
        e.preventDefault()
        setModalError(null)
        try {
          const res = await fetch("/api/calendar/custody", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              startDate: cStart,
              startsWith: cStartsWith,
              recurring: cRecurring,
              until: cRecurring ? cUntil : cStart,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error ?? "Failed to save")
          closeModal()
          fetchEvents()
        } catch (err: unknown) {
          setModalError(err instanceof Error ? err.message : "Failed to save")
        }
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <h2>Add Custody Schedule</h2>

      <div className={styles.formGroup}>
        <label htmlFor="cStart">First night</label>
        <input
          id="cStart"
          type="date"
          value={cStart}
          onChange={(e) => setCStart(e.target.value)}
          required
        />
      </div>

      <div className={styles.formGroup}>
        <label>Emilia sleeps at</label>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setCStartsWith("WITH_US")}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "6px",
              border: cStartsWith === "WITH_US" ? "2px solid var(--primary)" : "1px solid var(--border)",
              background: cStartsWith === "WITH_US" ? "var(--accent-soft)" : "transparent",
              fontWeight: cStartsWith === "WITH_US" ? 700 : 500,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.875rem",
            }}
          >
            🏠 With us
          </button>
          <button
            type="button"
            onClick={() => setCStartsWith("WITH_MONA")}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "6px",
              border: cStartsWith === "WITH_MONA" ? "2px solid var(--primary)" : "1px solid var(--border)",
              background: cStartsWith === "WITH_MONA" ? "var(--accent-soft)" : "transparent",
              fontWeight: cStartsWith === "WITH_MONA" ? 700 : 500,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.875rem",
            }}
          >
            👤 With Mona
          </button>
        </div>
      </div>

      <div className={styles.formGroup}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ marginBottom: 0 }}>Recurring</label>
          <button
            type="button"
            onClick={() => setCRecurring(!cRecurring)}
            style={{
              width: "36px",
              height: "20px",
              borderRadius: "10px",
              border: "none",
              background: cRecurring ? "var(--primary)" : "var(--border)",
              cursor: "pointer",
              position: "relative",
              transition: "background 150ms",
            }}
            aria-label="Toggle recurring"
          >
            <span style={{
              position: "absolute",
              top: "2px",
              left: cRecurring ? "calc(100% - 18px)" : "2px",
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              background: "white",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              transition: "left 150ms",
            }} />
          </button>
        </div>
        {cRecurring && (
          <p style={{ fontSize: "0.75rem", color: "var(--secondary)", margin: "4px 0 0" }}>
            Alternating weeks · switches on Sunday
          </p>
        )}
      </div>

      {cRecurring && (
        <div className={styles.formGroup}>
          <label htmlFor="cUntil">Until</label>
          <input
            id="cUntil"
            type="date"
            value={cUntil}
            onChange={(e) => setCUntil(e.target.value)}
            required
          />
          {cStart && cUntil && (
            <p style={{ fontSize: "0.75rem", color: "var(--secondary)", margin: "4px 0 0" }}>
              Creates ~{Math.round((new Date(cUntil).getTime() - new Date(cStart).getTime()) / (7 * 24 * 60 * 60 * 1000))} weeks of schedule entries
            </p>
          )}
        </div>
      )}

      {modalError && <p className={styles.modalError}>{modalError}</p>}

      <div className={styles.modalActions}>
        <button type="button" className={styles.cancelBtn} onClick={closeModal}>
          Cancel
        </button>
        <button type="submit" className={styles.saveBtn}>
          Save Schedule
        </button>
      </div>
    </form>
  </div>
)}
```

- [ ] **Step 7: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error" | grep -v "node_modules" | head -20
```

Expected: clean build.

- [ ] **Step 8: Manual end-to-end test**

1. Start `npm run dev`, open `http://localhost:3000/calendar`
2. Click **Add Custody** in the toolbar → modal opens with today's date and "With us" selected
3. Set "First night" to `2026-04-06` (a Sunday), leave recurring on, set "Until" to `2026-07-06` → helper text shows ~13 weeks
4. Click **Save Schedule** → modal closes, blue "🏠 Emilia home" pills appear on April dates
5. Navigate to May → pills continue with alternating weeks (should flip on each Sunday)
6. Click a pill → popover appears with current state highlighted
7. Click **👤 With Mona** → pill changes to pink "👤 Emilia @ Mona", popover closes
8. Click the pill again → popover appears, click **✕ Clear this day** → pill disappears

- [ ] **Step 9: Commit**

```bash
git add src/app/calendar/calendar.module.css src/app/calendar/page.tsx
git commit -m "feat: add custody schedule to calendar page"
```

---

## Task 6: Final verification and cleanup

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Fix any lint errors before continuing.

- [ ] **Step 2: Verify dark mode**

In browser DevTools, toggle `prefers-color-scheme: dark`. Confirm:
- Custody pills switch to dark blue / dark pink
- Popover background and buttons use theme variables and look correct

- [ ] **Step 3: Verify edge cases**

- Navigate to a month with no custody entries → no pills, no errors
- Click Add Custody with `until` before `startDate` → error message appears in modal
- Click a pill while another popover is open → first popover closes, new one opens (toggling `openCustodyId`)
- Navigate months with a popover open → popover disappears (openCustodyId reset)

- [ ] **Step 4: Final commit**

```bash
git add -p  # stage any remaining lint fixes
git commit -m "fix: lint and edge case cleanup for custody schedule"
```
