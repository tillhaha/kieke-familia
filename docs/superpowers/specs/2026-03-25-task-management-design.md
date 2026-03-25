# Task Management — Design Spec
_Date: 2026-03-25_

## Overview

Add family-scoped task management to Familia. Tasks have a name, optional description, due date, done state, and multiple assignees drawn from the family's user list. A dedicated `/tasks` page lets the family create and manage tasks; the homepage shows a compact widget of tasks due this week and overdue ones.

---

## Data Model

Two new Prisma models added to the schema. Tasks belong to a `Family`. Assignees are stored in a join table.

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

`Family` gets a `tasks Task[]` relation. `User` gets a `taskAssignments TaskAssignee[]` relation.

---

## API Routes

All routes gate on `getServerSession` and verify `session.user.familyId` before any DB query.

### `GET /api/tasks`
Returns all tasks for the session's family, sorted ascending by `dueDate`.
- Query param `?includeDone=true` includes done tasks (default: only open tasks).
- Each task includes its assignees (userId + name).

### `POST /api/tasks`
Creates a new task.
- Body: `{ name, description?, dueDate, assigneeIds: string[] }`
- Validates required fields; `assigneeIds` must all belong to the same family.

### `PATCH /api/tasks/[id]`
Updates a task. Accepts any subset of: `{ name, description, dueDate, done, assigneeIds }`.
- When `assigneeIds` is provided, replaces the full assignee set (delete + recreate in a transaction).
- Verifies task belongs to session's family before updating.

### `DELETE /api/tasks/[id]`
Deletes a task (cascades to `TaskAssignee` rows).
- Verifies task belongs to session's family before deleting.

---

## Tasks Page (`/tasks`)

### Layout
Tasks are grouped into three sections sorted by `dueDate` ascending within each group:

| Section | Condition |
|---------|-----------|
| **Overdue** | `dueDate < today` |
| **This week** | `dueDate >= today && dueDate <= end of current week (Sunday)` |
| **Later** | `dueDate > end of current week` |

Each task row shows:
- Checkbox (toggles `done` via `PATCH` instantly)
- Task name
- Due date (short format, e.g. "Mar 26")
- Assignee names (comma-separated)

Clicking a task row opens the edit modal.

### Done tasks
Hidden by default. A "Show done" toggle in the page header re-fetches with `?includeDone=true` and renders done tasks struck-through beneath each group (or in a single "Done" section at the bottom).

### New task modal
Triggered by the "**+ New task**" button. Same modal component is reused for editing.

Fields:
- **Name** — text input, required
- **Description** — textarea, optional
- **Due date** — date picker, required
- **Assignees** — multi-select of all users in the family (name + avatar/initials). At least one is not required.

Modal footer: Save / Cancel (create mode) or Save / Delete / Cancel (edit mode).

---

## Homepage Widget

Positioned **above** the existing `WeekBlock`.

Shows open tasks that are either:
- Overdue (`dueDate < today`), or
- Due this week (`dueDate <= end of current week`)

Sorted by `dueDate` ascending. Overdue tasks display the due date in red.

Each row: task name · due date · assignee names.

Footer: **"→ All tasks"** link to `/tasks`.

If there are no qualifying tasks, the widget is not rendered (no empty-state clutter).

Data is fetched client-side alongside the existing week/weather fetch in `page.tsx`.

---

## Navigation

A **Tasks** entry is added to the `navLinks` array in `Navbar.tsx`:
```ts
{ href: "/tasks", label: "Tasks", icon: CheckSquare }
```

---

## Out of scope
- Task comments or attachments
- Recurring tasks
- Priority levels
- Push / email notifications
- Drag-to-reorder
