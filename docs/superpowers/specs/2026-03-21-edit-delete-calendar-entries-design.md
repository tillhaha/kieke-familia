# Edit & Delete Calendar Entries — Design Spec

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Edit and delete for Birthday and Travel entries created through Familia; triggered by clicking event pills in the calendar view.

---

## Overview

Users can click a Birthday or Travel pill in the calendar grid to open the existing modal pre-populated with that entry's data. From there they can update the fields or delete the entry. The "Add Birthday" / "Add Travel" toolbar buttons continue to open the modal in create mode.

---

## API Endpoints

All endpoints return `401 { error: "Unauthorized" }` if the user has no active session, and `404 { error: "Not found" }` if the record doesn't exist or the user is not authorized to modify it (no information leakage).

### `PATCH /api/calendar/birthdays/[id]`

Updates an existing birthday.

**Authorization:** the birthday's `familyId` must match the session user's `familyId`.

**Request body:** `{ name: string, month: number, day: number }`

**Validation:**
| Rule | Response |
|------|----------|
| `name` is a non-empty string | `400 { error: "Name is required" }` |
| `month` is an integer 1–12 | `400 { error: "Month must be between 1 and 12" }` |
| `day` is an integer 1–31 | `400 { error: "Day must be between 1 and 31" }` |

**Success:** `200` — updated birthday object `{ id, name, month, day, familyId }`.

**Error:** DB failure → `500 { error: "Failed to update birthday" }`.

---

### `DELETE /api/calendar/birthdays/[id]`

Deletes an existing birthday.

**Authorization:** the birthday's `familyId` must match the session user's `familyId`.

**Success:** `200 { deleted: true }`.

**Error:** DB failure → `500 { error: "Failed to delete birthday" }`.

---

### `PATCH /api/calendar/travel/[id]`

Updates an existing travel entry.

**Authorization:** the travel's `userId` must match the session user's id.

**Request body:** `{ destination: string, startDate: string (ISO 8601), endDate: string (ISO 8601) }`

**Validation:**
| Rule | Response |
|------|----------|
| `destination` is a non-empty string | `400 { error: "Destination is required" }` |
| `startDate` is a valid date string | `400 { error: "Invalid start date" }` |
| `endDate` is a valid date string | `400 { error: "Invalid end date" }` |
| `endDate` is not before `startDate` | `400 { error: "End date must be on or after start date" }` |

**Success:** `200` — updated travel object `{ id, destination, startDate, endDate, userId }`.

**Error:** DB failure → `500 { error: "Failed to update travel" }`.

---

### `DELETE /api/calendar/travel/[id]`

Deletes an existing travel entry.

**Authorization:** the travel's `userId` must match the session user's id.

**Success:** `200 { deleted: true }`.

**Error:** DB failure → `500 { error: "Failed to delete travel" }`.

---

## UI Changes

### Clickable Event Pills

Birthday and Travel pills in the calendar grid gain an `onClick` handler. Clicking a pill sets the corresponding editing state variable and opens the modal in edit mode.

Pills get `cursor: pointer` styling to signal interactivity. Google Calendar event pills are **not** made clickable (read-only, no edit capability in scope).

### Modal Edit Mode

The calendar page tracks two new state variables:

```ts
editingBirthday: { id: string; name: string; month: number; day: number } | null
editingTravel: { id: string; destination: string; startDate: string; endDate: string } | null
```

`null` = create mode (existing behavior). Non-null = edit mode.

**Birthday modal in edit mode:**
- Title: "Edit Birthday" (was "Add Birthday")
- Form fields pre-populated from `editingBirthday`
- Save button sends `PATCH /api/calendar/birthdays/[id]`
- Delete button present (see below)

**Travel modal in edit mode:**
- Title: "Edit Travel" (was "Add Travel")
- Form fields pre-populated from `editingTravel`
- Save button sends `PATCH /api/calendar/travel/[id]`
- Delete button present (see below)

**Create mode is unchanged.** The toolbar "Add Birthday" / "Add Travel" buttons set editing state to `null` before opening the modal.

### Delete Confirmation

A Delete button appears bottom-left in the modal footer when in edit mode. Two-click confirmation to prevent accidental deletes:

1. First click: button turns red and label changes to "Confirm delete"
2. Second click: sends DELETE request, closes modal, refreshes events

If the user dismisses the modal after the first click (without confirming), the confirmation state resets.

A separate `deleteConfirming` boolean state (per modal type) tracks whether the first click has occurred.

### Post-Action Behavior

After a successful PATCH or DELETE, the modal closes and `fetchEvents` is called to refresh the calendar. On API error, an inline error message appears in the modal footer; the modal stays open.

---

## File Changes

| File | Change |
|------|--------|
| `src/app/api/calendar/birthdays/[id]/route.ts` | Create — PATCH + DELETE handlers |
| `src/app/api/calendar/travel/[id]/route.ts` | Create — PATCH + DELETE handlers |
| `src/app/calendar/page.tsx` | Add editing state, click handlers on pills, edit mode for modals, delete button |
| `src/app/calendar/calendar.module.css` | Add `.deleteBtn`, `.deleteBtnConfirm` styles; add `cursor: pointer` to event pills |

---

## Authorization Summary

| Entry type | Who can edit/delete |
|------------|-------------------|
| Birthday | Any user whose `familyId` matches the birthday's `familyId` |
| Travel | Only the user whose `userId` matches the travel's `userId` |

---

## Out of Scope

- Editing Google Calendar events (read-only)
- Deleting entries from the toolbar (edit only via pill click)
- Pagination or search for entries
- Undo after delete
