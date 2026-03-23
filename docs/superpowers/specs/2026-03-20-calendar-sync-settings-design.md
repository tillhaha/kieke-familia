# Calendar Sync Settings — Design Spec

**Date:** 2026-03-20
**Status:** Approved
**Scope:** Per-user Google Calendar selection stored in DB; settings page with Google section

---

## Overview

Users can select which of their Google Calendars to sync into the family planner. Selections are stored per-user in the database. By default (nothing selected) no Google Calendar events are shown. The feature lives in a new `/settings` page structured to host future user settings sections.

---

## Data Model

New Prisma model added to `prisma/schema.prisma`:

```prisma
model CalendarSync {
  id         String  @id @default(cuid())
  userId     String
  calendarId String   // Google calendar ID (e.g. "primary" or "xyz@group.calendar.google.com")
  name       String   // Display name as returned in calendarList.items[].summary
  color      String?  // calendarList.items[].backgroundColor hex (e.g. "#4285F4"), or null if absent

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, calendarId])
  @@index([userId])
}
```

`User` model gets `calendarSyncs CalendarSync[]` added.

**Color source:** Google's `calendarList` response includes `backgroundColor` as a hex string. This field is used directly. It is nullable — some calendars (e.g. shared read-only) may not have it.

**Color fallback:** applied only in the UI (`#94A3B8` grey dot). The DB stores whatever Google provides, or `null`.

**Name freshness:** the POST handler trusts the client payload for `name`. The client always sends names sourced from the `GET /api/settings/calendars/available` response fetched in the same settings session. No server-side re-fetch of names occurs in the POST handler. Name staleness between sessions is acceptable.

---

## API Endpoints

All endpoints return `401 { error: "Unauthorized" }` if the user has no active session.

### `GET /api/settings/calendars/available`

Calls Google `calendarList.list` using the user's stored OAuth credentials. Maps `summary` → `name`, `backgroundColor` → `color`, `id` → `id` per calendar item.

**Error responses:**

| Condition | Status | Body |
|-----------|--------|------|
| No Google `Account` row in DB | `400` | `{ error: "No Google account linked" }` |
| Token expired / insufficient scope | `403` | `{ error: "Google authorization expired. Please sign in again." }` |
| Any other Google API or network error | `502` | `{ error: "Could not reach Google Calendar" }` |

**Success:** `200` — `[{ id: string, name: string, color: string | null }]`. Empty array `[]` is valid.

---

### `GET /api/settings/calendars/selected`

Returns the user's saved `CalendarSync` rows.

**Success:** `200` — `[{ calendarId: string, name: string, color: string | null }]`.

**Error:** DB failure → `500 { error: "Failed to load saved calendars" }`.

---

### `POST /api/settings/calendars/selected`

Bulk-replaces the user's calendar selection inside a **single DB transaction**: delete all existing `CalendarSync` rows for the user, then insert the new selection.

**Request body:** `[{ calendarId: string, name: string, color?: string }]`

**Deduplication:** the client sends only one entry per `calendarId` (it builds the payload from a `Set`). The server additionally deduplicates by first occurrence before inserting, so no unique-constraint violation can occur from the payload.

**Validation (checked before transaction):**

| Rule | Response |
|------|----------|
| Body must be a JSON array | `400 { error: "Invalid request body" }` |
| Each item needs non-empty `calendarId` | `400 { error: "Each calendar must have a calendarId" }` |
| Each item needs non-empty `name` | `400 { error: "Each calendar must have a name" }` |
| More than 50 items | `400 { error: "Too many calendars (max 50)" }` |

`color` absent → stored as `null`.

**Success:** `200 { saved: N }` where N = number of rows inserted after deduplication.

**Error:** transaction failure → `500 { error: "Failed to save" }`. Prior selection preserved (transaction rolled back).

---

## Changes to Existing Code

### `src/lib/google/calendar.ts`

`listCalendarEvents` has a single caller (`GET /api/calendar/events`), which is updated in this changeset. Remove `listCalendarEvents` and add:

```ts
export async function listEventsFromCalendars(
  userId: string,
  calendarIds: string[],
  timeMin: Date,
  timeMax: Date
): Promise<calendar_v3.Schema$Event[]>
```

- Returns `[]` immediately if `calendarIds` is empty.
- `timeMin` and `timeMax` are always required — callers always have a date range.
- Fetches all calendar IDs in parallel with `Promise.allSettled`.
- Individual failures are logged with `console.error` and skipped. If all fail, `[]` is returned (failures visible in server logs).
- Deduplication by event `id` is best-effort (edge: recurring event exceptions across calendars may share IDs; the first-seen copy is kept).

### `GET /api/calendar/events`

Queries `CalendarSync` for the user — this is the existing query for the route, extended to also return the count. No extra DB round-trip: `prisma.calendarSync.findMany` returns the rows; `.length` gives the count.

Response gains a new field `calendarSyncCount: number`:

```ts
// calendarSyncCount === 0 → skip Google API
return NextResponse.json({ googleEvents: [], calendarSyncCount: 0, birthdays, travels })

// calendarSyncCount > 0 → fetch events from saved IDs
return NextResponse.json({ googleEvents, calendarSyncCount, birthdays, travels })
```

The calendar page defaults `calendarSyncCount` to `0` if the field is absent from the response (handles cached or older responses).

---

## UI

### Auth — Middleware

A Next.js middleware (`src/middleware.ts`) protects `/settings` by redirecting unauthenticated requests to `/`. This avoids client-side auth flash.

### Navbar

"Settings" link added between the last nav link and the user section. Uses `Settings` icon from `lucide-react`. Rendered only when authenticated.

### Settings Page (`/settings`)

Client component. Two loading phases:

1. **Session loading** (`status === "loading"`): render nothing.
2. **Data loading** (after session confirmed): render layout with spinner in the content area while calendar data fetches.

**Layout:** two-column — left sidebar + right content.

**Sidebar:** hard-coded "Google" button. Active section tracked in component state, defaulting to `"google"`. Sidebar items are `<button>` elements updating component state (no routing).

### Google Section

On mount, fetch `GET /api/settings/calendars/available` and `GET /api/settings/calendars/selected` **in parallel**.

**Loading state:** spinner in place of calendar list while either request is in flight.

**Error states:**

| Scenario | UI |
|----------|----|
| `available` fails | Inline error + Retry button. Save button hidden (can't show checkboxes without the available list). |
| `selected` fails | Inline error. List renders from `available` with all unchecked. Save button visible. |
| Both fail | Both inline errors. Save button hidden. |

**Calendar rows:** one per entry in the `available` response:
- Colored dot: `color` or `#94A3B8` fallback if null
- Calendar name
- Checkbox: checked if `calendarId` ∈ local selection state

**Local selection state:** a `Set<string>` of `calendarId`s, initialised from the `selected` response. The save payload is built by mapping over `available`, keeping only those whose `calendarId` is in the set — this ensures name and color sent to the server always match what Google returned.

**Save button:**
- Disabled while loading or while save is in flight
- Label: "Save" → "Saving…" → "Saved" (2 s) → "Save"
- On error: inline message "Failed to save. Please try again." Button returns to "Save" immediately.

**Empty available list:** show "No Google calendars found in your account." No save button.

### Calendar Page Empty State

When the events response has `calendarSyncCount === 0`, show a prompt below the toolbar:

> "No Google calendars selected. [Go to Settings →](/settings) to choose which calendars to sync."

When `calendarSyncCount > 0` but `googleEvents` is empty, no prompt — the calendar is just empty for the period.

---

## Out of Scope

- Per-family calendar sharing
- Warning on unsaved changes when navigating away
- Notification, Profile, or other settings sections
- Automatic background refresh of calendar names between sessions
- Rate limiting / request timeouts for Google API calls
