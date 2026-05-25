# Recipe Public Sharing via Permanent URL

**Date:** 2026-05-25  
**Status:** Approved

## Summary

Allow family members to share recipes with friends by simply sending the recipe's existing URL (`/meals/[id]`). No tokens, no opt-in — every recipe has a permanent public URL. Non-owners see a fully read-only view; family members see the full editable interface.

## Goals

- Any recipe is viewable without authentication via its existing URL
- Editing controls are only shown to authenticated users whose `familyId` matches the meal's `familyId`
- No new routes, no schema changes, no share tokens

## Non-Goals

- Revokable share links
- Per-recipe sharing toggle
- Copy-link button or share UI
- Access tracking or analytics

## Architecture

### API — `GET /api/meals/[id]`

Remove the session and `familyId` guard from the GET handler only. PATCH and DELETE remain fully auth-gated. The meal record is returned regardless of whether the requester is authenticated.

Security note: meal IDs are CUIDs (random, 25-character, ~148 bits of entropy) — effectively non-guessable, providing security by obscurity appropriate for a family recipe context.

### Page — `/meals/[id]/page.tsx`

The page is a client component that fetches `GET /api/meals/[id]`. Since the endpoint no longer requires auth, the fetch succeeds for unauthenticated visitors.

After fetching, the page determines ownership:

```
const isOwner = session?.user?.familyId === meal.familyId
```

All editing controls are gated on `isOwner`:

| Element | Owner | Non-owner |
|---|---|---|
| Recipe name | `<input>` (editable) | `<h1>` text |
| Meal type / diet dropdowns | `<select>` | Static text badge |
| Toggles (office-friendly, 30-min, favorite) | Interactive | Display-only |
| Notes / ingredients / steps | Click-to-edit textarea | Static markdown |
| Delete button | Visible | Hidden |
| Image upload | Visible | Hidden |
| Source field | Editable | Read-only link |

Layout, styling, and image display are unchanged for all users.

## Data Flow

1. Visitor navigates to `/meals/[id]`
2. Page fetches `GET /api/meals/[id]` (no auth header needed)
3. API returns meal data
4. Page checks `session?.user?.familyId` against `meal.familyId`
5. Renders owner or read-only view accordingly

## Error Handling

- Invalid/unknown meal ID → existing 404 handling unchanged
- Unauthenticated user on a valid meal → read-only view (no redirect, no error)

## Migration / Schema

No schema changes required.
