# Familia

A family management app: shared week planning, a recipe library, a shopping
list, task management, and a calendar view that merges Google Calendar,
imported iCal feeds, birthdays, travel, and custody schedules.

## Stack

- Next.js 16 (App Router), React 19
- PostgreSQL via Prisma (`@prisma/adapter-pg`)
- NextAuth: Google OAuth + username/password (credentials) login
- Google Calendar API, iCal feed parsing (`node-ical`)
- Anthropic API for recipe parsing and shopping-list generation

## Getting started

```bash
npm install
npx prisma generate
npx prisma db push      # sync schema to DB — this project doesn't use `migrate dev`
npx prisma db seed      # seed shopping categories + blacklist terms
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

```
DATABASE_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL
ANTHROPIC_API_KEY   # used by /api/meals/parse and /api/shopping/generate
```

## Commands

```bash
npm run dev      # dev server
npm run build    # production build (runs prisma generate first)
npm run lint     # ESLint
npx prisma studio      # browse the database
```

One-off scripts in `scripts/` are run with `npx tsx scripts/<name>.ts` and are
excluded from the TypeScript build.

There is no test suite.

## Deployment

Deployed via [Coolify](https://coolify.io) (self-hosted Docker), not Vercel.
Recipe photo uploads (`public/uploads/meals/`) are backed by a Coolify volume
mount so they survive redeploys — see `CLAUDE.md` for why uploads are served
through an API route handler rather than Next's static file serving.

## More detail

See `CLAUDE.md` for architecture notes (data model, auth flow, API routes,
styling conventions) aimed at anyone — human or AI — working in this repo.
