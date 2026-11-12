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
- `User` → `ImportedCalendar` (iCal feed URLs)
- `User` → `WorkLocation`, `Activity`, `Travel`
- `Family` → `Birthday`, `CustodySchedule`
- `User` → `PersonalTodo` (private per-user todo list; **always scope by `userId`, never by `familyId`** — other family members must not see it)
- `User` → `PersonalCategory` (the user's own todo categories/projects with optional `description` that guides the thoughts assistant; `PersonalTodo.category` stores the **name**, so renames/deletes in `personal-categories/[id]` update todos by name; names unique per user, compared case-insensitively in code — helpers in `src/lib/personalCategories.ts`)
- `User` → `PersonalProfile` (private free-text "About me", 1:1 keyed by `userId`; separate table so it can't leak via queries that include family `User` rows — never add it to such includes)

Prisma client is initialized once globally (`src/lib/prisma.ts`) using the `@prisma/adapter-pg` pool adapter.

**Schema changes**: always use `npx prisma db push` (not `migrate dev`). After any schema change run `npx prisma generate`.

### Pages & routing
| Route | Description |
|-------|-------------|
| `/` | Home — greeting + current week summary (read-only `WeekBlock`) + tasks widget |
| `/onboarding` | Family create/join flow for new users without a family |
| `/week` | Week planning — editable `WeekBlock` with day notes, lunch/dinner. Header: "+ next week" button right after the title (`PageHeader` `addon`), "Laura und Till Calendar" link to `/calendar` top right |
| `/calendar` | Calendar view with Google Calendar events, birthdays, travel. Not in the main menu — reached via the link on `/week` |
| `/meals` | Recipe library list |
| `/meals/new` | Create recipe |
| `/meals/[id]` | Recipe detail with inline editing |
| `/shopping` | Shopping list with category grouping |
| `/tasks` | Task management — grouped by Overdue/This week/Later, assignee filter, show-completed toggle |
| `/thoughts` | Private "Gedanken" inbox — free-text brain dump is split/categorised by Claude into the user's own todo list (only visible to them). Open items are one flat list sorted by due date (next first, undated last) with a category pill per row; notes only show in the edit modal. Rows can be dragged (HTML5 DnD, desktop) onto the category filter pills to move them; "Categories" pill opens `CategoriesModal.tsx` (add/rename/merge/describe/delete). The composer (and `QuickThought`) has a mic button — `VoiceInputButton` (`src/components/`), Web Speech API dictation into the textarea; hidden where unsupported (Firefox) |
| `/heating` | Homematic IP heating — Access Point status badge + one card per room (current/target temp with ±0.5 stepper, Auto/Manual/Eco segmented control, boost, humidity/valve/window/battery, "next switching point" and an expandable read-only week plan — `WeekSchedule.tsx`, one row per weekday with a 0–24h bar + the day's periods). Empty state links to `/settings?section=heating` when not connected. Navbar shows `HeatingStatusIcon` (`src/components/`) — thermometer with a status dot (green online, red AP offline/cloud error, amber pairing, hollow = not connected) linking here; it refreshes on focus, every 5 min and on the `heating-status-changed` window event |
| `/settings` | Profile (incl. private "About me" — `AboutMeSection.tsx`, used as life context by the thoughts assistant), location, Google Calendar sync selection, family management, shopping categories/blacklist |

### Key components
- `WeekBlock` (`src/app/week/WeekBlock.tsx`) — shared week display used on both `/` (read-only) and `/week` (editable); supports a `/recipe` slash command in lunch/dinner cells to link a meal from the library. On mobile (≤768px) the table is hidden and replaced by Day / 3-Day / Week pill-switcher views. The **Day/3-Day view uses a row-first layout** — outer loop is `ALL_ROWS`, inner loop is `getMobileDays()`, each field rendered as a `.mobileRowGroup` (flex row with `align-items: stretch`) so all day cells in a row share the same height. The Week view is a mini-table (`grid-template-columns: 40px repeat(7, 1fr)`) with icon label column. Pill tap-to-detail uses shared `pillComponents` + `mobilePillDetail` state (bottom-sheet modal). The "Add to shopping list" button renders as a sibling below the `weekHeader` h2, not inside it.
- `TaskModal` (`src/app/tasks/TaskModal.tsx`) — shared create/edit modal; exports `TaskData` type; used on both `/tasks` page and the homepage tasks widget
- `Providers` (`src/components/Providers.tsx`) — wraps `SessionProvider`
- `Navbar` (`src/components/Navbar.tsx`) — client component, shows nav only when authenticated; mobile: slide-in drawer triggered by hamburger, closes on backdrop click
- AI import on `/meals/new` (`src/app/meals/new/page.tsx`) — one text/URL is parsed via `/api/meals/parse` into the form for review; several (split by a line of `---`+ dashes, or one link per line — `splitImportText` in `src/app/meals/importItems.ts`) are parsed and saved one by one via `POST /api/meals` with progress + per-item results; failed inputs stay in the textarea. (There is no separate batch-import modal any more.)

### API routes
All under `src/app/api/`:
- `weeks/` — GET (list week plans), POST (create next week)
- `weeks/days/[date]/` — PATCH (update a single day's fields)
- `meals/` — GET/POST (recipe library)
- `meals/[id]/` — GET/PATCH/DELETE
- `meals/parse/` — POST (Anthropic API: recipe text → structured fields)
- `calendar/events/` — GET (fetches Google Calendar + iCal imported events; merges birthdays, travel, custody)
- `calendar/imported/` — GET/POST; `[id]/` — PATCH/DELETE (iCal feed management)
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
- `shopping/items/` — GET/POST/DELETE (list, add, clear all); `[id]/` — PATCH/DELETE
- `shopping/categories/` — GET/POST; `[id]/` — PATCH/DELETE
- `shopping/blacklist/` — GET/POST; `[id]/` — DELETE
- `shopping/generate/` — POST (Anthropic API: generate shopping list from meal plan)
- `personal-todos/` — GET (own items, `?includeDone=true`), POST `{ text }` (brain dump → Claude splits/categorises via `captureThoughts` in `src/lib/personalTodos.ts`; falls back to one `Inbox` item if the AI call fails); `[id]/` — PATCH/DELETE (owner only, others get 404)
- `personal-categories/` — GET (all own categories with open counts; lazily creates rows for names only used by todos), POST `{ name, description? }` (409 if exists); `[id]/` — PATCH `{ name?, description? }` (rename moves todos; renaming onto an existing name merges), DELETE (todos move to `Inbox`)
- `personal-profile/` — GET/PUT `{ text }` (own private profile). `buildLifeContext(userId)` in `src/lib/personalProfile.ts` combines it with name, family members, city and saved birthdays (with computed ages) — passed to `captureThoughts` as prompt context and returned by the `get_personal_profile` MCP tool
- `mcp/` — MCP server (`src/lib/mcp/`); tool handlers receive `{ userId, familyId }`. Tools: shopping list (family-scoped) and `capture_thoughts` / `list_personal_todos` / `complete_personal_todos` / `get_personal_profile` (user-scoped)
- `user/` — GET/PATCH (profile)
- `weather/` — GET (weather for family city)
- `heating/` — GET (connection status + `accessPointOnline` + Homematic IP rooms); `status/` — GET (lightweight status for the navbar icon); `schedules/` — GET (read-only weekly schedule of each room's active profile, `days[0]` = Monday); `connect/` — POST start pairing / GET poll for blue-button press / DELETE disconnect; `rooms/[id]/` — PATCH (target temperature, mode, boost); `automation/` — GET (smart schedule settings + rooms/members/custody names + today/tomorrow preview + last run) / PUT (save); `automation/run/` — POST ("Run now": apply today's rules immediately, doesn't claim the day)
- `auth/[...nextauth]/` — NextAuth handler

### i18n
All UI strings go through `src/lib/i18n/index.ts`. The `Translations` type defines the full shape; three locale objects (`en`, `de`, `es`) implement it. `useTranslation()` from `src/lib/i18n/LanguageContext.tsx` returns `{ t, language, setLanguage }`. When adding new strings, update the type definition **and** all three locale objects.

### Google Calendar integration
`src/lib/google/calendar.ts` provides:
- `getGoogleCalendarClient(userId)` — builds an OAuth2 client from the stored account tokens
- `listEventsFromCalendars(userId, calendarIds, timeMin, timeMax)` — fetches events from multiple calendars in parallel, deduplicates by event ID

### iCal / imported calendars
`src/lib/ical.ts` — `fetchAndParseIcal(url, calendarId, name, color, timeMin, timeMax)` fetches an iCal URL (normalising `webcal://` → `https://`) and returns `ImportedEvent[]`. Recurring events are expanded via `expandRecurringEvent` from `node-ical`. Imported calendars are stored in the `ImportedCalendar` table (`User` → `ImportedCalendar`). Managed via `calendar/imported/` API routes; events are fetched alongside Google events in `calendar/events/`.

### Homematic IP heating
`src/lib/homematic/client.ts` talks to the **unofficial** Homematic IP cloud API (same protocol as the `homematicip-rest-api` Python library / Home Assistant): lookup of the regional host via `lookup.homematic.com:48335`, pairing by pressing the blue button on the Access Point, then `/hmip/...` calls with an `AUTHTOKEN` header. One `HomematicConnection` row per family stores the SGTIN, REST host and token — the token is server-only. Rooms are Homematic `HEATING` groups. `src/lib/homematic/family.ts` holds the family-scoped helpers shared by `/api/heating` and the MCP tools (`src/lib/mcp/tools/heating.ts`). `getFamilyHome` caches the cloud state per family for 15 s (bypassed after a change) so the navbar icon, page and MCP tools don't hit the cloud's rate limit. `accessPointOnline` comes from `home.connected` in `getCurrentState`. Heating schedules: each HEATING group has `activeProfile` (e.g. `PROFILE_1`) + `profiles`; `group/heating/getProfile` `{ groupId, profileIndex, profileName }` returns `profileDays` keyed `MONDAY`…`SUNDAY`, each `{ baseValue, periods: [{ starttime, endtime, value }] }`. Reading profiles requires the Kieke client to have **admin rights** in the Homematic IP app (Einstellungen → connected clients); without them `getProfile` answers 400 `CLIENT_ACCESS_DENIED` while reading room state and controlling still work. Kieke only reads them (cached 10 min) — editing stays in the Homematic IP app. MCP tool `get_heating_schedule` returns the same. Settings accepts `?section=<id>` to open a section directly. Note: the cloud accepts a connection request even for a non-existent SGTIN, so a typo only surfaces when the 5-minute pairing window expires.

#### Smart heating schedule
`src/lib/homematic/automation.ts` + Settings → Heating → "Smart schedule" (`HeatingAutomationSection.tsx`). One `HeatingAutomation` row per family: `enabled`, `baseTemperature` (default 18), `time` ("HH:MM", default 08:00), `timeZone` (Europe/Berlin), `rules` JSON (one per room: `WORK_AWAY` + `userId` → lower when that member's `WorkLocation` is `OFFICE`; `CHILD_AWAY` + `personName` → lower when `CustodySchedule` is `WITH_MONA`). At the set time each room is set to the base temperature **in AUTOMATIC mode** (lasts until the next Homematic switching point, then the week plan takes over; later manual changes win). Skipped (`decide()`): nothing entered in the week planner for that day, person home / child with us, room missing, no thermostat, room in Manual/Eco, boost on, target already ≤ base (unless a window is open). Each run is stored in `lastRunLog`.
Scheduler: **in-process timer** started from `src/instrumentation.ts` (only when `NODE_ENV=production`, or with `HEATING_AUTOMATION=on` in dev, because it changes real thermostats). It ticks every minute; `runDueAutomations` claims the day atomically via `lastRunDate` (so it runs once per day even with two instances), catches up a missed run within 2 h after the set time (e.g. after a redeploy), and on a total failure (not connected, cloud unreachable, AP offline) gives the day back and retries after 10 min. Saving after today's time has passed marks today as done (no surprise catch-up run).

### Recipe photo storage
Recipe photos (`meals/[id]/image/`) are written to `public/uploads/meals/` on disk, but are **served through the same route handler** (`GET /api/meals/[id]/image`), not via Next's static `/public` serving. Reason: in production, Next's router snapshots the contents of `public/` once at server boot (`setupFsCheck` in `next/dist/server/lib/router-utils/filesystem.js`) and resolves static requests against that in-memory list — it never re-scans the filesystem. A file uploaded after the server started is invisible to that snapshot and 404s even though it genuinely exists on disk, regardless of host (true on Vercel and on a long-running container alike). The GET handler sidesteps this by reading the file straight off disk on every request (`Cache-Control: no-store`, since the URL is stable per meal and must reflect the latest upload). `Meal.imageUrl` for newly uploaded photos is the API path (`/api/meals/<id>/image`), not a literal `/uploads/...` path; do not rely on Next statically serving new uploads.

Deployed via Coolify (self-hosted Docker, not Vercel — despite the README's default create-next-app boilerplate text). `public/uploads/meals/` is backed by a Coolify **Volume Mount** (named Docker volume, empty Source Path, destination `/app/public/uploads`) so uploads survive redeploys/restarts of the container.

### Styling
CSS Modules per page/component. Global styles in `src/app/globals.css`. Fonts: Geist Sans + Geist Mono via `next/font/google`.

**Design tokens** (`globals.css`): always use them instead of raw values — type `var(--text-2xs … --text-3xl)` (11/12/13/14/15/16/18/22/28px), radius `var(--radius-sm|--radius|--radius-lg|--radius-full)`, spacing `var(--space-1 … --space-8)`, colours `--background --surface --surface-hover --foreground --secondary (muted text) --border --primary --primary-hover --on-primary (text on primary bg) --accent-soft --accent-border --danger --danger-soft --success --overlay`. Light/dark values live in `:root` / `[data-theme="dark"]` (dark = neutral greys with green highlights; muted text ≥4.5:1).

**Shared UI components** (`src/components/ui/`): use these instead of page-specific button/header CSS.
- `PageHeader` — `title`, optional `addon` (e.g. lock icon), `actions` (always top-right; wraps under the title on mobile). Page containers are flex columns with `gap`, so it has no margins.
- `Button` — `variant` `primary` (main action, max one per area) | `secondary` (outlined) | `ghost` (quiet) | `danger` (destructive, outlined red); `size` `sm|md`; `icon`; `active` (toggled); `fullWidth`; `href` renders a Next `Link`. Defaults to `type="button"`. In modal footers put Delete first with a `margin-right: auto` class, then Cancel (secondary), then Save (primary).
- `FilterPill` — filter/toggle chips with `active`, optional `count`, `highlight` (drop target); forwards all button props (e.g. drag handlers).
- `Button iconOnly` — round icon button (pass `aria-label`); `variant="danger" active` = solid red "click again to confirm" state.
- `EmptyState` — `icon` + message + optional `action`; use for every empty list instead of a bare `<p>`.
- **Focus**: `globals.css` gives `a`/`button`/`[role=button]` a visible `:focus-visible` outline (zero specificity via `:where`). Bordered inputs must use `border-color: var(--primary); box-shadow: var(--focus-ring);` in their own `:focus` rule (no global input ring, because borderless inline editors exist). Clickable `div` rows get `role="button" tabIndex={0}` + Enter handler.
- **Touch** (≤768px, `globals.css`): buttons ≥44×44, selects ≥44px tall, checkboxes 22px; list-row hover uses `var(--surface-hover)`.
- Note: `globals.css` gives every `button` `min-height: 44px` on ≤768px; the shared components set their own mobile heights.

**Breakpoints** (desktop-first — mobile is secondary):
```
480px   phones          @media (max-width: 480px)
768px   tablet portrait @media (max-width: 768px)   ← existing breakpoint, use for mobile overrides
1024px  tablet landscape @media (max-width: 1023px)
```
Add breakpoint overrides at the bottom of each CSS module. Never modify desktop styles for mobile behaviour. Container class names vary by page (`.main`, `.container`, `.calendarContainer`, `.page`) — check the file before writing overrides.

**Overflow/scroll on mobile**: flex items default to `min-width: auto` and will overflow instead of scrolling. When adding `overflow-x: auto` to a flex container, also set `min-width: 0` on the flex item. The calendar uses a dedicated `.calendarScrollWrapper` div for this reason.

**Page layout:** wrap every page in `<Page width="narrow|wide">` (`src/components/ui/Page.tsx`) instead of a page-specific container. Two widths only: **narrow 720px** (Tasks, Shopping, Thoughts, Recipes list/new/detail) and **wide 1200px** (Home, Week Planner, Calendar — aligned with navbar/footer). Same padding everywhere (desktop `--space-7` top / `--space-6` sides, ≤1023px `--space-4` sides, ≤768px `--space-5` top / `--space-3` sides) and children are spaced by the container's `gap` (`--space-5`, mobile `--space-4`) — don't add top/bottom margins to direct children. Exceptions: Settings keeps its own grid container (also 1200px, same padding; stacked `.section`s get a divider via `.section + .section`), Imprint/Privacy keep their prose container (720px, same padding), Onboarding is a centred card. The homepage tasks widget is `max-width: 50%` on desktop.

**Floating action button**: `QuickThought` marks its FAB with `data-fab`; `globals.css` then pads the footer (`body:has([data-fab]) footer`) so the FAB never covers the footer links.

**Flex children + `margin: 0 auto`**: applying `margin: 0 auto` to a flex child overrides `align-self: stretch`, causing it to shrink-wrap its content on first render then jump wide when real content loads. Always add `width: 100%` alongside `max-width` + `margin: 0 auto` on any direct flex child of `appShell`. All page containers already follow this pattern.

**WeekBlock mobile pill rendering**: The mobile day cards use `.mobileDayFieldContent` (defined in `week.module.css`) for markdown/ReactMarkdown output — **not** `.cellPreview`. `cellPreview` is table-cell-specific (carries `min-height`, double-padding, flex-context assumptions) and breaks pill rendering when reused in the mobile card context. `.mobileDayFieldContent` has its own `ul li` pill CSS. Do not replace `.mobileDayFieldContent` with `.cellPreview` in the mobile day card render path.

**Shopping offline sync** (`src/lib/shoppingOffline.ts`, used by `src/app/shopping/page.tsx`): adds, check-offs and "Clear list" are written to a per-user **outbox** in localStorage first (in-memory fallback if storage is blocked) and the list updates immediately; the outbox is replayed **in order** on load, on `online`, on returning to the foreground and every 15s while non-empty. An op leaves the outbox only after the server answered (404 on delete = already gone = done; 5xx/401/network error = stop and retry later; other 4xx on add = drop + show error). Items added offline carry a `optimistic-…` temp id (not editable until synced); checking one off before it was sent just drops its add (or deletes it right after landing if it was in flight). The last server list is cached per user and shown instantly/when the API is unreachable; pending ops are re-applied on top (`applyOutbox`). "Clear list" queues per-item deletes of what the device shows (not the clear-all endpoint). Item edits remain online-only.

**Shopping tag pills** cycle on tap: off → only this tag (new items get the tag) → hide this tag (struck through, eye-off icon; several tags can be hidden at once) → off; "All" resets. Mobile (≤768px): no × per row (the checkbox removes items) and no vertical row padding — the 44px item-name button sets the row height.

**Shopping management**: Categories and blacklist are managed under Settings → Shopping (`src/app/settings/ShoppingSection.tsx`). The `/shopping` page no longer contains a manage panel — it only handles the live shopping list (add/check/clear items) plus category grouping.

**Favicon**: `src/app/icon.svg` — Bot icon on `#6366f1` rounded-square background. Next.js serves it automatically as `<link rel="icon" type="image/svg+xml">`; no explicit `<link>` tag needed in `layout.tsx`.

## Environment variables required
```
DATABASE_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL
ANTHROPIC_API_KEY   # used by /api/meals/parse (recipe text → structured fields)
```

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
