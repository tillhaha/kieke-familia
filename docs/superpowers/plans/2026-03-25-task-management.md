# Task Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add family-scoped task management — create/manage tasks on `/tasks`, view this week's tasks on the homepage.

**Architecture:** New `Task` + `TaskAssignee` Prisma models scoped to `Family`. Four API routes handle CRUD. A `/tasks` page groups open tasks by urgency (Overdue / This week / Later) with a shared modal for create/edit. The homepage gains a compact widget above the existing WeekBlock.

**Tech Stack:** Next.js 16 (App Router), Prisma + PostgreSQL, next-auth, CSS Modules, lucide-react

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add `Task`, `TaskAssignee`; update `Family`/`User` relations |
| Create | `src/app/api/tasks/route.ts` | `GET` (list) + `POST` (create) |
| Create | `src/app/api/tasks/[id]/route.ts` | `PATCH` (update) + `DELETE` |
| Modify | `src/components/Navbar.tsx` | Add Tasks nav link |
| Create | `src/app/tasks/page.tsx` | Tasks page — grouped list + toolbar |
| Create | `src/app/tasks/TaskModal.tsx` | Create/edit modal (reused for both modes) |
| Create | `src/app/tasks/tasks.module.css` | Page + modal styles |
| Modify | `src/app/page.tsx` | Add tasks fetch + render `<TasksWidget>` above WeekBlock |
| Modify | `src/app/page.module.css` | Widget styles |

---

## Task 1: Schema changes

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Task and TaskAssignee models to schema**

In `prisma/schema.prisma`, add after the `ShoppingBlacklist` model:

```prisma
model Task {
  id          String         @id @default(cuid())
  familyId    String
  family      Family         @relation(fields: [familyId], references: [id])
  name        String
  description String?
  dueDate     DateTime       @db.Date
  done        Boolean        @default(false)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  assignees   TaskAssignee[]
}

model TaskAssignee {
  taskId String
  task   Task   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([taskId, userId])
}
```

- [ ] **Step 2: Add relations to Family and User**

In `prisma/schema.prisma`, in the `Family` model, add after `shoppingBlacklist ShoppingBlacklist[]`:
```prisma
  tasks              Task[]
```

In the `User` model, add after `calendarSyncs CalendarSync[]`:
```prisma
  taskAssignments    TaskAssignee[]
```

- [ ] **Step 3: Push schema to database**

```bash
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Task and TaskAssignee models to schema"
```

---

## Task 2: API — GET and POST /api/tasks

**Files:**
- Create: `src/app/api/tasks/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/tasks/route.ts`:

```typescript
// src/app/api/tasks/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

const assigneeSelect = {
  userId: true,
  user: { select: { id: true, name: true } },
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const includeDone = searchParams.get("includeDone") === "true"

  const tasks = await prisma.task.findMany({
    where: {
      familyId,
      ...(includeDone ? {} : { done: false }),
    },
    orderBy: { dueDate: "asc" },
    include: { assignees: { select: assigneeSelect } },
  })

  return NextResponse.json({ tasks })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { name, description, dueDate, assigneeIds } = body as Record<string, unknown>

  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }
  if (!dueDate || typeof dueDate !== "string") {
    return NextResponse.json({ error: "dueDate is required" }, { status: 400 })
  }
  const parsedDate = new Date(`${dueDate}T00:00:00.000Z`)
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 })
  }

  const ids: string[] = Array.isArray(assigneeIds) ? assigneeIds.filter((id): id is string => typeof id === "string") : []

  // Validate all assigneeIds belong to the family
  if (ids.length > 0) {
    const count = await prisma.user.count({ where: { id: { in: ids }, familyId } })
    if (count !== ids.length) {
      return NextResponse.json({ error: "Invalid assignee" }, { status: 400 })
    }
  }

  const task = await prisma.task.create({
    data: {
      name: name.trim(),
      description: typeof description === "string" && description.trim() !== "" ? description.trim() : null,
      dueDate: parsedDate,
      familyId,
      assignees: {
        create: ids.map((userId) => ({ userId })),
      },
    },
    include: { assignees: { select: assigneeSelect } },
  })

  return NextResponse.json({ task }, { status: 201 })
}
```

- [ ] **Step 2: Verify manually — start dev server and test GET**

```bash
npm run dev
```

In another terminal (replace cookie with a real session cookie from the browser):
```bash
curl -s http://localhost:3000/api/tasks -H "Cookie: next-auth.session-token=<token>" | jq .
```

Expected: `{ "tasks": [] }` (empty array, no errors)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tasks/route.ts
git commit -m "feat: add GET and POST /api/tasks"
```

---

## Task 3: API — PATCH and DELETE /api/tasks/[id]

**Files:**
- Create: `src/app/api/tasks/[id]/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/tasks/[id]/route.ts`:

```typescript
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
    if (typeof dueDate !== "string") return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 })
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
  }

  const task = await prisma.task.update({
    where: { id },
    data,
    include: { assignees: { select: assigneeSelect } },
  })
  return NextResponse.json({ task })
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

  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/tasks/[id]/route.ts
git commit -m "feat: add PATCH and DELETE /api/tasks/[id]"
```

---

## Task 4: Navbar — add Tasks link

**Files:**
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: Add CheckSquare to lucide import**

In `src/components/Navbar.tsx`, find the lucide-react import line and add `CheckSquare`:

```typescript
import { Bot, Calendar, CalendarDays, Settings, LogOut, UtensilsCrossed, ChevronDown, ShoppingCart, CheckSquare } from "lucide-react"
```

- [ ] **Step 2: Add Tasks to navLinks**

In `src/components/Navbar.tsx`, in the `navLinks` array, add after the Shopping entry:

```typescript
{ href: "/tasks", label: "Tasks", icon: CheckSquare },
```

- [ ] **Step 3: Verify in browser**

Run `npm run dev`, open the app — confirm "Tasks" appears in the navbar and links to `/tasks` (which 404s for now, that's fine).

- [ ] **Step 4: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat: add Tasks link to navbar"
```

---

## Task 5: Tasks page

**Files:**
- Create: `src/app/tasks/page.tsx`
- Create: `src/app/tasks/TaskModal.tsx`
- Create: `src/app/tasks/tasks.module.css`

### Date helpers (used in both files)

Both the page and modal work with dates as `YYYY-MM-DD` strings (the API accepts and returns ISO strings; we slice the date portion).

```typescript
// Convert Prisma DateTime ISO string → YYYY-MM-DD
function toDateStr(iso: string): string {
  return iso.slice(0, 10)
}

// Today as YYYY-MM-DD (UTC)
function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// End of current week (Sunday) as YYYY-MM-DD (UTC)
function endOfWeekStr(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  const daysUntilSunday = (7 - d.getUTCDay()) % 7
  d.setUTCDate(d.getUTCDate() + daysUntilSunday)
  return d.toISOString().slice(0, 10)
}
```

- [ ] **Step 1: Create tasks.module.css**

Create `src/app/tasks/tasks.module.css`:

```css
/* src/app/tasks/tasks.module.css */
.page {
  max-width: 700px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.headerActions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.showDoneToggle {
  background: none;
  border: none;
  font-size: 0.875rem;
  color: var(--secondary);
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.newBtn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--foreground);
  color: var(--background);
  border: none;
  border-radius: 6px;
  padding: 0.45rem 0.9rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.newBtn:hover {
  opacity: 0.85;
}

/* Section */
.section {
  margin-bottom: 1.75rem;
}

.sectionLabel {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--secondary);
  margin-bottom: 0.5rem;
}

.sectionLabel.overdue {
  color: #e05252;
}

/* Task row */
.taskRow {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--border, #e5e7eb);
  cursor: pointer;
}

.taskRow:last-child {
  border-bottom: none;
}

.taskRow:hover .taskName {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.checkbox {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  cursor: pointer;
  accent-color: var(--foreground);
}

.taskInfo {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
}

.taskName {
  font-size: 0.9375rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.taskMeta {
  font-size: 0.8rem;
  color: var(--secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.taskMeta.overdue {
  color: #e05252;
}

.taskDone .taskName {
  text-decoration: line-through;
  color: var(--secondary);
}

.empty {
  font-size: 0.9rem;
  color: var(--secondary);
  padding: 0.5rem 0;
}

/* Modal */
.modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.modal {
  background: var(--background);
  border-radius: 10px;
  padding: 1.5rem;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.modalTitle {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 1.25rem;
}

.field {
  margin-bottom: 1rem;
}

.label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 0.35rem;
  color: var(--secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.input,
.textarea {
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 6px;
  font-size: 0.9375rem;
  background: var(--background);
  color: var(--foreground);
  box-sizing: border-box;
}

.textarea {
  resize: vertical;
  min-height: 80px;
}

.input:focus,
.textarea:focus {
  outline: 2px solid var(--foreground);
  outline-offset: 1px;
}

/* Assignee multi-select */
.assigneeList {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.assigneeChip {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  border: 1px solid var(--border, #e5e7eb);
  font-size: 0.8125rem;
  cursor: pointer;
  background: var(--background);
  color: var(--foreground);
  transition: background 0.1s;
}

.assigneeChip.selected {
  background: var(--foreground);
  color: var(--background);
  border-color: var(--foreground);
}

.modalFooter {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
  justify-content: flex-end;
}

.saveBtn {
  background: var(--foreground);
  color: var(--background);
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.1rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.saveBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancelBtn {
  background: none;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 6px;
  padding: 0.5rem 1.1rem;
  font-size: 0.875rem;
  cursor: pointer;
  color: var(--foreground);
}

.deleteBtn {
  background: none;
  border: none;
  color: #e05252;
  font-size: 0.875rem;
  cursor: pointer;
  margin-right: auto;
  padding: 0.5rem 0;
}

.deleteBtn:hover {
  text-decoration: underline;
}

.error {
  color: #e05252;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

/* Mobile */
@media (max-width: 768px) {
  .page {
    padding: 1.25rem 1rem;
  }

  .title {
    font-size: 1.25rem;
  }

  .taskName {
    font-size: 0.875rem;
  }

  .modal {
    padding: 1.25rem;
  }
}
```

- [ ] **Step 2: Create TaskModal.tsx**

Create `src/app/tasks/TaskModal.tsx`:

```typescript
// src/app/tasks/TaskModal.tsx
"use client"

import { useState, useEffect } from "react"
import styles from "./tasks.module.css"

type Member = { id: string; name: string | null }

export type TaskData = {
  id: string
  name: string
  description: string | null
  dueDate: string // YYYY-MM-DD
  done: boolean
  assignees: { userId: string; user: { id: string; name: string | null } }[]
}

type Props = {
  task?: TaskData | null  // null/undefined = create mode
  members: Member[]
  onSave: (data: { name: string; description: string; dueDate: string; assigneeIds: string[] }) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

export function TaskModal({ task, members, onSave, onDelete, onClose }: Props) {
  const isEdit = !!task
  const [name, setName] = useState(task?.name ?? "")
  const [description, setDescription] = useState(task?.description ?? "")
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "")
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    task?.assignees.map((a) => a.userId) ?? []
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return }
    if (!dueDate) { setError("Due date is required"); return }
    setSaving(true)
    setError("")
    try {
      await onSave({ name: name.trim(), description: description.trim(), dueDate, assigneeIds })
    } catch (e: any) {
      setError(e?.message ?? "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDelete || !confirm("Delete this task?")) return
    setDeleting(true)
    try {
      await onDelete()
    } catch {
      setError("Failed to delete")
      setDeleting(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <h2 className={styles.modalTitle}>{isEdit ? "Edit task" : "New task"}</h2>

        <div className={styles.field}>
          <label className={styles.label}>Name *</label>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Task name"
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Description</label>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details…"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Due date *</label>
          <input
            type="date"
            className={styles.input}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Assignees</label>
          <div className={styles.assigneeList}>
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`${styles.assigneeChip} ${assigneeIds.includes(m.id) ? styles.selected : ""}`}
                onClick={() => toggleAssignee(m.id)}
              >
                {m.name ?? m.id}
              </button>
            ))}
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.modalFooter}>
          {isEdit && onDelete && (
            <button className={styles.deleteBtn} onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create page.tsx**

Create `src/app/tasks/page.tsx`:

```typescript
// src/app/tasks/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect, useCallback } from "react"
import { Plus } from "lucide-react"
import { TaskModal, TaskData } from "./TaskModal"
import styles from "./tasks.module.css"

type Member = { id: string; name: string | null }

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function endOfWeekStr() {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  const daysUntilSunday = (7 - d.getUTCDay()) % 7
  d.setUTCDate(d.getUTCDate() + daysUntilSunday)
  return d.toISOString().slice(0, 10)
}

function toDateStr(iso: string) {
  return iso.slice(0, 10)
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function assigneeNames(task: TaskData) {
  return task.assignees.map((a) => a.user.name ?? "?").join(", ")
}

export default function TasksPage() {
  const { status } = useSession()
  const [tasks, setTasks] = useState<TaskData[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showDone, setShowDone] = useState(false)
  const [modalTask, setModalTask] = useState<TaskData | null | undefined>(undefined) // undefined = closed, null = new

  const fetchTasks = useCallback(async (includeDone: boolean) => {
    const r = await fetch(`/api/tasks${includeDone ? "?includeDone=true" : ""}`)
    const data = await r.json()
    setTasks(
      (data.tasks ?? []).map((t: any) => ({
        ...t,
        dueDate: toDateStr(t.dueDate),
      }))
    )
  }, [])

  useEffect(() => {
    if (status !== "authenticated") return
    Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/family/members").then((r) => r.json()),
    ]).then(([taskData, memberData]) => {
      setTasks(
        (taskData.tasks ?? []).map((t: any) => ({
          ...t,
          dueDate: toDateStr(t.dueDate),
        }))
      )
      setMembers(memberData.members ?? [])
    }).finally(() => setLoading(false))
  }, [status])

  async function toggleDone(task: TaskData) {
    const updated = { ...task, done: !task.done }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done }),
    })
    // If hiding done tasks, remove from list after toggle
    if (!showDone && !task.done) {
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
    }
  }

  async function handleSave(data: { name: string; description: string; dueDate: string; assigneeIds: string[] }) {
    if (modalTask === null) {
      // Create
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error ?? "Failed to create")
      }
      const { task } = await r.json()
      setTasks((prev) => [...prev, { ...task, dueDate: toDateStr(task.dueDate) }].sort((a, b) => a.dueDate.localeCompare(b.dueDate)))
    } else if (modalTask) {
      // Update
      const r = await fetch(`/api/tasks/${modalTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error ?? "Failed to update")
      }
      const { task } = await r.json()
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...task, dueDate: toDateStr(task.dueDate) } : t))
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      )
    }
    setModalTask(undefined)
  }

  async function handleDelete() {
    if (!modalTask || modalTask === null) return
    const r = await fetch(`/api/tasks/${modalTask.id}`, { method: "DELETE" })
    if (!r.ok) throw new Error("Failed to delete")
    setTasks((prev) => prev.filter((t) => t.id !== modalTask.id))
    setModalTask(undefined)
  }

  async function handleShowDoneToggle() {
    const next = !showDone
    setShowDone(next)
    await fetchTasks(next)
  }

  if (status === "loading" || loading) return null

  const today = todayStr()
  const endOfWeek = endOfWeekStr()

  const openTasks = tasks.filter((t) => !t.done)
  const doneTasks = tasks.filter((t) => t.done)

  const overdue = openTasks.filter((t) => t.dueDate < today)
  const thisWeek = openTasks.filter((t) => t.dueDate >= today && t.dueDate <= endOfWeek)
  const later = openTasks.filter((t) => t.dueDate > endOfWeek)

  function TaskRow({ task }: { task: TaskData }) {
    const dateStr = toDateStr(task.dueDate)
    const isOverdue = dateStr < today
    const names = assigneeNames(task)
    return (
      <div
        className={`${styles.taskRow} ${task.done ? styles.taskDone : ""}`}
        onClick={() => setModalTask(task)}
      >
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={task.done}
          onChange={(e) => { e.stopPropagation(); toggleDone(task) }}
          onClick={(e) => e.stopPropagation()}
        />
        <div className={styles.taskInfo}>
          <span className={styles.taskName}>{task.name}</span>
          <span className={`${styles.taskMeta} ${isOverdue && !task.done ? styles.overdue : ""}`}>
            {formatDate(dateStr)}{names ? ` · ${names}` : ""}
          </span>
        </div>
      </div>
    )
  }

  function Section({ label, tasks, isOverdue }: { label: string; tasks: TaskData[]; isOverdue?: boolean }) {
    if (tasks.length === 0) return null
    return (
      <div className={styles.section}>
        <div className={`${styles.sectionLabel} ${isOverdue ? styles.overdue : ""}`}>{label}</div>
        {tasks.map((t) => <TaskRow key={t.id} task={t} />)}
      </div>
    )
  }

  const hasAnyOpen = overdue.length > 0 || thisWeek.length > 0 || later.length > 0

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Tasks</h1>
        <div className={styles.headerActions}>
          <button className={styles.showDoneToggle} onClick={handleShowDoneToggle}>
            {showDone ? "Hide done" : "Show done"}
          </button>
          <button className={styles.newBtn} onClick={() => setModalTask(null)}>
            <Plus size={14} strokeWidth={2.5} />
            New task
          </button>
        </div>
      </div>

      {!hasAnyOpen && doneTasks.length === 0 && (
        <p className={styles.empty}>No tasks yet. Create one to get started.</p>
      )}

      <Section label="Overdue" tasks={overdue} isOverdue />
      <Section label="This week" tasks={thisWeek} />
      <Section label="Later" tasks={later} />

      {showDone && doneTasks.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Done</div>
          {doneTasks.map((t) => <TaskRow key={t.id} task={t} />)}
        </div>
      )}

      {modalTask !== undefined && (
        <TaskModal
          task={modalTask}
          members={members}
          onSave={handleSave}
          onDelete={modalTask ? handleDelete : undefined}
          onClose={() => setModalTask(undefined)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify in browser**

Open `http://localhost:3000/tasks`. Verify:
- Page loads with empty state "No tasks yet."
- Clicking "New task" opens the modal with all family members as chips
- Creating a task saves it and it appears in the correct section
- Clicking a task opens the edit modal
- Checking the checkbox marks it done and removes it from the list
- "Show done" toggle reveals the Done section

- [ ] **Step 5: Commit**

```bash
git add src/app/tasks/page.tsx src/app/tasks/TaskModal.tsx src/app/tasks/tasks.module.css
git commit -m "feat: add tasks page with create/edit modal"
```

---

## Task 6: Homepage widget

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.module.css`

- [ ] **Step 1: Add tasks CSS to page.module.css**

In `src/app/page.module.css`, append at the end:

```css
/* Tasks widget */
.tasksWidget {
  margin-bottom: 2rem;
}

.tasksWidgetTitle {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--secondary);
  margin-bottom: 0.5rem;
}

.tasksWidgetRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.45rem 0;
  border-bottom: 1px solid var(--border, #e5e7eb);
  font-size: 0.9rem;
}

.tasksWidgetRow:last-of-type {
  border-bottom: none;
}

.tasksWidgetName {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 65%;
}

.tasksWidgetMeta {
  font-size: 0.8rem;
  color: var(--secondary);
  white-space: nowrap;
}

.tasksWidgetMeta.overdue {
  color: #e05252;
}

.tasksWidgetLink {
  display: inline-block;
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: var(--secondary);
  text-decoration: none;
}

.tasksWidgetLink:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .tasksWidget {
    margin-bottom: 1.5rem;
  }
}
```

- [ ] **Step 2: Add TasksWidget component and wire up in page.tsx**

In `src/app/page.tsx`:

1. Add `FamilyTask` type near the top:

```typescript
type FamilyTask = {
  id: string
  name: string
  dueDate: string // YYYY-MM-DD
  assignees: { userId: string; user: { id: string; name: string | null } }[]
}
```

2. Add tasks state after the existing state declarations:

```typescript
const [tasks, setTasks] = useState<FamilyTask[]>([])
```

3. In the `Promise.all` inside `useEffect`, add the tasks fetch as a third entry:

```typescript
Promise.all([
  fetch("/api/weeks").then((r) => r.json()),
  fetch("/api/weather").then((r) => r.json()),
  fetch("/api/tasks").then((r) => r.json()),
])
  .then(([weeksData, weatherData, taskData]) => {
    // ... existing weeks/weather logic unchanged ...
    setTasks(
      (taskData.tasks ?? []).map((t: any) => ({
        ...t,
        dueDate: (t.dueDate as string).slice(0, 10),
      }))
    )
  })
```

4. Add a `TasksWidget` component at the bottom of the file (before `CredentialsForm`):

```typescript
function TasksWidget({ tasks }: { tasks: FamilyTask[] }) {
  const today = new Date().toISOString().slice(0, 10)
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  const daysUntilSunday = (7 - d.getUTCDay()) % 7
  d.setUTCDate(d.getUTCDate() + daysUntilSunday)
  const endOfWeek = d.toISOString().slice(0, 10)

  const visible = tasks.filter(
    (t) => t.dueDate < today || (t.dueDate >= today && t.dueDate <= endOfWeek)
  )
  if (visible.length === 0) return null

  function formatDate(dateStr: string) {
    const [year, month, day] = dateStr.split("-").map(Number)
    return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  return (
    <div className={styles.tasksWidget}>
      <div className={styles.tasksWidgetTitle}>Tasks this week</div>
      {visible.map((t) => {
        const isOverdue = t.dueDate < today
        const names = t.assignees.map((a) => a.user.name ?? "?").join(", ")
        return (
          <div key={t.id} className={styles.tasksWidgetRow}>
            <span className={styles.tasksWidgetName}>{t.name}</span>
            <span className={`${styles.tasksWidgetMeta}${isOverdue ? ` ${styles.overdue}` : ""}`}>
              {formatDate(t.dueDate)}{names ? ` · ${names}` : ""}
            </span>
          </div>
        )
      })}
      <a href="/tasks" className={styles.tasksWidgetLink}>→ All tasks</a>
    </div>
  )
}
```

5. In the authenticated `return`, render `<TasksWidget tasks={tasks} />` above the `WeekBlock`:

```typescript
return (
  <main className={styles.main}>
    <div className={styles.hero}>
      <h1 className={styles.greeting}>
        {greeting}, {firstName}
      </h1>
      <p className={styles.subtitle}>Here&apos;s what&apos;s going on this week.</p>
    </div>

    <TasksWidget tasks={tasks} />

    {week ? (
      <WeekBlock ... />
    ) : (
      <p ...>...</p>
    )}
  </main>
)
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000`. Verify:
- If tasks exist with due dates this week or overdue: widget appears above the week block with correct grouping and red color for overdue
- If no qualifying tasks: widget is hidden
- "→ All tasks" link works

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/page.module.css
git commit -m "feat: add tasks widget to homepage"
```

---

## Done

All six tasks complete. The feature is fully functional:
- `/tasks` page with Overdue / This week / Later grouping, modal create/edit, done toggle
- Homepage widget above the week block showing tasks due this week + overdue
- Tasks nav link in the navbar
