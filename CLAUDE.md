# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (Next.js 16)
npm run build    # Production build
npm run lint     # ESLint (note: ~73 pre-existing errors in API routes; scope to changed files when verifying feature work)
npx prisma migrate dev   # Apply schema migrations
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma db push       # Sync schema to DB without migrations (used in this project)
npx prisma db seed       # Seed shopping categories and blacklist terms for all families
npx prisma studio        # Browse database
```

There is no test suite (`npm test` is not configured).

## Architecture

**Familia** is a Next.js 16 family management app with Google OAuth, PostgreSQL (via Prisma), and Google Calendar integration.

### Auth
- `next-auth` with Google OAuth provider (`src/lib/auth.ts`)
- JWT strategy; `session.user` is extended with `id`, `familyId`, `role`
- All API routes gate on `getServerSession(authOptions)` — check `familyId` before any DB query
- Google OAuth scope includes `calendar` for Calendar API access
- Tokens (access + refresh) are stored in the `Account` table and auto-refreshed via `oauth2Client.on('tokens', ...)`

### Data model (Prisma + PostgreSQL)
Key relationships:
- `User` → `Family` (many users per family)
- `Family` → `DayPlan` (week planning, Sun–Sat blocks)
- `DayPlan` → `Meal` (optional FK for `lunchMealId` / `dinnerMealId`)
- `Family` → `Meal` (recipe library)
- `Family` → `Task` → `TaskAssignee` (task management; assignees are family members)
- `User` → `CalendarSync` (selected Google Calendar IDs per user)
- `User` → `WorkLocation`, `Activity`, `Travel`
- `Family` → `Birthday`, `CustodySchedule`

Prisma client is initialized once globally (`src/lib/prisma.ts`) using the `@prisma/adapter-pg` pool adapter.

### Pages & routing
| Route | Description |
|-------|-------------|
| `/` | Home — greeting + current week summary (read-only `WeekBlock`) + tasks widget |
| `/week` | Week planning — editable `WeekBlock` with day notes, lunch/dinner |
| `/calendar` | Calendar view with Google Calendar events, birthdays, travel |
| `/meals` | Recipe library list |
| `/meals/new` | Create recipe |
| `/meals/[id]` | Recipe detail with inline editing |
| `/shopping` | Shopping list with category grouping |
| `/tasks` | Task management — grouped by Overdue/This week/Later, assignee filter, show-completed toggle |
| `/settings` | Profile, location, Google Calendar sync selection |

### Key components
- `WeekBlock` (`src/app/week/WeekBlock.tsx`) — shared week display used on both `/` (read-only) and `/week` (editable); supports a `/recipe` slash command in lunch/dinner cells to link a meal from the library
- `TaskModal` (`src/app/tasks/TaskModal.tsx`) — shared create/edit modal; exports `TaskData` type; used on both `/tasks` page and the homepage tasks widget
- `Providers` (`src/components/Providers.tsx`) — wraps `SessionProvider`
- `Navbar` (`src/components/Navbar.tsx`) — client component, shows nav only when authenticated

### API routes
All under `src/app/api/`:
- `weeks/` — GET (list week plans), POST (create next week)
- `weeks/days/[date]/` — PATCH (update a single day's fields)
- `meals/` — GET/POST (recipe library)
- `meals/[id]/` — GET/PATCH/DELETE
- `calendar/events/` — GET (fetches Google Calendar events for selected calendars)
- `calendar/birthdays/` — GET/POST; `[id]/` — PATCH/DELETE
- `calendar/travel/` — GET/POST; `[id]/` — PATCH/DELETE
- `settings/calendars/available/` — GET (lists user's Google Calendars)
- `settings/calendars/selected/` — GET/POST (manage `CalendarSync` rows)
- `tasks/` — GET (list, `?includeDone=true`), POST (create)
- `tasks/[id]/` — PATCH (partial update, atomic assignee replacement via `$transaction`), DELETE
- `family/` — GET/POST (family management)
- `family/members/` — GET (list family members; used for assignee pickers)
- `user/` — GET/PATCH (profile)
- `weather/` — GET (weather for family city)
- `auth/[...nextauth]/` — NextAuth handler

### Google Calendar integration
`src/lib/google/calendar.ts` provides:
- `getGoogleCalendarClient(userId)` — builds an OAuth2 client from the stored account tokens
- `listEventsFromCalendars(userId, calendarIds, timeMin, timeMax)` — fetches events from multiple calendars in parallel, deduplicates by event ID

### Styling
CSS Modules per page/component (e.g. `calendar.module.css`, `meals.module.css`). Global styles in `src/app/globals.css`. Fonts: Geist Sans + Geist Mono via `next/font/google`.

**Mobile:** One breakpoint at `768px`. Add `@media (max-width: 768px)` overrides at the bottom of each CSS module — never modify desktop styles. Container class names vary by page (`.main`, `.container`, `.calendarContainer`, `.page`) — check the file before writing overrides. Desktop-first: mobile is secondary.

**Content column width:** Tasks, recipes (`/meals`), and shopping pages use a fixed `min-width: 720px; max-width: 720px` column centered with `margin: 0 auto`. Reset `min-width: 0` in the mobile media query. This is the standard grid for list/detail pages in this app.

## Environment variables required
```
DATABASE_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL
ANTHROPIC_API_KEY   # used by /api/meals/parse (recipe text → structured fields)
```
