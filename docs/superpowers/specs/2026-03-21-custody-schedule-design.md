# Custody Schedule Feature — Design Spec

**Date:** 2026-03-21
**Status:** Approved

## Overview

Add a custody schedule feature to the calendar page so parents can track where Emilia sleeps each night. The feature fits naturally alongside birthdays and travel entries: a colored pill per day cell, a toolbar modal for bulk setup, and an inline popover for single-day edits.

---

## Data Layer

### Schema

No schema changes required. The existing `CustodySchedule` model is a perfect fit:

```prisma
model CustodySchedule {
  id         String          @id @default(cuid())
  date       DateTime        @db.Date
  personName String
  location   CustodyLocation
  familyId   String
  family     Family          @relation(fields: [familyId], references: [id])

  @@unique([date, personName, familyId])
}

enum CustodyLocation {
  WITH_US
  WITH_MONA
}
```

### Recurrence strategy

Recurrence is a UI convenience only — the database always stores individual per-day rows. When the user saves a recurring schedule, the server expands the rule into one `CustodySchedule` row per day for the full date range. Editing a single day is a standard PATCH or DELETE on that row.

---

## API Routes

### Changes to `/api/calendar/events` route

**File:** `src/app/api/calendar/events/route.ts`

The existing aggregator already fetches birthdays and travels. Add a custody query in the same pattern, scoped by date range:

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
```

Passing `Date` objects for `gte`/`lte` against a `@db.Date` column is safe — PostgreSQL coerces them correctly. No additional serialization is needed at the query level.

No standalone `GET /api/calendar/custody` route is needed. All reads happen through the aggregator. The popover receives its data from client-side state, not a fresh API call.

Serialize each entry's `date` as a `YYYY-MM-DD` string before returning (Prisma returns `DateTime @db.Date` as a full ISO timestamp):

```ts
const serializedCustody = custodyEntries.map((c) => ({
  ...c,
  date: c.date.toISOString().split("T")[0],
}))
```

Return it under a `custodyEntries` key alongside existing keys:

```json
{
  "googleEvents": [...],
  "birthdays": [...],
  "travels": [...],
  "custodyEntries": [
    { "id": "...", "date": "2026-03-22", "personName": "Emilia", "location": "WITH_US" }
  ],
  "calendarSyncCount": 2
}
```

### `POST /api/calendar/custody`

**File:** `src/app/api/calendar/custody/route.ts`

Creates one or more custody entries. `personName` is not accepted from the client — it is hardcoded server-side to `"Emilia"` for now.

**Request body:**
```json
{
  "startDate": "2026-03-22",
  "startsWith": "WITH_US",
  "recurring": true,
  "until": "2026-09-01"
}
```

**Validation:**
- `recurring` must be a JSON boolean; `startDate` and `startsWith` are required
- When `recurring=true`: `until` is required (return 400 if absent); return 400 if `until` < `startDate`; return 400 if range exceeds 730 days
- When `recurring=false`: `until` is ignored entirely — do not validate it
- Return 401 if unauthenticated or no `familyId`

**Server logic for `recurring=true`:**

Iterate day-by-day from `startDate` through `until` (inclusive). Start with `currentLocation = startsWith`. On each day: if the day is a Sunday **and** it is not `startDate`, flip `currentLocation`. Write one row per day using `upsert` on `[date, personName, familyId]` to overwrite any existing entries.

Worked example — `startDate: 2026-03-22` (Sunday), `startsWith: WITH_US`:

| Date | Day | Location |
|------|-----|----------|
| 2026-03-22 | Sun | WITH_US ← startDate, no flip |
| 2026-03-23 | Mon | WITH_US |
| 2026-03-28 | Sat | WITH_US |
| 2026-03-29 | Sun | WITH_MONA ← Sunday, flip |
| 2026-03-30 | Mon | WITH_MONA |
| 2026-04-04 | Sat | WITH_MONA |
| 2026-04-05 | Sun | WITH_US ← Sunday, flip back |

Worked example — `startDate: 2026-03-25` (Wednesday), `startsWith: WITH_US`:

| Date | Day | Location |
|------|-----|----------|
| 2026-03-25 | Wed | WITH_US ← startDate |
| 2026-03-26 | Thu | WITH_US |
| 2026-03-27 | Fri | WITH_US |
| 2026-03-28 | Sat | WITH_US |
| 2026-03-29 | Sun | WITH_MONA ← Sunday, flip |
| 2026-03-30 | Mon | WITH_MONA |
| 2026-04-05 | Sun | WITH_US ← Sunday, flip back |

All upserts are wrapped in a single `prisma.$transaction([...ops])` (array-form transaction, not interactive) so a partial failure rolls back the entire batch. Build the array of `prisma.custodySchedule.upsert(...)` calls first, then pass the array to `prisma.$transaction`.

**Server logic for `recurring=false`:**

Write exactly one row for `startDate` with location `startsWith`. The `until` field is ignored.

**Response:** `201` with `{ "count": N }` — the number of rows written.

### `PATCH /api/calendar/custody/[id]`

**File:** `src/app/api/calendar/custody/[id]/route.ts`

Updates a single entry's `location`. Fetch the entry first with `prisma.custodySchedule.findUnique`; return 404 if not found. Return 403 if `entry.familyId !== session.familyId`.

```json
{ "location": "WITH_MONA" }
```

Returns `200` with the updated entry (with `date` serialized as `YYYY-MM-DD`).

### `DELETE /api/calendar/custody/[id]`

**File:** `src/app/api/calendar/custody/[id]/route.ts`

Removes a single day's entry. Fetch the entry first; return 404 if not found. Return 403 if `entry.familyId !== session.familyId`. Returns `200 { "ok": true }`.

After deleting, if the user wants to re-add custody for that day, they must use the "Add Custody" modal (non-recurring, single-day). The popover only appears on existing pills, so it is not available for days with no entry.

---

## Calendar Page Changes (`src/app/calendar/page.tsx`)

### State

Extend the `events` state object with `custodyEntries: any[]`:

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

The `fetchEvents` response handler adds: `custodyEntries: data.custodyEntries ?? []`.

Add popover state: `openCustodyId: string | null` (default `null`). Stores the `id` of the currently open custody popover; `null` means no popover is open.

`openCustodyId` must be reset to `null` in: `closeModal()`, the "Add Custody" toolbar button click handler, `prevMonth()`, and `nextMonth()`.

Add Add Custody modal form state:
- `cStart: string` — `"WITH_US"`
- `cStartsWith: "WITH_US" | "WITH_MONA"` — `"WITH_US"`
- `cRecurring: boolean` — `true`
- `cUntil: string` — empty string (recomputed on each modal open)

When the "Add Custody" button is clicked, reset form state to fresh defaults computed at that moment:
- `cStart = new Date().toISOString().split("T")[0]`
- `cStartsWith = "WITH_US"`
- `cRecurring = true`
- `cUntil = new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString().split("T")[0]`

### `ModalType`

Extend to `"NONE" | "BIRTHDAY" | "TRAVEL" | "CUSTODY"`.

### `getEventsForDay`

Add custody matching. Since the API returns `date` as a `YYYY-MM-DD` string, compare as strings to avoid timezone issues:

```ts
const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

const custody = events.custodyEntries.filter((c) => c.date === dateStr)
```

Return shape becomes `{ google, birthdays, travels, custody }`.

### Pill rendering

Custody pills are rendered in each day cell **first** (before Google events, birthdays, and travels), using the existing `.eventItem` CSS class plus a new location variant. Each pill is a wrapper that also contains its popover, rendered via React portal (see Popover section).

```tsx
{dayEvents.custody.map((c) => (
  <div key={c.id} style={{ position: "relative" }}>
    <div
      className={`${styles.eventItem} ${c.location === "WITH_US" ? styles.custodyHomeEvent : styles.custodyMonaEvent}`}
      style={{ cursor: "pointer" }}
      onClick={(e) => {
        e.stopPropagation()
        setOpenCustodyId(openCustodyId === c.id ? null : c.id)
      }}
    >
      <span>{c.location === "WITH_US" ? "🏠 Emilia home" : "👤 Emilia @ Mona"}</span>
    </div>
    {openCustodyId === c.id && (
      <CustodyPopover
        entry={c}
        anchorDate={dayObj.date}
        onClose={() => setOpenCustodyId(null)}
        onSave={fetchEvents}
      />
    )}
  </div>
))}
```

### `CustodyPopover` component

The popover **must use `ReactDOM.createPortal`** rendered to `document.body`. This is required because `.calendarGrid` has `overflow: hidden` (needed for its `border-radius`), which would clip any absolutely-positioned child. The portal escapes the clipping context.

The popover is positioned using the pill element's `getBoundingClientRect()`. The pill wrapper `<div>` holds a `ref` (e.g. `anchorRef`); this ref is passed to `CustodyPopover` as an `anchorRef` prop. On mount the popover reads `anchorRef.current.getBoundingClientRect()` and sets `top`/`left` via `useState` (computed as `rect.bottom + window.scrollY` and `rect.left + window.scrollX`).

Scroll and resize repositioning are **out of scope** — the popover is short-lived and the calendar is not a scrollable container. Viewport overflow clamping is also **out of scope** for now.

A click-outside handler (`useEffect` with `mousedown` on `document`) dismisses the popover. The handler must check that the click target is not inside the popover itself (use a `ref` on the popover element).

All buttons inside the popover call `e.stopPropagation()` to prevent the click from bubbling to the pill's toggle handler.

**Popover content:**

- Label: date string (e.g. "22 March · Emilia") — derived from `entry.date`
- **"🏠 With us"** button — highlighted with `.custodyPopoverBtnActive` + `.custodyHomeEvent` if currently `WITH_US`; on click: PATCH → `fetchEvents()` → `onClose()`
- **"👤 With Mona"** button — highlighted with `.custodyPopoverBtnActive` + `.custodyMonaEvent` if currently `WITH_MONA`; on click: PATCH → `fetchEvents()` → `onClose()`
- **"✕ Clear this day"** button — single-tap DELETE (no confirmation; low-risk since schedule is re-creatable); on click: DELETE → `fetchEvents()` → `onClose()`

Buttons are disabled while a PATCH or DELETE is in-flight (track with a `loading: boolean` state inside the component) to prevent duplicate requests. If the request fails, the popover stays open and shows a small inline error message below the buttons (`.custodyPopoverError`). The error is cleared when the user clicks a button again.

### Add Custody modal (`modal === "CUSTODY"`)

A **"Add Custody"** toolbar button (icon: `<Home size={14} />` from `lucide-react`) opens the modal. Resets form state to fresh defaults (see State section) and sets `modal = "CUSTODY"` and `openCustodyId = null`.

**Modal fields:**

| Field | Type | Default |
|---|---|---|
| First night | `<input type="date">` | today as `YYYY-MM-DD` |
| Emilia sleeps at | two toggle buttons | "With us" selected |
| Recurring | toggle switch | `true` |
| Until | `<input type="date">` — shown only when `cRecurring=true` | 6 months from today |

When `cRecurring` is true, show a read-only line:
*"Alternating weeks · switches on Sunday"*

Helper text below "Until" (when recurring):
`Creates ~${Math.round((new Date(cUntil).getTime() - new Date(cStart).getTime()) / (7 * 24 * 60 * 60 * 1000))} weeks of schedule entries`

On save: POST → if error, set `modalError` and do not close; on success, call `fetchEvents()` then `closeModal()`. The modal follows the same `modalError` pattern used by birthday and travel modals.

---

## CSS additions (`calendar.module.css`)

```css
/* Custody pills */
.custodyHomeEvent {
  background: #eff6ff;
  color: #1d4ed8;
}

.custodyMonaEvent {
  background: #fdf2f8;
  color: #9d174d;
}

/* Popover (portal — appended to document.body, fixed position) */
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
}

.custodyPopoverBtn:hover {
  background: var(--surface-hover);
}

.custodyPopoverBtnActive {
  border-width: 2px;
  font-weight: 700;
}

/* Active states reuse the pill color variables */
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
```

The popover uses only CSS custom properties (`var(--background)`, `var(--border)`, `var(--foreground)`, `var(--secondary)`, `var(--surface-hover)`) for base styles — these variables already handle dark mode globally. No additional dark-mode overrides needed for the popover itself.

Dark mode overrides for pills and active popover button states (which use hardcoded hex colors):
```css
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
}
```

---

## Empty State

No special empty-state treatment. If no custody entries exist for a month, the calendar shows no custody pills. No prompt.

---

## Permissions

Any authenticated user belonging to the family can read and write custody entries for that family. No per-user ownership — only `familyId` is checked. This matches the existing birthday pattern.

---

## Out of Scope

- Configurable recurrence patterns (only alternating weekly is supported)
- Multiple children (`personName` is hardcoded to `"Emilia"` server-side; the UI shows no person-name field)
- Series-level editing (edit all future days at once)
- Custody display on the week planner page
