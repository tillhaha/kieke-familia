# Edit & Delete Calendar Entries — Design Spec

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Edit and delete for Birthday and Travel entries created through Familia; triggered by clicking event pills in the calendar view.

---

## Overview

Users can click a Birthday or Travel pill in the calendar grid to open the existing modal pre-populated with that entry's data. From there they can update the fields or delete the entry. The "Add Birthday" / "Add Travel" toolbar buttons continue to open the modal in create mode.

---

## API Endpoints

All endpoints return `401 { error: "Unauthorized" }` if the user has no active session, and `404 { error: "Not found" }` if the record doesn't exist or the user is not authorized to modify it (no information leakage about which condition applies).

All fields in PATCH request bodies are **required** — the UI always sends the full form state (pre-populated), so partial updates are not needed. PATCH is used (rather than PUT) because the `id` is in the URL, which is idiomatic for Next.js dynamic routes.

### `PATCH /api/calendar/birthdays/[id]`

Updates an existing birthday.

**Authorization:** look up the birthday by `id`. If not found, return `404`. Check that `birthday.familyId === session.user.familyId`. If `session.user.familyId` is null or the IDs don't match, return `404`.

**Request body:** `{ name: string, month: number, day: number }`

**Validation (checked before DB write):**

| Rule | Response |
|------|----------|
| `name` is a non-empty string | `400 { error: "Name is required" }` |
| `month` is an integer 1–12 | `400 { error: "Month must be between 1 and 12" }` |
| `day` is an integer 1–31 | `400 { error: "Day must be between 1 and 31" }` |

Note: impossible date combinations (e.g. February 31) are not validated server-side — this matches the existing create endpoint behavior.

**Success:** `200` — updated birthday object `{ id, name, month, day, familyId }`.

**Error:** DB failure → `500 { error: "Failed to update birthday" }`.

---

### `DELETE /api/calendar/birthdays/[id]`

Deletes an existing birthday.

**Authorization:** same as PATCH — look up by `id`, check `birthday.familyId === session.user.familyId`. If either check fails, return `404`.

**Success:** `200 { deleted: true }`.

**Error:** DB failure → `500 { error: "Failed to delete birthday" }`.

---

### `PATCH /api/calendar/travel/[id]`

Updates an existing travel entry.

**Authorization:** look up the travel by `id`. If not found, return `404`. Check that `travel.userId === session.user.id`. If not, return `404`.

**Request body:** `{ destination: string, startDate: string (ISO 8601), endDate: string (ISO 8601) }`

**Validation (checked before DB write):**

| Rule | Response |
|------|----------|
| `destination` is a non-empty string | `400 { error: "Destination is required" }` |
| `startDate` parses to a valid date | `400 { error: "Invalid start date" }` |
| `endDate` parses to a valid date | `400 { error: "Invalid end date" }` |
| `endDate` is not before `startDate` | `400 { error: "End date must be on or after start date" }` |

**Success:** `200` — updated travel object `{ id, destination, startDate, endDate, userId }`.

**Error:** DB failure → `500 { error: "Failed to update travel" }`.

---

### `DELETE /api/calendar/travel/[id]`

Deletes an existing travel entry.

**Authorization:** same as PATCH — look up by `id`, check `travel.userId === session.user.id`. If either check fails, return `404`.

**Success:** `200 { deleted: true }`.

**Error:** DB failure → `500 { error: "Failed to delete travel" }`.

---

## UI Changes

### Event IDs Available Client-Side

The `/api/calendar/events` endpoint uses `prisma.birthday.findMany` and `prisma.travel.findMany` with no `select` clause, so all fields including `id` are already returned. No change to the events endpoint is needed.

### Clickable Event Pills

Birthday pills gain an `onClick` handler that opens the birthday modal in edit mode. **Travel pills are only clickable if the travel belongs to the current user** (`travel.userId === session.user.id`). Travel entries belonging to other family members render without an `onClick` — they are visible but not editable.

Clickable pills get `cursor: pointer` styling. Non-clickable travel pills keep default cursor.

Google Calendar event pills are not made clickable (read-only, out of scope).

### Modal Edit Mode

The calendar page gains two new state variables:

```ts
editingBirthday: { id: string; name: string; month: number; day: number } | null
editingTravel: { id: string; destination: string; startDate: string; endDate: string } | null
```

`null` = create mode. Non-null = edit mode.

**Opening edit mode (pill click):** set `editingBirthday` or `editingTravel` to the clicked entry's data, reset `deleteConfirming` to `false`, reset `modalError` to `null`, and open the modal.

**Opening create mode (toolbar button):** set `editingBirthday` / `editingTravel` to `null`, reset all form fields to their empty defaults, reset `deleteConfirming` to `false`, reset `modalError` to `null`, and open the modal.

**Birthday modal in edit mode:**
- Title: "Edit Birthday"
- Form fields pre-populated from `editingBirthday`
- Save sends `PATCH /api/calendar/birthdays/[editingBirthday.id]`
- Delete button visible (see below)

**Travel modal in edit mode:**
- Title: "Edit Travel"
- Form fields pre-populated from `editingTravel`
- Save sends `PATCH /api/calendar/travel/[editingTravel.id]`
- Delete button visible (see below)

### Delete Confirmation

A Delete button appears bottom-left in the modal footer **only in edit mode**. Two-click confirmation to prevent accidental deletes:

1. **First click:** button turns red (`.deleteBtnConfirm` CSS class) and label changes to "Confirm delete"
2. **Second click:** sends DELETE request; on success closes modal and calls `fetchEvents`

`deleteConfirming` is a single boolean (only one modal open at a time). It is reset to `false`:
- whenever any modal opens (create or edit mode)
- whenever the modal is dismissed without confirming

### Inline Modal Errors

A single `modalError: string | null` state variable holds errors from PATCH or DELETE requests. It is displayed in the modal footer above the action buttons.

`modalError` is reset to `null`:
- whenever any modal opens
- on each new save or delete attempt (before the request fires)

On API failure, `modalError` is set to the error message from the response body. The modal stays open.

### Post-Action Behavior

After a successful PATCH or DELETE, the modal closes and `fetchEvents` is called to refresh the calendar.

---

## File Changes

| File | Action | Notes |
|------|--------|-------|
| `src/app/api/calendar/birthdays/[id]/route.ts` | Create | PATCH + DELETE handlers |
| `src/app/api/calendar/travel/[id]/route.ts` | Create | PATCH + DELETE handlers |
| `src/app/calendar/page.tsx` | Modify | Edit state, pill click handlers, edit mode for modals, delete button, modal error display |
| `src/app/calendar/calendar.module.css` | Modify | `.deleteBtn`, `.deleteBtnConfirm` styles; `cursor: pointer` on clickable pills |

---

## Authorization Summary

| Entry type | Who can edit/delete |
|------------|-------------------|
| Birthday | Any user whose `familyId` matches the birthday's `familyId` |
| Travel | Only the user whose `userId` matches the travel's `userId` |

This asymmetry reflects the data model: birthdays are family-owned, travels are user-owned. A family member can see but not edit another member's travels; those pills are non-clickable in the UI.

---

## Out of Scope

- Editing Google Calendar events (read-only)
- Impossible date validation (e.g. February 31) — matches existing create endpoint behavior
- Undo after delete
- Indicating in the UI which travel entries belong to which family member
