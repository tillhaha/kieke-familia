# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (Next.js 16)
npm run build    # Production build
npm run lint     # ESLint (note: ~73 pre-existing errors in API routes; scope to changed files when verifying feature work)
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma db push       # Sync schema to DB without migrations (used in this project — never use migrate dev)
npx prisma db seed       # Seed shopping categories and blacklist terms for all families
npx prisma studio        # Browse database
```

One-off scripts in `scripts/` are run with `npx tsx scripts/<name>.ts` and are excluded from TypeScript compilation (`tsconfig.json` excludes `scripts/`).

There is no test suite (`npm test` is not configured).

## Architecture

**Familia** is a Next.js 16 family management app with Google OAuth + credentials auth, PostgreSQL (via Prisma), and Google Calendar integration.

### Auth
- `next-auth` with both Google OAuth and `CredentialsProvider` (username + bcrypt password) — `src/lib/auth.ts`
- JWT strategy; `session.user` is extended with `id`, `familyId`, `role`
- All API routes gate on `getServerSession(authOptions)` — check `familyId` before any DB query
- Google OAuth scope includes `calendar` for Calendar API access
- Tokens (access + refresh) are stored in the `Account` table and auto-refreshed via `oauth2Client.on('tokens', ...)`
- Credential users do not have `familyId`/`role` in the initial JWT; the jwt callback re-fetches them from DB when missing (`token.familyId` absent + `token.id` present)
- Session fields updated client-side via `useSession().update({ familyId, role })` after onboarding

### Onboarding
New users without a `familyId` should be sent to `/onboarding`. There they can:
- **Create** a family (`POST /api/family/create`) — creates Family + sets user role to ADMIN in a `$transaction`
- **Join** a family (`POST /api/family/join`) — looks up by `joinCode`, sets user role to MEMBER

After either action, call `update({ familyId, role })` to patch the JWT session.

### Data model (Prisma + PostgreSQL)
Key relationships:
- `User` → `Family` (many users per family); `User.role` is enum `ADMIN | PARENT | MEMBER`
- `User` has optional `username` + `passwordHash` for credential login
- `Family` → `DayPlan` (week planning, Sun–Sat blocks)
- `DayPlan` → `Meal` (optional FK for `lunchMealId` / `dinnerMealId`)
- `Family` → `Meal` (recipe library)
- `Family` → `Task` → `TaskAssignee` (task management; assignees are family members)
- `User` → `CalendarSync` (selected Google Calendar IDs per user)
- `User` → `WorkLocation`, `Activity`, `Travel`
- `Family` → `Birthday`, `CustodySchedule`

Prisma client is initialized once globally (`src/lib/prisma.ts`) using the `@prisma/adapter-pg` pool adapter.

**Schema changes**: always use `npx prisma db push` (not `migrate dev`). After any schema change run `npx prisma generate`.

### Pages & routing
| Route | Description |
|-------|-------------|
| `/` | Home — greeting + current week summary (read-only `WeekBlock`) + tasks widget |
| `/onboarding` | Family create/join flow for new users without a family |
| `/week` | Week planning — editable `WeekBlock` with day notes, lunch/dinner |
| `/calendar` | Calendar view with Google Calendar events, birthdays, travel |
| `/meals` | Recipe library list |
| `/meals/new` | Create recipe |
| `/meals/[id]` | Recipe detail with inline editing |
| `/shopping` | Shopping list with category grouping |
| `/tasks` | Task management — grouped by Overdue/This week/Later, assignee filter, show-completed toggle |
| `/settings` | Profile, location, Google Calendar sync selection, family management |

### Key components
- `WeekBlock` (`src/app/week/WeekBlock.tsx`) — shared week display used on both `/` (read-only) and `/week` (editable); supports a `/recipe` slash command in lunch/dinner cells to link a meal from the library
- `TaskModal` (`src/app/tasks/TaskModal.tsx`) — shared create/edit modal; exports `TaskData` type; used on both `/tasks` page and the homepage tasks widget
- `Providers` (`src/components/Providers.tsx`) — wraps `SessionProvider`
- `Navbar` (`src/components/Navbar.tsx`) — client component, shows nav only when authenticated; mobile: slide-in drawer triggered by hamburger, closes on backdrop click

### API routes
All under `src/app/api/`:
- `weeks/` — GET (list week plans), POST (create next week)
- `weeks/days/[date]/` — PATCH (update a single day's fields)
- `meals/` — GET/POST (recipe library)
- `meals/[id]/` — GET/PATCH/DELETE
- `meals/parse/` — POST (Anthropic API: recipe text → structured fields)
- `calendar/events/` — GET (fetches Google Calendar events for selected calendars)
- `calendar/birthdays/` — GET/POST; `[id]/` — PATCH/DELETE
- `calendar/travel/` — GET/POST; `[id]/` — PATCH/DELETE
- `calendar/custody/` — GET/POST; `[id]/` — PATCH/DELETE
- `settings/calendars/available/` — GET (lists user's Google Calendars)
- `settings/calendars/selected/` — GET/POST (manage `CalendarSync` rows)
- `tasks/` — GET (list, `?includeDone=true`), POST (create)
- `tasks/[id]/` — PATCH (partial update, atomic assignee replacement via `$transaction`), DELETE
- `family/` — GET/PATCH (family info + settings)
- `family/create/` — POST (create family + assign user as ADMIN)
- `family/join/` — POST (join by joinCode)
- `family/members/` — GET (list family members); `[id]/` — PATCH/DELETE
- `user/` — GET/PATCH (profile)
- `weather/` — GET (weather for family city)
- `auth/[...nextauth]/` — NextAuth handler

### Google Calendar integration
`src/lib/google/calendar.ts` provides:
- `getGoogleCalendarClient(userId)` — builds an OAuth2 client from the stored account tokens
- `listEventsFromCalendars(userId, calendarIds, timeMin, timeMax)` — fetches events from multiple calendars in parallel, deduplicates by event ID

### Styling
CSS Modules per page/component. Global styles in `src/app/globals.css`. Fonts: Geist Sans + Geist Mono via `next/font/google`.

**Breakpoints** (desktop-first — mobile is secondary):
```
480px   phones          @media (max-width: 480px)
768px   tablet portrait @media (max-width: 768px)   ← existing breakpoint, use for mobile overrides
1024px  tablet landscape @media (max-width: 1023px)
```
Add breakpoint overrides at the bottom of each CSS module. Never modify desktop styles for mobile behaviour. Container class names vary by page (`.main`, `.container`, `.calendarContainer`, `.page`) — check the file before writing overrides.

**Overflow/scroll on mobile**: flex items default to `min-width: auto` and will overflow instead of scrolling. When adding `overflow-x: auto` to a flex container, also set `min-width: 0` on the flex item. The calendar uses a dedicated `.calendarScrollWrapper` div for this reason.

**Content column width:**
- Homepage (`.main`): `max-width: 1100px; margin: 0 auto` — full-width container. The tasks widget inside is `max-width: 50%`; the `WeekBlock` fills the full container.
- Tasks (`.page`) and Shopping (`.container`): `max-width: 50vw; min-width: 480px` — scales to half the viewport on desktop, resets to `max-width: 100%; min-width: 0` on mobile.
- Settings (`.container`): CSS Grid `grid-template-columns: 180px 1fr` with `width: 100%; max-width: 1100px; margin: 0 auto`. The `width: 100%` is required — omitting it causes the flex child to shrink-wrap its content, making `margin: 0 auto` shift the layout whenever section content changes width.
- Meals pages use `max-width: 720px` centered.

**Flex children + `margin: 0 auto`**: applying `margin: 0 auto` to a flex child overrides `align-self: stretch`, causing it to shrink-wrap its content. Always add `width: 100%` alongside `max-width` + `margin: 0 auto` on any direct flex child that should fill available width.

## Environment variables required
```
DATABASE_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL
ANTHROPIC_API_KEY   # used by /api/meals/parse (recipe text → structured fields)
```
