# Credentials Auth — Design Spec

**Date:** 2026-03-22
**Status:** Approved

## Overview

Add username/password authentication alongside existing Google OAuth, enabling parents to create accounts for children who have no Google account. Child accounts are created and managed by parents from the Settings page.

## 1. Data Model

Two new nullable fields on the `User` model:

```prisma
username     String?  @unique
passwordHash String?
```

- `username` — globally unique slug (e.g. `emma-smith`). Only set for credential-based users.
- `passwordHash` — bcrypt hash. Null for Google-authenticated users.
- `email` — already nullable; credential users have no email. PostgreSQL `@unique` allows multiple nulls, so no constraint issue.
- `name` — already nullable on User; set from the display name field at creation.
- Google users are unaffected; `username` and `passwordHash` remain null for them.

Migration: `npx prisma db push`.

## 2. Auth Config (`src/lib/auth.ts`)

Add a `CredentialsProvider` alongside the existing `GoogleProvider`:

- **Inputs:** `username`, `password`
- **Flow:** look up `User` by `username` → if not found or hash mismatch, return `null` (single generic error, no leakage of which field failed) → on success return the user object
- **Error message shown to user:** "Invalid username or password"
- Session strategy stays `"jwt"` (already set).
- The existing JWT callback already has a fallback: if `token.familyId` is missing, it re-fetches from DB using `token.id`. Credential users go through this path on first login — no changes needed to the JWT/session callbacks.
- Add `bcryptjs` as a dependency (pure JS, no native bindings needed).

## 3. Child Account Creation (`/settings`)

New "Children" tab in the Settings sidebar, visible to all authenticated users but creation/management actions gated to `PARENT` and `ADMIN` roles.

**Authorization rules:**
- Only `PARENT`/`ADMIN` can create or reset passwords for child accounts.
- Actions are scoped to the user's own `familyId` — no cross-family access.
- Children (`MEMBER` role) see the tab but cannot create or edit accounts.

**Create form fields:**
- Display name (stored as `User.name`, e.g. "Emma")
- Username (stored as `User.username`, e.g. `emma-smith`) — globally unique
- Password — minimum 8 characters

**`POST /api/family/members`**
- Auth: session required, role must be `PARENT` or `ADMIN`
- Request body: `{ name, username, password }`
- Validates: username uniqueness → `409 Conflict` if taken, password length → `400` if too short
- Creates `User` with `familyId` from session, `role: MEMBER`, bcrypt-hashed password
- Response: `201` with `{ id, name, username }`

**Existing children list:**
- Shows `name` + `username` for each `MEMBER`-role user in the family who has a `username` (i.e. credential accounts)
- "Reset password" per child: inline form to set a new password (min 8 chars)

**`PATCH /api/family/members/[id]`**
- Auth: session required, role must be `PARENT` or `ADMIN`, target user must be in same family
- Request body: `{ password }`
- Validates password length, re-hashes, updates `passwordHash`
- Response: `200`

## 4. Login UI (`/`)

Two visually distinct sign-in options with a clear separator:

```
[ Sign in with Google ]

─────── or ───────

Username  [ __________ ]
Password  [ __________ ]
          [ Sign in    ]
```

- Inline error on failed login: "Invalid username or password"
- No "forgot password" link — parents reset from Settings
- No self-registration form — accounts are created by parents only
