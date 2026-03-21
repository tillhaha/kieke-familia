# Edit & Delete Calendar Entries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users edit and delete Birthday and Travel entries by clicking their pills in the calendar grid, using the existing modals extended with an edit mode and a two-click delete confirmation.

**Architecture:** Two new dynamic API route files handle PATCH and DELETE for birthdays and travels. The calendar page gets four new state variables (`editingBirthday`, `editingTravel`, `deleteConfirming`, `modalError`), updated handlers, clickable pills, and extended modals. CSS adds delete button and modal error styles.

**Tech Stack:** Next.js 16 App Router, NextAuth v4, Prisma 7, CSS modules.

**Spec:** `docs/superpowers/specs/2026-03-21-edit-delete-calendar-entries-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/app/api/calendar/birthdays/[id]/route.ts` | Create | PATCH + DELETE for a single birthday |
| `src/app/api/calendar/travel/[id]/route.ts` | Create | PATCH + DELETE for a single travel entry |
| `src/app/calendar/page.tsx` | Modify | Edit state, pill click handlers, edit mode modals, delete confirmation, modal errors |
| `src/app/calendar/calendar.module.css` | Modify | Delete button styles, modal error style |

---

## Task 1: Birthday PATCH + DELETE API

**Files:**
- Create: `src/app/api/calendar/birthdays/[id]/route.ts`

- [ ] **Step 1: Read the Next.js 16 docs on dynamic routes**

```bash
ls /Users/till/Development/familia/node_modules/next/dist/docs/
```

Look for anything related to dynamic routes / `[id]` segments.

- [ ] **Step 2: Read the existing birthday create route for patterns**

Read `src/app/api/calendar/birthdays/route.ts` — note the session/auth pattern to match.

- [ ] **Step 3: Create the route file**

Create `src/app/api/calendar/birthdays/[id]/route.ts`:

```ts
// src/app/api/calendar/birthdays/[id]/route.ts
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

  const { id } = await params
  const userFamilyId = (session.user as any).familyId

  const birthday = await prisma.birthday.findUnique({ where: { id } })
  if (!birthday || !userFamilyId || birthday.familyId !== userFamilyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { name, month, day } = body as any

  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Month must be between 1 and 12" }, { status: 400 })
  }
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return NextResponse.json({ error: "Day must be between 1 and 31" }, { status: 400 })
  }

  try {
    const updated = await prisma.birthday.update({
      where: { id },
      data: { name: name.trim(), month, day },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "Failed to update birthday" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const userFamilyId = (session.user as any).familyId

  const birthday = await prisma.birthday.findUnique({ where: { id } })
  if (!birthday || !userFamilyId || birthday.familyId !== userFamilyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    await prisma.birthday.delete({ where: { id } })
    return NextResponse.json({ deleted: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete birthday" }, { status: 500 })
  }
}
```

- [ ] **Step 4: Check TypeScript compiles**

```bash
cd /Users/till/Development/familia && npx tsc --noEmit 2>&1 | grep -v "prisma.ts"
```

Expected: no errors from the new file. Fix any that appear.

- [ ] **Step 5: Manual test — PATCH**

With dev server running (`npm run dev`), use a real birthday `id` from the database:

```bash
# Get a birthday id from the DB
psql "postgresql://till@localhost:5432/familia" -c 'SELECT id, name FROM "Birthday" LIMIT 3;'

# Patch it (replace TOKEN and BIRTHDAY_ID)
curl -X PATCH \
  -H "Cookie: next-auth.session-token=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name","month":6,"day":15}' \
  http://localhost:3000/api/calendar/birthdays/BIRTHDAY_ID
# Expected: {"id":"...","name":"Updated Name","month":6,"day":15,"familyId":"..."}
```

- [ ] **Step 6: Manual test — DELETE**

```bash
curl -X DELETE \
  -H "Cookie: next-auth.session-token=TOKEN" \
  http://localhost:3000/api/calendar/birthdays/BIRTHDAY_ID
# Expected: {"deleted":true}
```

- [ ] **Step 7: Manual test — 404 for wrong familyId**

```bash
curl -X PATCH \
  -H "Cookie: next-auth.session-token=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"X","month":1,"day":1}' \
  http://localhost:3000/api/calendar/birthdays/nonexistent-id
# Expected: {"error":"Not found"} with status 404
```

- [ ] **Step 8: Commit**

```bash
cd /Users/till/Development/familia && git add src/app/api/calendar/birthdays/[id]/route.ts
git commit -m "feat: add PATCH+DELETE /api/calendar/birthdays/[id]"
```

---

## Task 2: Travel PATCH + DELETE API

**Files:**
- Create: `src/app/api/calendar/travel/[id]/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/calendar/travel/[id]/route.ts`:

```ts
// src/app/api/calendar/travel/[id]/route.ts
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

  const { id } = await params
  const userId = (session.user as any).id

  const travel = await prisma.travel.findUnique({ where: { id } })
  if (!travel || travel.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { destination, startDate, endDate } = body as any

  if (!destination || typeof destination !== "string" || destination.trim() === "") {
    return NextResponse.json({ error: "Destination is required" }, { status: 400 })
  }

  const start = new Date(startDate)
  const end = new Date(endDate)

  if (isNaN(start.getTime())) {
    return NextResponse.json({ error: "Invalid start date" }, { status: 400 })
  }
  if (isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid end date" }, { status: 400 })
  }
  if (end < start) {
    return NextResponse.json({ error: "End date must be on or after start date" }, { status: 400 })
  }

  try {
    const updated = await prisma.travel.update({
      where: { id },
      data: { destination: destination.trim(), startDate: start, endDate: end },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "Failed to update travel" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const userId = (session.user as any).id

  const travel = await prisma.travel.findUnique({ where: { id } })
  if (!travel || travel.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    await prisma.travel.delete({ where: { id } })
    return NextResponse.json({ deleted: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete travel" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd /Users/till/Development/familia && npx tsc --noEmit 2>&1 | grep -v "prisma.ts"
```

Expected: no errors. Fix any that appear.

- [ ] **Step 3: Manual test — PATCH**

```bash
# Get a travel id
psql "postgresql://till@localhost:5432/familia" -c 'SELECT id, destination FROM "Travel" LIMIT 3;'

curl -X PATCH \
  -H "Cookie: next-auth.session-token=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"destination":"Paris","startDate":"2026-04-01","endDate":"2026-04-07"}' \
  http://localhost:3000/api/calendar/travel/TRAVEL_ID
# Expected: updated travel object with ISO startDate/endDate
```

- [ ] **Step 4: Manual test — DELETE**

```bash
curl -X DELETE \
  -H "Cookie: next-auth.session-token=TOKEN" \
  http://localhost:3000/api/calendar/travel/TRAVEL_ID
# Expected: {"deleted":true}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/till/Development/familia && git add src/app/api/calendar/travel/[id]/route.ts
git commit -m "feat: add PATCH+DELETE /api/calendar/travel/[id]"
```

---

## Task 3: CSS — Delete Button and Modal Error Styles

**Files:**
- Modify: `src/app/calendar/calendar.module.css`

- [ ] **Step 1: Append new CSS classes to the end of the file**

Open `src/app/calendar/calendar.module.css` and append:

```css
/* ── Edit / Delete Modal Additions ───────────────────────── */

.deleteBtn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--secondary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 150ms, color 150ms, border-color 150ms;
}

.deleteBtn:hover {
  background: #fef2f2;
  color: #991b1b;
  border-color: #fecaca;
}

.deleteBtnConfirm {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 150ms;
}

.deleteBtnConfirm:hover {
  background: #fee2e2;
}

.modalError {
  font-size: 0.875rem;
  color: #dc2626;
  margin: 0.75rem 0 0;
}

@media (prefers-color-scheme: dark) {
  .deleteBtn:hover {
    background: #2d0a0a;
    color: #fca5a5;
    border-color: #7f1d1d;
  }
  .deleteBtnConfirm {
    background: #2d0a0a;
    border-color: #7f1d1d;
    color: #fca5a5;
  }
  .deleteBtnConfirm:hover {
    background: #3d1010;
  }
  .modalError {
    color: #f87171;
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/till/Development/familia && git add src/app/calendar/calendar.module.css
git commit -m "feat: add delete button and modal error CSS classes"
```

---

## Task 4: Calendar Page — Edit Mode, Pill Clicks, Delete Confirmation

**Files:**
- Modify: `src/app/calendar/page.tsx`

This is the largest task. Read the entire current file first, then apply the changes below in order.

- [ ] **Step 1: Read the current file in full**

Read `src/app/calendar/page.tsx` to understand the current structure before making any changes.

- [ ] **Step 2: Add four new state variables**

After the existing travel form state block (after `tEnd` / `setTEnd`), add:

```ts
// Edit mode state
const [editingBirthday, setEditingBirthday] = useState<{
  id: string; name: string; month: number; day: number
} | null>(null)
const [editingTravel, setEditingTravel] = useState<{
  id: string; destination: string; startDate: string; endDate: string
} | null>(null)
const [deleteConfirming, setDeleteConfirming] = useState(false)
const [modalError, setModalError] = useState<string | null>(null)
```

- [ ] **Step 3: Add a `closeModal` helper**

After the state declarations (before `useEffect`), add:

```ts
const closeModal = () => {
  setModal("NONE")
  setDeleteConfirming(false)
  setModalError(null)
}
```

- [ ] **Step 4: Replace `handleAddBirthday` with `handleSaveBirthday`**

Delete the current `handleAddBirthday` function and replace with:

```ts
const handleSaveBirthday = async (e: React.FormEvent) => {
  e.preventDefault()
  setModalError(null)
  try {
    const url = editingBirthday
      ? `/api/calendar/birthdays/${editingBirthday.id}`
      : "/api/calendar/birthdays"
    const res = await fetch(url, {
      method: editingBirthday ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: bName, month: bMonth, day: bDay }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Failed to save")
    closeModal()
    fetchEvents()
  } catch (err: unknown) {
    setModalError(err instanceof Error ? err.message : "Failed to save")
  }
}

const handleDeleteBirthday = async () => {
  if (!editingBirthday) return
  if (!deleteConfirming) {
    setDeleteConfirming(true)
    return
  }
  setModalError(null)
  try {
    const res = await fetch(`/api/calendar/birthdays/${editingBirthday.id}`, {
      method: "DELETE",
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Failed to delete")
    closeModal()
    fetchEvents()
  } catch (err: unknown) {
    setModalError(err instanceof Error ? err.message : "Failed to delete")
    setDeleteConfirming(false)
  }
}
```

- [ ] **Step 5: Replace `handleAddTravel` with `handleSaveTravel`**

Delete the current `handleAddTravel` function and replace with:

```ts
const handleSaveTravel = async (e: React.FormEvent) => {
  e.preventDefault()
  setModalError(null)
  try {
    const url = editingTravel
      ? `/api/calendar/travel/${editingTravel.id}`
      : "/api/calendar/travel"
    const res = await fetch(url, {
      method: editingTravel ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: tDest, startDate: tStart, endDate: tEnd }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Failed to save")
    closeModal()
    fetchEvents()
  } catch (err: unknown) {
    setModalError(err instanceof Error ? err.message : "Failed to save")
  }
}

const handleDeleteTravel = async () => {
  if (!editingTravel) return
  if (!deleteConfirming) {
    setDeleteConfirming(true)
    return
  }
  setModalError(null)
  try {
    const res = await fetch(`/api/calendar/travel/${editingTravel.id}`, {
      method: "DELETE",
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Failed to delete")
    closeModal()
    fetchEvents()
  } catch (err: unknown) {
    setModalError(err instanceof Error ? err.message : "Failed to delete")
    setDeleteConfirming(false)
  }
}
```

- [ ] **Step 6: Update the toolbar buttons to reset form + editing state**

Replace the two toolbar `<button>` elements:

```tsx
<button
  onClick={() => {
    setEditingBirthday(null)
    setBName("")
    setBMonth(new Date().getMonth() + 1)
    setBDay(new Date().getDate())
    setDeleteConfirming(false)
    setModalError(null)
    setModal("BIRTHDAY")
  }}
  className={styles.toolbarBtn}
>
  <Plus size={14} />
  Add Birthday
</button>
<button
  onClick={() => {
    setEditingTravel(null)
    setTDest("")
    setTStart(new Date().toISOString().split("T")[0])
    setTEnd(new Date().toISOString().split("T")[0])
    setDeleteConfirming(false)
    setModalError(null)
    setModal("TRAVEL")
  }}
  className={styles.toolbarBtn}
>
  <Plus size={14} />
  Add Travel
</button>
```

- [ ] **Step 7: Add onClick to birthday pills**

Replace the birthday pills `map` block:

```tsx
{dayEvents.birthdays.map((b, idx) => (
  <div
    key={idx}
    className={`${styles.eventItem} ${styles.birthdayEvent}`}
    style={{ cursor: "pointer" }}
    onClick={() => {
      setEditingBirthday({ id: b.id, name: b.name, month: b.month, day: b.day })
      setBName(b.name)
      setBMonth(b.month)
      setBDay(b.day)
      setDeleteConfirming(false)
      setModalError(null)
      setModal("BIRTHDAY")
    }}
    title={`${b.name} — click to edit`}
  >
    <Cake size={10} strokeWidth={2} />
    {b.name}
  </div>
))}
```

- [ ] **Step 8: Add conditional onClick to travel pills**

Replace the travel pills `map` block:

```tsx
{dayEvents.travels.map((t, idx) => {
  const currentUserId = (session?.user as any)?.id
  const isOwner = t.userId === currentUserId
  return (
    <div
      key={idx}
      className={`${styles.eventItem} ${styles.travelEvent}`}
      style={isOwner ? { cursor: "pointer" } : undefined}
      onClick={
        isOwner
          ? () => {
              setEditingTravel({
                id: t.id,
                destination: t.destination,
                startDate: new Date(t.startDate).toISOString().split("T")[0],
                endDate: new Date(t.endDate).toISOString().split("T")[0],
              })
              setTDest(t.destination)
              setTStart(new Date(t.startDate).toISOString().split("T")[0])
              setTEnd(new Date(t.endDate).toISOString().split("T")[0])
              setDeleteConfirming(false)
              setModalError(null)
              setModal("TRAVEL")
            }
          : undefined
      }
      title={isOwner ? `${t.destination} — click to edit` : t.destination}
    >
      <Plane size={10} strokeWidth={2} />
      {t.destination}
    </div>
  )
})}
```

- [ ] **Step 9: Replace the Birthday Modal JSX**

Replace the entire `{modal === "BIRTHDAY" && (...)}` block:

```tsx
{modal === "BIRTHDAY" && (
  <div className={styles.modalBackdrop} onClick={closeModal}>
    <form
      className={styles.modalContent}
      onSubmit={handleSaveBirthday}
      onClick={(e) => e.stopPropagation()}
    >
      <h2>{editingBirthday ? "Edit Birthday" : "Add Birthday"}</h2>
      <div className={styles.formGroup}>
        <label htmlFor="bName">Name</label>
        <input
          id="bName"
          type="text"
          value={bName}
          onChange={(e) => setBName(e.target.value)}
          placeholder="Family member's name"
          required
        />
      </div>
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="bMonth">Month</label>
          <input
            id="bMonth"
            type="number"
            min="1"
            max="12"
            value={bMonth}
            onChange={(e) => setBMonth(parseInt(e.target.value))}
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="bDay">Day</label>
          <input
            id="bDay"
            type="number"
            min="1"
            max="31"
            value={bDay}
            onChange={(e) => setBDay(parseInt(e.target.value))}
            required
          />
        </div>
      </div>
      {modalError && <p className={styles.modalError}>{modalError}</p>}
      <div className={styles.modalActions}>
        {editingBirthday && (
          <button
            type="button"
            className={deleteConfirming ? styles.deleteBtnConfirm : styles.deleteBtn}
            onClick={handleDeleteBirthday}
          >
            {deleteConfirming ? "Confirm delete" : "Delete"}
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button type="button" className={styles.cancelBtn} onClick={closeModal}>
          Cancel
        </button>
        <button type="submit" className={styles.saveBtn}>
          Save
        </button>
      </div>
    </form>
  </div>
)}
```

- [ ] **Step 10: Replace the Travel Modal JSX**

Replace the entire `{modal === "TRAVEL" && (...)}` block:

```tsx
{modal === "TRAVEL" && (
  <div className={styles.modalBackdrop} onClick={closeModal}>
    <form
      className={styles.modalContent}
      onSubmit={handleSaveTravel}
      onClick={(e) => e.stopPropagation()}
    >
      <h2>{editingTravel ? "Edit Travel" : "Add Travel"}</h2>
      <div className={styles.formGroup}>
        <label htmlFor="tDest">Destination</label>
        <input
          id="tDest"
          type="text"
          value={tDest}
          onChange={(e) => setTDest(e.target.value)}
          placeholder="Where are you going?"
          required
        />
      </div>
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="tStart">Start Date</label>
          <input
            id="tStart"
            type="date"
            value={tStart}
            onChange={(e) => setTStart(e.target.value)}
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="tEnd">End Date</label>
          <input
            id="tEnd"
            type="date"
            value={tEnd}
            onChange={(e) => setTEnd(e.target.value)}
            required
          />
        </div>
      </div>
      {modalError && <p className={styles.modalError}>{modalError}</p>}
      <div className={styles.modalActions}>
        {editingTravel && (
          <button
            type="button"
            className={deleteConfirming ? styles.deleteBtnConfirm : styles.deleteBtn}
            onClick={handleDeleteTravel}
          >
            {deleteConfirming ? "Confirm delete" : "Delete"}
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button type="button" className={styles.cancelBtn} onClick={closeModal}>
          Cancel
        </button>
        <button type="submit" className={styles.saveBtn}>
          Save
        </button>
      </div>
    </form>
  </div>
)}
```

- [ ] **Step 11: Check TypeScript compiles**

```bash
cd /Users/till/Development/familia && npx tsc --noEmit 2>&1 | grep -v "prisma.ts"
```

Expected: no errors. Fix any that appear.

- [ ] **Step 12: Manual test — create mode still works**

Open the calendar. Click "Add Birthday", enter a name/month/day, save. The birthday pill should appear. Click "Add Travel", enter details, save. Travel pill should appear.

- [ ] **Step 13: Manual test — edit mode**

Click a birthday pill. Modal should open titled "Edit Birthday" with the current name/month/day pre-filled. Change the name, click Save. The pill should show the new name. Repeat for a travel pill (only your own travel entries are clickable).

- [ ] **Step 14: Manual test — delete with confirmation**

Click a birthday pill to open edit modal. Click "Delete" — button should turn red and say "Confirm delete". Click again — the entry should disappear and the modal close.

Click "Add Birthday" after deleting — the form should open blank (not pre-filled with the deleted entry's data).

- [ ] **Step 15: Manual test — cancel resets confirm state**

Click a birthday pill. Click "Delete" (button turns red). Click "Cancel". Click the same birthday pill again. The "Delete" button should be back to its default grey state (not red).

- [ ] **Step 16: Commit**

```bash
cd /Users/till/Development/familia && git add src/app/calendar/page.tsx
git commit -m "feat: edit/delete mode for birthday and travel calendar entries"
```
