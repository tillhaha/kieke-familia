# Week Planner custody row

## Problem

`WeekBlock.tsx` already has a fully-built custody ("Emilia") row — a desktop sub-row under the Notes section, a dedicated row in the mobile Day/3-Day card view, a row in the mobile Week mini-table, and a line in the mobile day-detail popup. The homepage (`src/app/page.tsx`) already fetches `custodyEntries` from `/api/calendar/events` and passes them into `WeekBlock`, so the row renders there.

`src/app/week/page.tsx` (the actual Week Planner, where day/lunch/dinner fields are edited) calls the same `/api/calendar/events` endpoint and already receives `custodyEntries` in the response, but the handler only extracts `googleEvents`/`importedEvents` and discards `custodyEntries`. It's never stored in state or passed to `WeekBlock`. So the row is invisible on the one page where a user is most likely to be looking at the week, editing it, and wanting to know whether Emilia is with them that day.

Separately, in the three "bare icon" grid-cell spots (desktop sub-row, mobile Day/3-Day row, mobile week mini-table), the `Baby` icon currently renders for *any* day with a custody entry, colored blue (`.emiliaIconHome`) for `WITH_US` and pink (`.emiliaIconMona`) for `WITH_MONA`. The ask is to only show the icon when she's with us — an at-a-glance "is she home" signal rather than a two-color legend you have to learn.

## Scope

- Wire `custodyEntries` into `src/app/week/page.tsx`, mirroring the homepage's existing fetch/filter/prop-pass pattern.
- Change the icon-visibility condition in the three bare-icon grid spots in `src/app/week/WeekBlock.tsx` to only render for `WITH_US`.
- Leave the mobile day-detail popup (`WeekBlock.tsx:1204-1212`) unchanged — it already shows an explicit "with us"/"with Mona" text label alongside the icon for both states, so there's no ambiguity to fix there.
- No changes to the `CustodySchedule` data model, the `/api/calendar/custody` or `/api/calendar/events` endpoints, or the `/calendar` page's custody UI (`CustodyPopover.tsx`, `CustodyPill`) — all out of scope.

## Design

### 1. Fetch and pass custody data on `/week`

In `src/app/week/page.tsx`, the existing effect (lines 22-65) fetches weeks, then fetches `/api/calendar/events?timeMin=...&timeMax=...` spanning from the oldest to the newest loaded week, and builds a flat `CalendarEvent[]` from `googleEvents`/`importedEvents`. Add:

- `import { WeekBlock, WeekData, CalendarEvent, CustodyEntry } from "./WeekBlock"` (add `CustodyEntry` to the existing import).
- `const [custodyEntries, setCustodyEntries] = useState<CustodyEntry[]>([])`
- Inside the `.then((d) => { ... })` callback that currently builds `events` from `d.googleEvents`/`d.importedEvents`, add `setCustodyEntries(d.custodyEntries ?? [])` — same line homepage uses (`src/app/page.tsx:92`).

In the render, each `<WeekBlock>` already receives `calendarEvents={calendarEvents.filter((e) => e.date <= week.endDate && e.endDate > week.startDate)}`. Add a sibling prop:

```tsx
custodyEntries={custodyEntries.filter(
  (c) => c.date >= week.startDate && c.date <= week.endDate
)}
```

(Custody entries are single-day — `date >= startDate && date <= endDate` is the correct inclusive-range filter, unlike `calendarEvents` which has separate `date`/`endDate` for multi-day spans.)

### 2. Icon-only-when-WITH_US in grid cells

Three spots in `src/app/week/WeekBlock.tsx` currently do:

```tsx
{entry && (
  <Baby size={N} strokeWidth={2} className={entry.location === "WITH_US" ? styles.emiliaIconHome : styles.emiliaIconMona} />
)}
```

(desktop sub-row ~line 730, mobile Day/3-Day row ~line 945, mobile week mini-table ~line 1140 — variable name is `entry` in two spots and `custodyEntry` in the third; the shape is identical). Change each to:

```tsx
{entry?.location === "WITH_US" && (
  <Baby size={N} strokeWidth={2} className={styles.emiliaIconHome} />
)}
```

`styles.emiliaIconMona` stops being referenced by these three spots but remains used by the day-detail popup (`WeekBlock.tsx:1208`), so the CSS class itself is untouched — no dead code.

### Out of scope / unchanged

- The pre-existing inconsistency where the desktop sub-row renders whenever `custodyEntries` is a truthy array (even `[]`, showing an empty "Emilia" row with no icons) while the mobile rows additionally require `custodyEntries.length > 0` to render at all. Not touched — not part of this request.
- `CustodyPopover.tsx` and the `/calendar` page's own custody pill rendering — separate component, separate page, not mentioned in the request.

## Testing

No automated test suite exists in this repo (per `CLAUDE.md`). Manual verification via the local dev server:

- Seed or create at least one `CustodySchedule` entry for the currently-viewed week with `location: WITH_US` and one with `location: WITH_MONA` (via `/calendar`'s custody UI, or directly in the DB).
- On `/week`: confirm the "Emilia" row now appears (desktop table) and shows the icon only on the `WITH_US` day, nothing on the `WITH_MONA` day.
- Resize to mobile width: confirm the Day/3-Day card view's "Emilia" row and the Week mini-table's custody row both show icon-only-on-WITH_US the same way.
- Tap a `WITH_MONA` day in the mobile Week view to open the day-detail popup: confirm it still shows the icon + "with Mona" text (unchanged).
- Confirm `/` (homepage) still renders the row correctly too, since `WeekBlock` is shared — this change affects both pages' grid cells identically.
