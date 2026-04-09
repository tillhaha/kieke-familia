# Batch Recipe Import — Design Spec

**Date:** 2026-04-09  
**Status:** Approved

## Overview

Add a "Batch import" button to the `/meals` page that opens a modal where the user can paste multiple URLs or full recipe texts and import them all in one go. No new API routes are needed — the feature reuses the existing `/api/meals/parse` and `/api/meals` POST endpoints.

## Input format

The textarea accepts two modes, and they can be mixed in one paste:

- **URL-only lines:** Any line that is a valid `http`/`https` URL is treated as a URL to fetch and parse.
- **Full recipe text blocks:** Blocks of arbitrary text separated by a line containing only `---`.

Parsing logic:
1. Split the full textarea value on lines that match `/^---\s*$/m`.
2. Each chunk is trimmed. Empty chunks are discarded.
3. A chunk is a URL if it is a single non-empty line and passes the `isUrl()` check (already in `/api/meals/parse`). Otherwise it is raw recipe text.
4. The detected item count is shown below the textarea and updates live as the user types.

## UI

### Button placement

A "Batch import" button is added to the `/meals` page header, next to the existing "New recipe" link. It has a secondary/ghost style to keep "New recipe" as the primary action.

### Modal

The modal matches the existing modal pattern from `/meals/new` (same CSS classes: `modalBackdrop`, `modal`, `modalHeader`, `modalTitle`, `modalCloseBtn`).

Contents:
- Format hint: one URL per line, or separate recipe texts with `---`
- `<textarea>` — resizable, monospace, placeholder shows both formats
- Item count label (e.g. "3 items detected"), updates on `onChange`
- "Import all" button — disabled when textarea is empty or import is in progress

### Progress state (shown after clicking "Import all")

- Small progress section replaces the item count row:
  - Label: "Importing… X / N"
  - Thin progress bar (indigo, matches app accent)
  - Per-item status list:
    - ✓ green — successfully imported (shows parsed recipe name)
    - ⋯ grey — in progress
    - ✗ red — failed (shows original URL or first line of text + short error)
- Textarea and "Import all" button are disabled during import.

### Completion state

- Progress section remains visible showing the final status list.
- Summary line: "X imported, Y failed" (or "All X imported" if no failures).
- If any items failed, they are re-populated into the textarea (URLs or `---`-joined text blocks) so the user can retry just the failures.
- A "Done" / "Close" button appears; clicking it closes the modal.

## Import logic (client-side)

Items are processed **sequentially** (not in parallel) to avoid hammering the Claude API and to keep progress feedback accurate.

For each item:
1. `POST /api/meals/parse` with `{ text: item }` — item is the URL or raw text block.
2. On success, `POST /api/meals` with the returned `recipe` fields.
3. Update per-item status after each step.
4. On any failure, record the error message and mark the item failed; continue to the next item.

## i18n

New translation keys needed in all three locales (`en`, `de`, `es`) in `src/lib/i18n/`:

```
meals.batchImport           — "Batch import"
meals.batchHint             — "One URL per line, or separate recipe texts with ---"
meals.batchPlaceholder      — placeholder text showing both formats
meals.batchItemsDetected    — "{n} items detected"  (or "1 item detected")
meals.importAll             — "Import all"
meals.importing             — "Importing…"
meals.batchDone             — "{imported} imported, {failed} failed"  (or "All {imported} imported")
meals.batchRetry            — failed items re-populated; existing "Import" / close labels reused
```

## Files to touch

| File | Change |
|------|--------|
| `src/app/meals/page.tsx` | Add "Batch import" button + `BatchImportModal` component (or inline the modal) |
| `src/app/meals/meals.module.css` | Reuse existing modal CSS; add `.batchProgress`, `.batchStatusList`, `.batchStatusItem` |
| `src/lib/i18n/en.ts` (and `de.ts`, `es.ts`) | Add translation keys listed above |

The modal can be a local component defined in `page.tsx` or extracted to `BatchImportModal.tsx` in the same folder — either is fine given the existing pattern.

## Out of scope

- Duplicate detection (same recipe name already exists) — not checked; duplicates are allowed.
- Image upload for batch-imported recipes — `imageUrl` from `og:image` is stored if present, same as single import.
- Editing parsed results before save — no review step (by design; user picked option A).
