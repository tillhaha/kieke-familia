# Recipe Screenshot Import — Design Spec

**Date:** 2026-04-16
**Status:** Approved

## Summary

Add screenshot-based recipe import to the existing BatchImportModal. Users can upload one or more screenshots that are parsed together into a single recipe via Claude vision. Both text/URL import and screenshot import coexist as tabs in the same modal.

## UI Changes (`BatchImportModal.tsx`)

- Add a two-tab toggle at the top of the modal: **Text / URL** | **Screenshots**
- Text/URL tab: existing textarea flow, unchanged
- Screenshots tab:
  - Drag-and-drop zone + "Choose files" button (`accept="image/*"`, `multiple`)
  - Thumbnails of selected images, each removable with ×
  - "Import Recipe" button — all selected images are sent together as one recipe
  - Progress and result use the same single-item success/fail display as the text flow

## API Changes (`/api/meals/parse`)

Extend the request body to accept either `text` or `images` (mutually exclusive):

```typescript
// existing
{ text: string }

// new
{ images: string[] }  // base64-encoded strings, one per screenshot
```

When `images` is present:
- Build a Claude message with one `image` content block per screenshot (type `base64`, media type inferred from file or defaulted to `image/jpeg`)
- Append the same structured-extraction prompt used for text
- Return the same `ParsedRecipeSchema` shape

The modal's save step (`POST /api/meals`) is unchanged — it receives the same parsed recipe object regardless of input mode.

## Data Flow

```
User selects screenshots
  ↓
Client converts files to base64
  ↓
POST /api/meals/parse { images: string[] }
  ↓
Claude vision (multiple image blocks + prompt)
  ↓
ParsedRecipeSchema → { recipe }
  ↓
POST /api/meals { ...recipe }
  ↓
prisma.meal.create()
  ↓
Show success/fail, call onRefresh()
```

## Constraints

- No DB or Prisma schema changes
- No new API routes
- Existing text/URL import flow is untouched
- Images are converted to base64 client-side; no server-side file storage
- Single recipe output regardless of number of screenshots uploaded
