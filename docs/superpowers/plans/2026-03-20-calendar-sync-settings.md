# Calendar Sync Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each user select which of their Google Calendars to sync; store selections in the DB; expose a `/settings` page with a Google section for managing this.

**Architecture:** New `CalendarSync` Prisma model stores per-user calendar selections. Three new API routes handle fetching available calendars from Google and reading/writing selections. The existing `/api/calendar/events` route is updated to fetch only from selected calendars. A new `/settings` page with sidebar layout hosts the Google calendar picker component.

**Tech Stack:** Next.js 16 App Router, NextAuth v4, Prisma 7, PostgreSQL, googleapis, lucide-react, CSS modules.

**Spec:** `docs/superpowers/specs/2026-03-20-calendar-sync-settings-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add `CalendarSync` model and `User.calendarSyncs` relation |
| `src/middleware.ts` | Create | Redirect unauthenticated users away from `/settings` |
| `src/lib/google/calendar.ts` | Modify | Remove `listCalendarEvents`, add `listEventsFromCalendars` |
| `src/app/api/calendar/events/route.ts` | Modify | Use `CalendarSync`; add `calendarSyncCount` to response *(updated in same task as calendar.ts to avoid broken build)* |
| `src/app/api/settings/calendars/available/route.ts` | Create | GET — list user's Google calendars from Google API |
| `src/app/api/settings/calendars/selected/route.ts` | Create | GET — read DB selections; POST — bulk-replace selections |
| `src/app/settings/settings.module.css` | Create | Styles for settings page and Google section |
| `src/app/settings/GoogleSection.tsx` | Create | Google calendar picker component |
| `src/app/settings/page.tsx` | Create | Settings page layout — sidebar + content area |
| `src/components/Navbar.tsx` | Modify | Add Settings nav link |
| `src/app/calendar/page.tsx` | Modify | Show empty-state prompt when `calendarSyncCount === 0` |

---

## Task 1: Add CalendarSync to Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Read the Next.js docs for this version**

```bash
ls node_modules/next/dist/docs/
```

- [ ] **Step 2: Add `CalendarSync` model and `User` relation**

Open `prisma/schema.prisma`. Add after the `Travel` model:

```prisma
model CalendarSync {
  id         String  @id @default(cuid())
  userId     String
  calendarId String
  name       String
  color      String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, calendarId])
  @@index([userId])
}
```

Add to the `User` model (after `travels Travel[]`):

```prisma
  calendarSyncs CalendarSync[]
```

- [ ] **Step 3: Push schema and regenerate client**

```bash
npx prisma db push
npx prisma generate
```

`db push` syncs the database. `generate` is required — without it, `prisma.calendarSync` won't exist on the client and all subsequent TypeScript will fail to compile.

Expected output from `db push`: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Verify the table exists**

```bash
psql "postgresql://till@localhost:5432/familia" -c '\dt "CalendarSync";'
```

Expected: one row listing the `CalendarSync` table.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add CalendarSync prisma model"
```

---

## Task 2: Next.js Middleware for /settings Auth

**Files:**
- Modify: `src/lib/auth.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: Verify `pages.signIn` is set in authOptions**

Read `src/lib/auth.ts`. The `authOptions` object must include a `pages` key so that unauthenticated middleware redirects go to `/` rather than NextAuth's default `/api/auth/signin`. If it's missing, add it:

```ts
export const authOptions: NextAuthOptions = {
  // ... existing config ...
  pages: {
    signIn: "/",
  },
}
```

- [ ] **Step 2: Create `src/middleware.ts`**

```ts
// src/middleware.ts
export { default } from "next-auth/middleware"

export const config = {
  matcher: ["/settings/:path*"],
}
```

This uses NextAuth v4's built-in middleware export (`next-auth/middleware`), which wraps `withAuth` and checks for a valid session token. Unauthenticated requests are redirected to `pages.signIn` (set to `"/"` above).

- [ ] **Step 3: Start dev server and verify redirect**

```bash
npm run dev
```

Open an incognito window and navigate to `http://localhost:3000/settings`. You should be redirected to `/`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts src/middleware.ts
git commit -m "feat: protect /settings with NextAuth middleware"
```

---

## Task 3: Refactor calendar.ts + Update /api/calendar/events

These two files are updated together in one task to avoid a broken build between steps (removing `listCalendarEvents` from `calendar.ts` would break the events route import until it's also updated).

**Files:**
- Modify: `src/lib/google/calendar.ts`
- Modify: `src/app/api/calendar/events/route.ts`

- [ ] **Step 1: Read both files in full**

Read `src/lib/google/calendar.ts` and `src/app/api/calendar/events/route.ts` before making any changes.

- [ ] **Step 2: Replace `listCalendarEvents` with `listEventsFromCalendars` in calendar.ts**

Remove the `listCalendarEvents` function. Remove the existing `listCalendarEvents` export from `src/app/api/calendar/events/route.ts` import (you will add the new import in Step 3).

Also remove the `calendarList.list` call that was previously added for fetching all calendars — that logic now lives in the settings API.

The final `src/lib/google/calendar.ts` should export only `getGoogleCalendarClient` and `listEventsFromCalendars`:

```ts
// src/lib/google/calendar.ts
import { google, calendar_v3 } from 'googleapis'
import { prisma } from '@/lib/prisma'

export async function getGoogleCalendarClient(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'google' },
  })

  if (!account) {
    throw new Error('User has no Google account linked')
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  )

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  })

  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.refresh_token) {
      await prisma.account.update({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: account.providerAccountId,
          },
        },
        data: { refresh_token: tokens.refresh_token },
      })
    }
    if (tokens.access_token) {
      await prisma.account.update({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: account.providerAccountId,
          },
        },
        data: {
          access_token: tokens.access_token,
          expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
        },
      })
    }
  })

  return google.calendar({ version: 'v3', auth: oauth2Client })
}

export async function listEventsFromCalendars(
  userId: string,
  calendarIds: string[],
  timeMin: Date,
  timeMax: Date
): Promise<calendar_v3.Schema$Event[]> {
  if (calendarIds.length === 0) return []

  const calendar = await getGoogleCalendarClient(userId)

  const results = await Promise.allSettled(
    calendarIds.map((calendarId) =>
      calendar.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      })
    )
  )

  const allEvents = results.flatMap((result, i) => {
    if (result.status === 'rejected') {
      console.error(`Failed to fetch calendar ${calendarIds[i]}:`, result.reason)
      return []
    }
    return result.value.data.items ?? []
  })

  // Deduplicate by event id (best-effort)
  const seen = new Set<string>()
  return allEvents.filter((event) => {
    if (!event.id || seen.has(event.id)) return false
    seen.add(event.id)
    return true
  })
}
```

- [ ] **Step 3: Update `src/app/api/calendar/events/route.ts`**

Replace the entire file:

```ts
// src/app/api/calendar/events/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { listEventsFromCalendars } from "@/lib/google/calendar"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const timeMin = searchParams.get("timeMin")
    ? new Date(searchParams.get("timeMin")!)
    : new Date()
  const timeMax = searchParams.get("timeMax")
    ? new Date(searchParams.get("timeMax")!)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  try {
    const userId = (session.user as any).id
    const familyId = (session.user as any).familyId

    // Fetch selected calendar IDs for this user
    const calendarSyncs = await prisma.calendarSync.findMany({
      where: { userId },
      select: { calendarId: true },
    })
    const calendarIds = calendarSyncs.map((s) => s.calendarId)
    const calendarSyncCount = calendarIds.length

    // Only call Google if the user has selected calendars
    const googleEvents =
      calendarSyncCount > 0
        ? await listEventsFromCalendars(userId, calendarIds, timeMin, timeMax)
        : []

    const birthdays = familyId
      ? await prisma.birthday.findMany({ where: { familyId } })
      : []

    const travels = familyId
      ? await prisma.travel.findMany({ where: { user: { familyId } } })
      : await prisma.travel.findMany({ where: { userId } })

    return NextResponse.json({ googleEvents, calendarSyncCount, birthdays, travels })
  } catch (error: any) {
    console.error("Calendar fetch error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual test**

```bash
curl -H "Cookie: next-auth.session-token=<token>" \
  "http://localhost:3000/api/calendar/events?timeMin=2026-03-01T00:00:00Z&timeMax=2026-04-01T00:00:00Z"
```

Expected: `{"googleEvents":[],"calendarSyncCount":0,"birthdays":[...],"travels":[...]}`

- [ ] **Step 6: Commit**

```bash
git add src/lib/google/calendar.ts src/app/api/calendar/events/route.ts
git commit -m "feat: add listEventsFromCalendars, update events route to use CalendarSync"
```

---

## Task 4: GET /api/settings/calendars/available

**Files:**
- Create: `src/app/api/settings/calendars/available/route.ts`

- [ ] **Step 1: Create the route**

```ts
// src/app/api/settings/calendars/available/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getGoogleCalendarClient } from "@/lib/google/calendar"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = (session.user as any).id

  try {
    const calendar = await getGoogleCalendarClient(userId)
    const res = await calendar.calendarList.list()

    // backgroundColor is undefined on some calendars (e.g. shared read-only) — coerce to null
    const calendars = (res.data.items ?? []).map((item) => ({
      id: item.id!,
      name: item.summary ?? "Unnamed calendar",
      color: item.backgroundColor ?? null,
    }))

    return NextResponse.json(calendars)
  } catch (error: any) {
    if (error.message?.includes("No Google account")) {
      return NextResponse.json({ error: "No Google account linked" }, { status: 400 })
    }
    if (
      error.code === 401 ||
      error.status === 401 ||
      error.message?.includes("invalid_grant") ||
      error.message?.includes("No refresh token") ||
      error.message?.includes("insufficient")
    ) {
      return NextResponse.json(
        { error: "Google authorization expired. Please sign in again." },
        { status: 403 }
      )
    }
    console.error("Calendar list error:", error)
    return NextResponse.json({ error: "Could not reach Google Calendar" }, { status: 502 })
  }
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manual test**

```bash
curl -H "Cookie: next-auth.session-token=<token>" \
  http://localhost:3000/api/settings/calendars/available
```

Expected: JSON array of `{ id, name, color }` objects.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/settings/calendars/available/route.ts
git commit -m "feat: add GET /api/settings/calendars/available"
```

---

## Task 5: GET + POST /api/settings/calendars/selected

**Files:**
- Create: `src/app/api/settings/calendars/selected/route.ts`

- [ ] **Step 1: Create the route**

```ts
// src/app/api/settings/calendars/selected/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = (session.user as any).id

  try {
    const syncs = await prisma.calendarSync.findMany({
      where: { userId },
      select: { calendarId: true, name: true, color: true },
    })
    return NextResponse.json(syncs)
  } catch (error: any) {
    console.error("Selected calendars fetch error:", error)
    return NextResponse.json({ error: "Failed to load saved calendars" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = (session.user as any).id

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (body.length > 50) {
    return NextResponse.json({ error: "Too many calendars (max 50)" }, { status: 400 })
  }

  for (const item of body) {
    if (!item.calendarId || typeof item.calendarId !== "string") {
      return NextResponse.json({ error: "Each calendar must have a calendarId" }, { status: 400 })
    }
    if (!item.name || typeof item.name !== "string") {
      return NextResponse.json({ error: "Each calendar must have a name" }, { status: 400 })
    }
  }

  // Deduplicate by calendarId (the @@unique key), keeping first occurrence
  const seen = new Set<string>()
  const deduped = (body as Array<{ calendarId: string; name: string; color?: string }>).filter(
    (item) => {
      if (seen.has(item.calendarId)) return false
      seen.add(item.calendarId)
      return true
    }
  )

  try {
    // Batch transaction: delete all then insert new selection atomically.
    // Use individual prisma.calendarSync.create() calls (not createMany) for
    // compatibility with Prisma's batch transaction array API.
    await prisma.$transaction([
      prisma.calendarSync.deleteMany({ where: { userId } }),
      ...deduped.map((item) =>
        prisma.calendarSync.create({
          data: {
            userId,
            calendarId: item.calendarId,
            name: item.name,
            color: item.color ?? null,
          },
        })
      ),
    ])
    return NextResponse.json({ saved: deduped.length })
  } catch (error: any) {
    console.error("Calendar sync save error:", error)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manual test — GET returns empty array**

```bash
curl -H "Cookie: next-auth.session-token=<token>" \
  http://localhost:3000/api/settings/calendars/selected
```

Expected: `[]`

- [ ] **Step 4: Manual test — POST saves, then replaces**

```bash
# Save one calendar
curl -X POST \
  -H "Cookie: next-auth.session-token=<token>" \
  -H "Content-Type: application/json" \
  -d '[{"calendarId":"primary","name":"My Calendar","color":"#4285F4"}]' \
  http://localhost:3000/api/settings/calendars/selected
# Expected: {"saved":1}

# GET should now return it
curl -H "Cookie: next-auth.session-token=<token>" \
  http://localhost:3000/api/settings/calendars/selected
# Expected: [{"calendarId":"primary","name":"My Calendar","color":"#4285F4"}]

# POST with empty array — should clear selection
curl -X POST \
  -H "Cookie: next-auth.session-token=<token>" \
  -H "Content-Type: application/json" \
  -d '[]' \
  http://localhost:3000/api/settings/calendars/selected
# Expected: {"saved":0}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/settings/calendars/selected/route.ts
git commit -m "feat: add GET+POST /api/settings/calendars/selected"
```

---

## Task 6: Settings Page CSS

**Files:**
- Create: `src/app/settings/settings.module.css`

- [ ] **Step 1: Create the CSS module**

```css
/* src/app/settings/settings.module.css */

/* ── Page Layout ─────────────────────────────────────────── */

.container {
  display: flex;
  max-width: 1000px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem;
  gap: 2rem;
  min-height: calc(100vh - 57px);
}

.sidebar {
  width: 180px;
  flex-shrink: 0;
}

.sidebarTitle {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--secondary);
  margin-bottom: 0.5rem;
  padding: 0 0.75rem;
}

.sectionBtn {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--secondary);
  font-size: 0.875rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background-color 150ms, color 150ms;
}

.sectionBtn:hover {
  background: var(--surface-hover);
  color: var(--foreground);
}

.sectionBtn.active {
  background: var(--accent-soft);
  color: var(--primary);
}

/* ── Content Area ────────────────────────────────────────── */

.content {
  flex: 1;
  min-width: 0;
}

.section {
  max-width: 560px;
}

.sectionTitle {
  font-size: 1.125rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 0.25rem;
}

.sectionDesc {
  font-size: 0.875rem;
  color: var(--secondary);
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

/* ── Calendar List ───────────────────────────────────────── */

.calendarList {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  margin-bottom: 1.25rem;
}

.calendarRow {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  cursor: pointer;
  transition: background-color 150ms;
  border-bottom: 1px solid var(--border);
}

.calendarRow:last-child {
  border-bottom: none;
}

.calendarRow:hover {
  background: var(--surface);
}

.colorDot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.calendarName {
  flex: 1;
  font-size: 0.9375rem;
}

.checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--primary);
}

/* ── Save Button ─────────────────────────────────────────── */

.saveBtn {
  padding: 0.5rem 1.25rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 150ms, opacity 150ms;
}

.saveBtn:hover:not(:disabled) {
  background: var(--primary-hover);
}

.saveBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.saveError {
  font-size: 0.875rem;
  color: #dc2626;
  margin-bottom: 0.75rem;
}

/* ── States ──────────────────────────────────────────────── */

.spinner {
  color: var(--secondary);
  font-size: 0.875rem;
  padding: 1rem 0;
}

.emptyMsg {
  font-size: 0.875rem;
  color: var(--secondary);
  padding: 1.5rem 0;
}

.errorBox {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--radius);
  color: #991b1b;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

@media (prefers-color-scheme: dark) {
  .errorBox {
    background: #2d0a0a;
    border-color: #7f1d1d;
    color: #fca5a5;
  }
  .saveError {
    color: #f87171;
  }
}

.retryBtn {
  flex-shrink: 0;
  padding: 0.3rem 0.75rem;
  border-radius: 5px;
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 150ms;
}

.retryBtn:hover {
  opacity: 1;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/settings/settings.module.css
git commit -m "feat: add settings page CSS module"
```

---

## Task 7: Settings Page and GoogleSection Component

**Files:**
- Create: `src/app/settings/GoogleSection.tsx`
- Create: `src/app/settings/page.tsx`

Note: `page.tsx` does **not** export `metadata` — it is a pure client component (`"use client"`). The layout-level metadata in `src/app/layout.tsx` covers the title/description for all pages.

- [ ] **Step 1: Create `GoogleSection.tsx`**

```tsx
// src/app/settings/GoogleSection.tsx
"use client"

import { useState, useEffect } from "react"
import styles from "./settings.module.css"

type GoogleCalendar = { id: string; name: string; color: string | null }
type SelectedCalendar = { calendarId: string; name: string; color: string | null }

export function GoogleSection() {
  const [available, setAvailable] = useState<GoogleCalendar[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [availableError, setAvailableError] = useState<string | null>(null)
  const [selectedError, setSelectedError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [saveError, setSaveError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setAvailableError(null)
    setSelectedError(null)

    // loading=true before fetches — prevents the empty-state prompt flash
    const [availResult, selectedResult] = await Promise.allSettled([
      fetch("/api/settings/calendars/available").then((r) => r.json()),
      fetch("/api/settings/calendars/selected").then((r) => r.json()),
    ])

    if (availResult.status === "fulfilled" && !availResult.value.error) {
      setAvailable(availResult.value)
    } else {
      setAvailableError(
        availResult.status === "fulfilled"
          ? availResult.value.error
          : "Could not load your Google calendars."
      )
    }

    if (selectedResult.status === "fulfilled" && !selectedResult.value.error) {
      setSelected(
        new Set((selectedResult.value as SelectedCalendar[]).map((c) => c.calendarId))
      )
    } else {
      setSelectedError(
        selectedResult.status === "fulfilled"
          ? selectedResult.value.error
          : "Could not load your saved selection."
      )
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleToggle = (calendarId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(calendarId)) next.delete(calendarId)
      else next.add(calendarId)
      return next
    })
  }

  const handleSave = async () => {
    setSaveState("saving")
    setSaveError(null)

    // Build payload from the available list — ensures name/color always reflect
    // what Google returned in this session, not stale DB values.
    const payload = available
      .filter((cal) => selected.has(cal.id))
      .map((cal) => ({
        calendarId: cal.id,
        name: cal.name,
        ...(cal.color ? { color: cal.color } : {}),
      }))

    try {
      const res = await fetch("/api/settings/calendars/selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to save")
      }

      setSaveState("saved")
      setTimeout(() => setSaveState("idle"), 2000)
    } catch (err: any) {
      setSaveError(err.message)
      setSaveState("idle")
    }
  }

  const saveBtnLabel =
    saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save"
  const saveDisabled = loading || saveState === "saving" || !!availableError

  if (loading) return <p className={styles.spinner}>Loading calendars…</p>

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Google Calendar</h2>
      <p className={styles.sectionDesc}>
        Choose which of your Google Calendars to sync with Familia.
      </p>

      {availableError && (
        <div className={styles.errorBox}>
          <span>{availableError}</span>
          <button onClick={fetchData} className={styles.retryBtn}>
            Retry
          </button>
        </div>
      )}

      {selectedError && <div className={styles.errorBox}>{selectedError}</div>}

      {!availableError && available.length === 0 && (
        <p className={styles.emptyMsg}>No Google calendars found in your account.</p>
      )}

      {!availableError && available.length > 0 && (
        <div className={styles.calendarList}>
          {available.map((cal) => (
            <label key={cal.id} className={styles.calendarRow}>
              <span
                className={styles.colorDot}
                style={{ backgroundColor: cal.color ?? "#94A3B8" }}
              />
              <span className={styles.calendarName}>{cal.name}</span>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={selected.has(cal.id)}
                onChange={() => handleToggle(cal.id)}
              />
            </label>
          ))}
        </div>
      )}

      {!availableError && available.length > 0 && (
        <>
          {saveError && <p className={styles.saveError}>Failed to save. Please try again.</p>}
          <button onClick={handleSave} disabled={saveDisabled} className={styles.saveBtn}>
            {saveBtnLabel}
          </button>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/settings/page.tsx`**

```tsx
// src/app/settings/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState } from "react"
import { GoogleSection } from "./GoogleSection"
import styles from "./settings.module.css"

type Section = "google"

export default function SettingsPage() {
  const { status } = useSession()
  const [activeSection, setActiveSection] = useState<Section>("google")

  // Middleware handles the actual redirect; this prevents a flash while the
  // session cookie is being validated client-side.
  if (status === "loading") return null

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <p className={styles.sidebarTitle}>Settings</p>
        <button
          className={`${styles.sectionBtn} ${activeSection === "google" ? styles.active : ""}`}
          onClick={() => setActiveSection("google")}
        >
          Google
        </button>
      </aside>

      <div className={styles.content}>
        {activeSection === "google" && <GoogleSection />}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Manual test in browser**

With dev server running, sign in and navigate to `http://localhost:3000/settings`. Verify:
- Sidebar shows "Google" as active
- Calendar list loads with colored dots and checkboxes
- Checking calendars and pressing Save returns "Saved" for 2 s
- `GET /api/settings/calendars/selected` after saving reflects the new selection

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/page.tsx src/app/settings/GoogleSection.tsx
git commit -m "feat: add /settings page with Google calendar picker"
```

---

## Task 8: Add Settings Link to Navbar

**Files:**
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: Read the current Navbar**

Read `src/components/Navbar.tsx` in full — confirm it uses a `navLinks` array before following the steps below.

- [ ] **Step 2: Add Settings import and navLink entry**

Add `Settings` to the lucide-react import line. Add the Settings entry to `navLinks`:

```ts
import { Home, Calendar, UtensilsCrossed, Briefcase, Settings, LogOut } from "lucide-react"

const navLinks = [
  { href: "/calendar", label: "Calendar", icon: Calendar, enabled: true },
  { href: "/meals", label: "Meals", icon: UtensilsCrossed, enabled: false },
  { href: "/work", label: "Work", icon: Briefcase, enabled: false },
  { href: "/settings", label: "Settings", icon: Settings, enabled: true },
]
```

- [ ] **Step 3: Manual test**

Navigate the app. "Settings" should appear in the navbar, active when on `/settings`, and link correctly.

- [ ] **Step 4: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat: add Settings nav link"
```

---

## Task 9: Calendar Page Empty State

**Files:**
- Modify: `src/app/calendar/page.tsx`
- Modify: `src/app/calendar/calendar.module.css`

- [ ] **Step 1: Read the current calendar page**

Read `src/app/calendar/page.tsx` in full.

- [ ] **Step 2: Add `calendarSyncCount` to events state**

Update the `events` state type and initial value:

```ts
const [events, setEvents] = useState<{
  googleEvents: any[]
  birthdays: any[]
  travels: any[]
  calendarSyncCount: number
}>({
  googleEvents: [],
  birthdays: [],
  travels: [],
  calendarSyncCount: 0,  // starts at 0; loading=true prevents premature empty-state prompt
})
```

Note: `loading` is initialised to `false` in the current file. The empty-state condition is `calendarSyncCount === 0 && !loading` — this is safe because `fetchEvents` sets `setLoading(true)` before the fetch begins, so the prompt won't flash on initial render.

- [ ] **Step 3: Update `setEvents` call in `fetchEvents`**

```ts
setEvents({
  googleEvents: data.googleEvents ?? [],
  birthdays: data.birthdays ?? [],
  travels: data.travels ?? [],
  calendarSyncCount: data.calendarSyncCount ?? 0,
})
```

- [ ] **Step 4: Add the empty-state prompt to the JSX**

Add `Link` to the imports: `import Link from "next/link"` (if not already present).

In the JSX, after the toolbar `<div>` and before the error banner, add:

```tsx
{events.calendarSyncCount === 0 && !loading && (
  <div className={styles.noCalendarsPrompt}>
    No Google calendars selected.{" "}
    <Link href="/settings" className={styles.noCalendarsLink}>
      Go to Settings →
    </Link>{" "}
    to choose which calendars to sync.
  </div>
)}
```

- [ ] **Step 5: Add CSS classes to `calendar.module.css`**

```css
.noCalendarsPrompt {
  font-size: 0.875rem;
  color: var(--secondary);
  padding: 0.75rem 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.noCalendarsLink {
  color: var(--primary);
  font-weight: 500;
}

.noCalendarsLink:hover {
  text-decoration: underline;
}
```

- [ ] **Step 6: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Manual test**

With no calendars selected, open the calendar page — the prompt should appear. Click "Go to Settings →", select a calendar, save, return to the calendar — prompt should be gone and Google events should load.

- [ ] **Step 8: Commit**

```bash
git add src/app/calendar/page.tsx src/app/calendar/calendar.module.css
git commit -m "feat: show empty-state prompt when no Google calendars selected"
```

---

## Done

All tasks complete. The feature is fully implemented:

1. `CalendarSync` table in PostgreSQL storing per-user calendar selections
2. Three new API routes for listing available and managing selected calendars
3. `/api/calendar/events` fetches only from selected calendars, returns `calendarSyncCount`
4. `/settings` page with Google section for picking calendars
5. Calendar page shows a helpful prompt with a link to settings when nothing is selected
