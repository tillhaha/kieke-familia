# Week Planner Custody Row Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the already-built custody ("Emilia") row visible on the Week Planner page (`/week`), and change the bare-icon grid cells across `WeekBlock` to only show the custody icon on "with us" days instead of showing it in two colors for both states.

**Architecture:** `WeekBlock.tsx` already renders the custody row in four places (desktop sub-row, mobile Day/3-Day row, mobile week mini-table, mobile day-detail popup) whenever it receives a `custodyEntries` prop. The homepage already fetches and passes this prop; `/week/page.tsx` fetches the same API response but discards the `custodyEntries` field. Task 1 wires that field through on `/week`, mirroring the homepage's existing pattern exactly. Task 2 changes the icon-visibility condition in the three bare-icon spots (not the detail popup, which keeps its explicit text label for both states).

**Tech Stack:** Next.js 16, React, existing `/api/calendar/events` endpoint (no API changes).

## Global Constraints

- No test suite exists in this repo — verification is manual via the dev server (per `CLAUDE.md`).
- No changes to the `CustodySchedule` data model, `/api/calendar/custody` or `/api/calendar/events` endpoints, or the `/calendar` page's custody UI (`CustodyPopover.tsx`, `CustodyPill`) — all out of scope.
- The mobile day-detail popup (`WeekBlock.tsx:1204-1212`) keeps showing both "with us" and "with Mona" states with its text label — do not change it.
- `WeekBlock` is shared between `/` and `/week` — the Task 2 icon-visibility change affects both pages identically; this is intended, not a regression.

Spec: `docs/superpowers/specs/2026-10-13-week-planner-custody-row-design.md`

---

### Task 1: Wire custody data into the Week Planner page

**Files:**
- Modify: `src/app/week/page.tsx`

**Interfaces:**
- Consumes: `CustodyEntry` type from `src/app/week/WeekBlock.tsx` (already exported — confirmed via `src/app/page.tsx:7`'s import of the same type). Shape: `{ id: string; date: string; location: "WITH_US" | "WITH_MONA"; personName: string }`.
- Consumes: the `/api/calendar/events` JSON response's `custodyEntries` field (already present server-side; the homepage already reads it at `src/app/page.tsx:92` via `setCustodyEntries(d.custodyEntries ?? [])`).
- Produces: a `custodyEntries` prop passed to `<WeekBlock>`, matching the prop name `WeekBlock` already accepts (confirmed via `src/app/week/WeekBlock.tsx` `Props` type: `custodyEntries?: CustodyEntry[]`).

- [ ] **Step 1: Add the `CustodyEntry` import and state**

In `src/app/week/page.tsx`, line 8, change:

```tsx
import { WeekBlock, WeekData, CalendarEvent } from "./WeekBlock"
```

to:

```tsx
import { WeekBlock, WeekData, CalendarEvent, CustodyEntry } from "./WeekBlock"
```

Then, after line 17 (`const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])`), add:

```tsx
  const [custodyEntries, setCustodyEntries] = useState<CustodyEntry[]>([])
```

- [ ] **Step 2: Capture `custodyEntries` from the API response**

In `src/app/week/page.tsx`, find the `.then((d) => { ... })` callback that builds `events` from `d.googleEvents`/`d.importedEvents` (starts at line 37, ends with `setCalendarEvents(events)` at line 59). Immediately after the opening of that callback, before the `const events: CalendarEvent[] = []` line, add:

```tsx
            setCustodyEntries(d.custodyEntries ?? [])
```

So the start of that callback reads:

```tsx
          .then((d) => {
            setCustodyEntries(d.custodyEntries ?? [])
            const events: CalendarEvent[] = []
```

- [ ] **Step 3: Pass the filtered `custodyEntries` prop to each `WeekBlock`**

In `src/app/week/page.tsx`, find the `<WeekBlock>` render (starts at line 151):

```tsx
            <WeekBlock
              key={week.startDate}
              id={`week-${week.startDate}`}
              week={week}
              onDayUpdate={(date, field, value) =>
                handleDayUpdate(week.startDate, date, field, value)
              }
              onGenerateShopping={handleGenerateShopping}
              calendarEvents={calendarEvents.filter(
                (e) => e.date <= week.endDate && e.endDate > week.startDate
              )}
            />
```

Add a `custodyEntries` prop after the `calendarEvents` prop:

```tsx
            <WeekBlock
              key={week.startDate}
              id={`week-${week.startDate}`}
              week={week}
              onDayUpdate={(date, field, value) =>
                handleDayUpdate(week.startDate, date, field, value)
              }
              onGenerateShopping={handleGenerateShopping}
              calendarEvents={calendarEvents.filter(
                (e) => e.date <= week.endDate && e.endDate > week.startDate
              )}
              custodyEntries={custodyEntries.filter(
                (c) => c.date >= week.startDate && c.date <= week.endDate
              )}
            />
```

- [ ] **Step 4: Manually verify in the dev server**

There's no automated test suite in this repo. Verify via the dev server instead:

- A local dev environment with a seeded test user already exists (username `testuser`, password `testpass123`) — start it with `npm run dev` and log in.
- Check whether any `CustodySchedule` rows already exist for the currently-displayed week: `npx prisma studio` and look at the `CustodySchedule` table, or query via `psql`. If none exist for the visible week, create one via the `/calendar` page's custody UI (click a day in the calendar month view, use the custody popover to set a `WITH_US` or `WITH_MONA` entry) for a date that falls inside a week currently shown on `/week`.
- Navigate to `/week`. Before this change, the "Emilia" row was absent entirely (not just empty) because `custodyEntries` was never passed. After this change, confirm the row now appears in the desktop table between the "Location"/"Events" rows and "Lunch", with an icon (any color, since Task 2 hasn't run yet) on the day that has a custody entry.
- Confirm `/` (homepage) still shows its own "Emilia" row correctly (unaffected by this change — it already had its own independent fetch).

- [ ] **Step 5: Commit**

```bash
git add src/app/week/page.tsx
git commit -m "feat: fetch and pass custody entries on the Week Planner page"
```

---

### Task 2: Show the custody icon only on "with us" days

**Files:**
- Modify: `src/app/week/WeekBlock.tsx`

**Interfaces:**
- Consumes: the `custodyEntries` prop (now populated on `/week` thanks to Task 1; already populated on `/`).
- No new exports or props — this task only changes JSX conditions in three existing render blocks.

- [ ] **Step 1: Desktop sub-row — change the icon condition**

In `src/app/week/WeekBlock.tsx`, find (around line 723-740):

```tsx
                {section === "Notes" && custodyEntries && (
                  <tr>
                    <td className={`${styles.rowLabel} ${styles.subRowLabel}`}>Emilia</td>
                    {week.days.map((day) => {
                      const entry = custodyEntries.find((c) => c.date === day.date)
                      return (
                        <td key={day.date} className={`${styles.cell} ${styles.emiliaCell}`}>
                          {entry && (
                            <Baby
                              size={13}
                              strokeWidth={2}
                              className={entry.location === "WITH_US" ? styles.emiliaIconHome : styles.emiliaIconMona}
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
```

Replace the `{entry && ( ... )}` block with:

```tsx
                          {entry?.location === "WITH_US" && (
                            <Baby
                              size={13}
                              strokeWidth={2}
                              className={styles.emiliaIconHome}
                            />
                          )}
```

(Only the conditional and the `className` change — everything else in this block, including the surrounding `<tr>`/`<td>`/`.map`, stays as-is.)

- [ ] **Step 2: Mobile Day/3-Day row — change the icon condition**

In `src/app/week/WeekBlock.tsx`, find (around line 937-956):

```tsx
                {field === "note" && custodyEntries && custodyEntries.length > 0 && (
                  <div className={styles.mobileRowGroup}>
                    {getMobileDays().map((day) => {
                      const custodyEntry = custodyEntries.find(c => c.date === day.date)
                      return (
                        <div key={day.date} className={styles.mobileDayField}>
                          <span className={styles.mobileDayFieldLabel}>Emilia</span>
                          <div className={styles.mobileDayFieldIconWrap}>
                            {custodyEntry && (
                              <Baby
                                size={14}
                                strokeWidth={2}
                                className={custodyEntry.location === "WITH_US" ? styles.emiliaIconHome : styles.emiliaIconMona}
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
```

Replace the `{custodyEntry && ( ... )}` block with:

```tsx
                            {custodyEntry?.location === "WITH_US" && (
                              <Baby
                                size={14}
                                strokeWidth={2}
                                className={styles.emiliaIconHome}
                              />
                            )}
```

- [ ] **Step 3: Mobile week mini-table — change the icon condition**

In `src/app/week/WeekBlock.tsx`, find (around line 1128-1149):

```tsx
                {field === "note" && custodyEntries && custodyEntries.length > 0 && (
                  <>
                    <div className={styles.mobileWeekTableLabel}><Baby size={11} strokeWidth={2} /></div>
                    {week.days.map((day) => {
                      const isToday = day.date === todayDateStr
                      const entry = custodyEntries.find(c => c.date === day.date)
                      return (
                        <div
                          key={day.date}
                          className={`${styles.mobileWeekTableCell} ${styles.mobileWeekTableCustodyCell} ${isToday ? styles.mobileWeekTableCellToday : ""}`}
                          onClick={() => setMobileDayDetail(day.date)}
                        >
                          {entry && (
                            <Baby
                              size={10}
                              strokeWidth={2}
                              className={entry.location === "WITH_US" ? styles.emiliaIconHome : styles.emiliaIconMona}
                            />
                          )}
                        </div>
                      )
                    })}
```

Replace the `{entry && ( ... )}` block with:

```tsx
                          {entry?.location === "WITH_US" && (
                            <Baby
                              size={10}
                              strokeWidth={2}
                              className={styles.emiliaIconHome}
                            />
                          )}
```

- [ ] **Step 4: Confirm the detail popup is untouched**

In `src/app/week/WeekBlock.tsx` around line 1204-1212, the mobile day-detail popup block:

```tsx
                {custodyEntry && (
                  <div className={styles.mobileModalField}>
                    <span className={styles.mobileModalFieldLabel}>Emilia</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <Baby size={14} strokeWidth={2} className={custodyEntry.location === "WITH_US" ? styles.emiliaIconHome : styles.emiliaIconMona} />
                      <span className={styles.mobileModalFieldValue}>{custodyEntry.location === "WITH_US" ? t.weekBlock.withUs : t.weekBlock.withMona}</span>
                    </div>
                  </div>
                )}
```

must remain exactly as-is — do not edit this block. It's listed here only so the diff can be checked against it (confirm no accidental edit touched these lines).

- [ ] **Step 5: Run the typecheck**

```bash
npx tsc --noEmit
```

Expected: no output (no errors). Baseline is clean, so any error here is from this task's changes.

- [ ] **Step 6: Manually verify in the dev server**

There's no automated test suite in this repo. Verify via the dev server instead (reuse the local dev setup and the `CustodySchedule` rows from Task 1's Step 4 — make sure at least one `WITH_US` day and one `WITH_MONA` day both fall inside a week visible on `/week`):

- Desktop width, `/week`: confirm the "Emilia" row shows the icon on the `WITH_US` day and shows nothing on the `WITH_MONA` day's cell (previously it would have shown a pink-colored icon there).
- Resize to mobile width (≤768px), Day or 3-Day view: confirm the "Emilia" row in the mobile card view shows icon-only-on-`WITH_US`, matching desktop.
- Mobile Week view (the mini-table): confirm the custody row cell shows icon-only-on-`WITH_US`.
- Tap the `WITH_MONA` day in the mobile Week view to open the day-detail popup: confirm it still shows the `Baby` icon (pink, via `emiliaIconMona`) plus the text "with Mona" — this must be unchanged from before.
- Desktop width, `/` (homepage): confirm the same icon-only-on-`WITH_US` behavior, since `WeekBlock` is shared.

- [ ] **Step 7: Commit**

```bash
git add src/app/week/WeekBlock.tsx
git commit -m "feat: only show custody icon on with-us days in grid cells"
```
