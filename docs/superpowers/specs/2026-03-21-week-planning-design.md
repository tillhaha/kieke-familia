# Week Planning — Design Spec

**Date:** 2026-03-21
**Status:** Approved

---

## Overview

Replace the disabled "Meal Planning" feature with a "Week Planning" page. Each week (Sun–Sat) is a grid with days as columns and planning fields as rows. Weeks are created explicitly by the user via a "Plan next week" button and persist in the database. Past weeks are visible by scrolling down.

---

## Data Model

### New model: `DayPlan`

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
```

All content fields are nullable — a freshly created week starts fully blank.

### New model: `CustodySchedule` (schema only, no API or UI in this feature)

```prisma
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

Included in schema now so the table is ready for future use. API and UI are out of scope for this feature.

### Removed

- `MealPlan` model (unused)
- `MealType` enum (unused)

### Updated

`Family` model gains `dayPlans DayPlan[]` and `custodySchedule CustodySchedule[]` relations.

---

## API Endpoints

All endpoints return `401 { error: "Unauthorized" }` if the user has no active session. All are scoped to `session.user.familyId`; return `403 { error: "Forbidden" }` if `familyId` is null.

### `GET /api/weeks`

Returns all DayPlans for the family grouped into Sun–Sat weeks, sorted newest first.

**Response:**
```json
{
  "weeks": [
    {
      "startDate": "2026-03-22",
      "endDate": "2026-03-28",
      "days": [
        {
          "date": "2026-03-22",
          "id": "...",
          "note": null,
          "lunch": null,
          "dinner": null,
          "dinnerActivity": null
        }
      ]
    }
  ]
}
```

Each week always contains exactly 7 day objects (Sun–Sat), derived from the DayPlans in the database.

### `POST /api/weeks`

Creates 7 blank DayPlan rows for the next unplanned Sun–Sat week.

**Logic:** Find the latest `date` among existing DayPlans for the family. The next week starts on the Sunday after that date. If no DayPlans exist, the next week is the upcoming Sunday (or current Sunday if today is Sunday).

**Validation:** If all 7 days of the next week already exist, return `409 { error: "Next week already planned" }`.

**Success:** `201` — the newly created week in the same shape as the `GET` response's week object.

**Error:** DB failure → `500 { error: "Failed to create week" }`.

### `PATCH /api/weeks/days/[date]`

Updates a single day. `[date]` is an ISO 8601 date string (`YYYY-MM-DD`).

**Request body:** Any subset of `{ note, lunch, dinner, dinnerActivity }` — all optional strings (or null to clear).

**Validation:**
- `date` must parse to a valid date → `400 { error: "Invalid date" }`
- At least one field must be present → `400 { error: "No fields to update" }`
- The DayPlan for that date must exist for the family → `404 { error: "Not found" }`

**Success:** `200` — updated DayPlan object.

**Error:** DB failure → `500 { error: "Failed to update day" }`.

---

## UI

### Navigation

- Route changes from `/meals` to `/week`
- Nav label changes from `"Meals"` to `"Week planning"`
- Nav icon changes from `UtensilsCrossed` to `CalendarDays` (lucide-react)
- Nav link enabled: `true`
- Home page feature card updated: label `"Week planning"`, description `"Plan the week ahead together."`, enabled

### Page: `/week`

Client component. Redirects to `/` if unauthenticated.

**Layout:**
```
[ Plan next week ]          ← top of page, right-aligned

── Mar 22 – Mar 28, 2026 ──
┌──────────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│          │ Sun │ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │
│          │ 22  │ 23  │ 24  │ 25  │ 26  │ 27  │ 28  │
├──────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ Note     │     │     │     │     │     │     │     │
├──────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ Lunch    │     │     │     │     │     │     │     │
├──────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ Dinner   │     │     │     │     │     │     │     │
├──────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ Activity │     │     │     │     │     │     │     │
└──────────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘

── Mar 15 – Mar 21, 2026 ──   ← older weeks below, scroll down
...
```

**"Plan next week" button:**
- Calls `POST /api/weeks`
- On success: prepends the new week to the top of the list
- Shows a brief loading state while the request is in flight
- Disabled while loading

**Week header:** `Sun DD Mon – Sat DD Mon, YYYY` (e.g. `Sun 22 Mar – Sat 28 Mar, 2026`)

**Grid cells:**
- Each cell is a `<textarea>` with `rows=2`, auto-resize on content
- Placeholder text: `"Note…"` / `"Lunch…"` / `"Dinner…"` / `"Activity…"` (shown in the row header, not per-cell)
- On blur: fires `PATCH /api/weeks/days/[date]` with only the changed field
- Save is silent (no visible save button or success toast)
- On save error: cell border turns red briefly, value reverts to last saved state
- Past weeks (all 7 days before today): cells are read-only (`disabled`)

**State:**
- `weeks`: array of week objects loaded from `GET /api/weeks`
- `planning`: boolean — true while `POST /api/weeks` is in flight
- Per-cell local state tracks the current input value; on blur compares to last saved value and only fires PATCH if changed

---

## File Changes

| File | Action | Notes |
|------|--------|-------|
| `prisma/schema.prisma` | Modify | Remove `MealPlan`, `MealType`; add `DayPlan`, `CustodySchedule`, `CustodyLocation`; update `Family` relations |
| `src/app/api/weeks/route.ts` | Create | GET + POST handlers |
| `src/app/api/weeks/days/[date]/route.ts` | Create | PATCH handler |
| `src/app/week/page.tsx` | Create | Week planning page |
| `src/app/week/week.module.css` | Create | Page styles |
| `src/components/Navbar.tsx` | Modify | `/meals` → `/week`, label, icon, enabled |
| `src/app/page.tsx` | Modify | Update feature card for week planning |

---

## Out of Scope

- CustodySchedule API and UI (schema only)
- Deleting a planned week
- Editing past weeks
- Mobile-optimized layout (the grid is inherently wide)
