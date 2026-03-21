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

All routes are scoped to the authenticated user's `familyId`.

### `GET /api/calendar/custody`

Query params: `timeMin` (ISO date), `timeMax` (ISO date)

Returns all `CustodySchedule` entries for the family within the given range, ordered by date.

```json
[
  { "id": "...", "date": "2026-03-22", "personName": "Emilia", "location": "WITH_US" },
  ...
]
```

### `POST /api/calendar/custody`

Creates one or more custody entries. Accepts either a single entry or a recurring schedule definition.

**Request body:**
```json
{
  "personName": "Emilia",
  "startDate": "2026-03-22",
  "startsWith": "WITH_US",
  "recurring": true,
  "until": "2026-09-01"
}
```

**Server logic for recurring=true:**
- Starting from `startDate`, write one row per day through `until`
- Location starts as `startsWith`; flips every Sunday (the alternating-week changeover day)
- Uses `upsert` on `[date, personName, familyId]` so re-saving a range overwrites existing entries

**Request body (non-recurring / single day):**
```json
{
  "personName": "Emilia",
  "startDate": "2026-03-22",
  "startsWith": "WITH_US",
  "recurring": false,
  "until": "2026-03-22"
}
```

### `PATCH /api/calendar/custody/[id]`

Updates the `location` of a single entry.

```json
{ "location": "WITH_MONA" }
```

### `DELETE /api/calendar/custody/[id]`

Removes a single day's entry. The day then shows no pill in the calendar.

---

## Calendar Page Changes

### Fetching

Custody entries are fetched via `GET /api/calendar/custody` with the same `timeMin`/`timeMax` window already used for other events. The fetch is added to the existing `fetchEvents` function and stored in component state alongside `googleEvents`, `birthdays`, and `travels`.

### Display

Each day cell renders a custody pill when an entry exists for that date:

| Location | Pill style |
|---|---|
| `WITH_US` | Blue background (`#eff6ff`), blue text (`#1d4ed8`), label "🏠 Emilia home" |
| `WITH_MONA` | Pink background (`#fdf2f8`), pink text (`#9d174d`), label "👤 Emilia @ Mona" |

Pills use the existing `.eventItem` CSS class with a new `.custodyEvent` variant for colors. They appear below the day number, ordered before Google events.

### Add Custody modal

A new **"Add Custody"** button is added to the existing toolbar (alongside "Add Birthday" and "Add Travel"). Clicking it opens a modal (`ModalType` extended to include `"CUSTODY"`).

**Modal fields:**

| Field | Type | Default |
|---|---|---|
| First night | date input | today |
| Emilia sleeps at | toggle buttons: "🏠 With us" / "👤 With Mona" | "With us" |
| Recurring | toggle switch | on |
| Until | date input (shown when recurring=on) | 6 months from today |

When recurring is on, a read-only line beneath the toggle reads: *"Alternating weeks · switches on Sunday"*

A helper text below "Until" shows: *"Creates ~N weeks of schedule entries"* (calculated client-side).

On save: POST to `/api/calendar/custody`, then `fetchEvents()`, then close modal.

### Edit popover

Clicking an existing custody pill on any day opens a small inline popover anchored to that pill. The popover contains:

- Date label + "Emilia" (e.g. "Wed 25 · Emilia")
- **"🏠 With us"** button — highlighted if currently `WITH_US`
- **"👤 With Mona"** button — highlighted if currently `WITH_MONA`
- **"✕ Clear this day"** button — deletes the entry

Selecting a different location PATCHes the entry and refreshes. Clearing DELETEs it and refreshes. Clicking outside the popover closes it without changes.

The popover is positioned absolutely relative to the pill and uses a click-outside handler to dismiss. It does not use the existing full-screen modal backdrop.

---

## CSS

Add to `calendar.module.css`:

- `.custodyHomeEvent` — blue pill variant (`WITH_US`)
- `.custodyMonaEvent` — pink pill variant (`WITH_MONA`)
- `.custodyPopover` — popover container (absolute position, white card, shadow)
- `.custodyPopoverBtn` — popover action button (full-width, left-aligned)
- `.custodyPopoverBtnActive` — highlighted state for current selection

---

## Out of Scope

- Configurable recurrence patterns (only alternating weekly is supported)
- Multiple children (personName is hardcoded as "Emilia" in the UI for now)
- Series-level editing (edit all future days at once)
- Custody view on the week planner page
