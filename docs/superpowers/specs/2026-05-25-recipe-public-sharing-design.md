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

## Security Note

Meal IDs are CUIDs. CUIDs include a time-based prefix component, meaning records created close together share a common prefix — a determined attacker who obtains one valid ID can enumerate nearby IDs. This is an accepted trade-off for a family recipe context where the content is not sensitive; it is documented here so the decision is explicit.

## Architecture

### API — `GET /api/meals/[id]`

Two changes to the GET handler only:

1. Remove the session/familyId early-exit block (lines 15–18 of the current route):
   ```ts
   // DELETE these lines:
   const session = await getServerSession(authOptions)
   if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
   const familyId = (session.user as any).familyId as string | undefined
   if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
   ```

2. Replace the `getAuthedMeal(id, familyId)` call with an auth-free lookup:
   ```ts
   // BEFORE:
   const meal = await getAuthedMeal(id, familyId)
   // AFTER:
   const meal = await prisma.meal.findFirst({ where: { id } })
   ```

The `getAuthedMeal` helper function itself is **not changed** — it continues to be used by PATCH and DELETE unchanged.

The GET response already serialises `familyId` (Prisma returns all columns; no `select` whitelist exists).

**Endpoints that require no changes** (already server-side auth-gated):
- `POST /api/meals/[id]/image`
- `DELETE /api/meals/[id]/image`
- `POST /api/meals/reformat-steps`

Note on `reformat-steps`: the server guards by session only (not meal ownership). A cross-family authenticated user who crafts a direct HTTP request could trigger a paid Anthropic API call. The frontend hides the button for non-owners which is sufficient mitigation; server-side meal-ownership gating is out of scope for this feature.

### Page — `/meals/[id]/page.tsx`

#### Session hook

Add `useSession` (not currently used in this component):
```ts
import { useSession } from "next-auth/react"
// inside component:
const { data: session, status } = useSession()
```

#### Ownership flag

```ts
const isOwner = status === "authenticated" && session?.user?.familyId === meal?.familyId
```

`isOwner` is `false` in all three non-owner cases:
- `status === "loading"` — session not yet hydrated
- `status === "unauthenticated"` — anonymous visitor
- `status === "authenticated"` but `familyId` does not match — logged-in user from a different family

The existing `if (loading) return null` gate (line 238) already holds the render until the meal fetch resolves. Once the meal is available and the component renders, `status` may still be `"loading"` — in that case `isOwner` is false, so the read-only view is shown initially, then the owner view appears once session hydrates. This flash is acceptable since the content is public.

#### Frontend `Meal` type

Add `familyId: string` to the local `Meal` type alias (lines 15–29). The PATCH endpoint already includes `familyId` in its response (Prisma returns all columns), so `setMeal(data.meal)` in `patch()` will preserve `familyId` through edits without further changes.

#### `confirmDelete` reset

Add a `useEffect` to clear stale delete-confirmation state:
```ts
useEffect(() => {
  if (!isOwner) setConfirmDelete(false)
}, [isOwner])
```

#### Element gating — owner vs non-owner

| Element | Owner | Non-owner |
|---|---|---|
| Recipe name (`detailHeader`) | `<input>` (existing) | `<h1>` with `name` value |
| Servings | `<input type="number">` (existing) | Static text |
| Favorite star button | Interactive (existing) | Hidden (`null`) |
| Delete / confirm-delete button | Visible (existing) | Hidden (`null`) |
| Meal type `<select>` | Interactive (existing) | Static text badge |
| Diet `<select>` | Interactive (existing) | Static text badge |
| Office-friendly / 30-min checkboxes | Interactive (existing) | `disabled` attribute added |
| Image: `<imageActions>` overlay (change/remove buttons) | Visible (existing) | Hidden (`null`) |
| Image: placeholder `<div>` (no image) | `onClick` → file input (existing) | Render without `onClick` — non-interactive |
| Hidden `<input type="file">` (line 273) | Rendered (existing) | Keep rendered — harmless, invisible |
| Source `<div className={editableField}>` | `onClick` → `setEditingField("source")` (existing) | Render same read-only branch (link or text) but without `onClick` |
| Notes `<div className={editableField}>` | `onClick` → `setEditingField("notes")` (existing) | Render same read-only markdown branch but without `onClick` |
| Ingredients `<div className={editableField}>` | `onClick` → `setEditingField("ingredients")` (existing) | Render same read-only list branch but without `onClick` |
| Steps `<div className={editableField}>` | `onClick` → `setEditingField("steps")` (existing) | Render same read-only markdown branch but without `onClick` |
| Wand (reformat) button | `isOwner && meal.steps.length > 0` | Not shown (existing step-count guard preserved; wrap in `isOwner &&`) |

**Click handler suppression:** The editable field `<div>` elements and the image placeholder all use `onClick` to enter edit/upload mode. For non-owners, the same display branch is rendered but `onClick` is omitted entirely — the element should not be silently interactive.

**Source field non-owner rendering:** Render the existing non-edit branch (`isUrl(draftSource)` → link, else plain text, else empty prompt) directly, without the outer `onClick`.

## Data Flow

1. Visitor navigates to `/meals/[id]`
2. Page fetches `GET /api/meals/[id]` (no auth required)
3. API returns full meal including `familyId`
4. While `loading === true`, page renders `null` (existing behaviour)
5. Once meal resolves, page renders; `isOwner = (status === "authenticated" && session?.user?.familyId === meal.familyId)`
6. While `status === "loading"`, `isOwner` is `false` → read-only view
7. Once session resolves, `isOwner` is recomputed; owner view shown only if familyId matches

## Error Handling

- Invalid/unknown meal ID → `setNotFound(true)` on non-200 (unchanged)
- Distinguishing 404 from 500 on GET is out of scope; both show "not found" as before
- Unauthenticated or cross-family user → read-only view, no redirect, no error

## Migration / Schema

No schema or DB changes required.
