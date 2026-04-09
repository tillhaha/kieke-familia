# Batch Recipe Import — Design Spec

**Date:** 2026-04-09  
**Status:** Approved

## Overview

Add a "Batch import" button to the `/meals` page that opens a modal where the user can paste multiple URLs or full recipe texts and import them all in one go. No new API routes are needed — the feature reuses the existing `/api/meals/parse` and `/api/meals` POST endpoints.

`/api/meals/parse` accepts `{ text }` where `text` is either a URL string or raw recipe text. The server detects URLs via its own `isUrl()` check and fetches the page server-side. The client sends `{ text: item }` for every item regardless of type — no client-side HTTP fetching.

## Input format

The client-side parsing logic determines how many items are in the textarea and what each item's text is:
1. Split the full textarea value on lines that match `/^---\s*$/m`.
2. Each chunk is trimmed. Empty chunks are discarded.
3. A chunk is classified as a URL (for display purposes only) if it is a single non-empty line and `new URL(chunk.trim())` succeeds with protocol `http:` or `https:`. A single-line non-URL chunk is a valid recipe text block. Classification affects only the count label — all items are sent as `{ text: item }` to `/api/meals/parse`.
4. Item count updates live on `onChange`.

## UI

### Button placement

A "Batch import" button is added to the `/meals` page header, next to the existing "New recipe" link. Secondary/ghost style.

### Modal — two states

The modal is either **idle** or **importing**. It uses the same CSS classes as the existing modal in `/meals/new`: `modalBackdrop`, `modal`, `modalHeader`, `modalTitle`, `modalCloseBtn`.

**Fixed layout (top to bottom):**
1. `modalHeader`: title + `✕` close button
2. Format hint — `t.meals.batchHint`
3. `<textarea>` — resizable, monospace, placeholder from `t.meals.batchPlaceholder`
4. Progress bar + label *(only visible during importing state)*
5. Results section *(hidden until at least one item has been processed; persists until modal closes or new run starts)*
6. Summary line *(hidden until the current run finishes; persists until modal closes or new run starts)*
7. Bottom row: item count label (left) + "Import all" button (right)

### Idle state

- `const [importing, setImporting] = useState(false)` — `false` in idle
- Textarea: enabled
- Item count label: `n === 1 ? t.meals.batchItemDetected : t.meals.batchItemsDetected.replace('{n}', String(n))`
- "Import all": enabled when `n > 0`, disabled when `n === 0`
- `✕` + backdrop: close modal and reset all state (`importing`, textarea, results, summary, item statuses)

### Importing state (`importing === true`)

- `setImporting(true)` before the loop starts
- Textarea: `disabled`
- "Import all": `disabled`
- `✕` `onClick`: `if (importing) return` — no-op. Do **not** set `disabled` on the button element.
- Backdrop `onClick`: `if (importing) return` — no-op. Do not remove the handler.
- **Progress bar** (layout position 4): thin bar, fill color `#6366f1`. Derive completed count from the `results` array — `const completedCount = results.filter(r => r.status !== 'pending').length` — so the bar and the status list are always consistent. Width = `(completedCount / results.length) * 100%`. Label above the bar from `t.meals.batchImporting` with `{current}` = `completedCount` and `{total}` = `results.length` replaced inline. Shows `"0 / n"` before the first item finishes.
- **Per-item status rows** (layout position 5), in input order:
  - ⋯ grey — not yet started and currently processing (all items begin in this state; the currently-processing item stays ⋯ until both API calls complete)
  - ✓ green — saved (shows parsed `recipe.name` from `/parse` response)
  - ✗ red — failed: first 60 chars of the raw input string, then ` — `, then `data.error` from the JSON response (applies equally to `/parse` and `/api/meals` failures). If the response body is not valid JSON or lacks `error`, fall back to `response.statusText`.

### After the loop finishes (returns to idle)

1. `setImporting(false)`.
2. Textarea and "Import all" re-enabled.
3. Progress bar hidden.
4. Results section remains visible.
5. Summary line (layout position 6) appears:
   - `failedCount === 0`: `t.meals.batchDoneAll` with `{total}` = total items in this run
   - `failedCount > 0`: `t.meals.batchDoneMixed` with `{imported}` = success count, `{failed}` = failed count
6. Textarea repopulated: if failures exist, replace textarea content with failed inputs joined by `\n---\n` (no leading or trailing `---`) and item count updates. If all succeeded, clear the textarea.

When the user clicks "Import all" again, clear results section and summary before starting the new loop. The `{total}` in the new run's summary counts only items in the new run.

## Import logic (client-side)

`/api/meals/parse` returns `{ recipe: { name, mealType, diet, servings, officeFriendly, thirtyMinute, ingredients, steps, notes, imageUrl, source } }` on success.

`items` is always derived fresh from the current textarea value at the moment "Import all" is clicked — it is not captured earlier.

Use functional state updaters throughout to avoid stale-closure bugs.

```
const headers = { 'Content-Type': 'application/json' }

// Pre-loop setup (items derived from textarea at click time)
setImporting(true)
setResults(items.map(() => ({ status: 'pending' })))  // all ⋯
setSummary(null)

// Loop
for (let i = 0; i < items.length; i++) {
  const parseRes = await fetch('/api/meals/parse', { method: 'POST', headers, body: JSON.stringify({ text: items[i] }) })
  const parseData = await parseRes.json().catch(() => ({}))
  if (!parseRes.ok) {
    markFailed(i, items[i], parseData.error ?? parseRes.statusText)
    continue
  }

  const saveRes = await fetch('/api/meals', { method: 'POST', headers, body: JSON.stringify(parseData.recipe) })
  const saveData = await saveRes.json().catch(() => ({}))
  if (!saveRes.ok) {
    markFailed(i, items[i], saveData.error ?? saveRes.statusText)
    continue
  }

  markSuccess(i, parseData.recipe.name)
}

// Post-loop
setImporting(false)
// compute and set summary, repopulate textarea
```

`markFailed(index, rawInput, errorString)` builds the display label internally: `rawInput.slice(0, 60) + ' — ' + errorString`, then calls `setResults(prev => ...)`.

`markSuccess(index, name)` calls `setResults(prev => ...)` with status `'success'` and the recipe name.

Progress count is derived from `results` (not a separate counter), so bar and status list are always in sync.

## i18n

New keys for the `meals` section in `src/lib/i18n/index.ts` — type definition and all three locale objects (`en`, `de`, `es`):

| Key | EN value |
|-----|----------|
| `meals.batchImport` | `"Batch import"` |
| `meals.batchHint` | `"One URL per line, or separate recipe texts with ---"` |
| `meals.batchPlaceholder` | `"https://example.com/pasta\nhttps://example.com/soup\n---\nBanana Bread\n\nIngredients:\n3 ripe bananas…"` |
| `meals.batchItemDetected` | `"1 item detected"` |
| `meals.batchItemsDetected` | `"{n} items detected"` |
| `meals.importAll` | `"Import all"` |
| `meals.batchImporting` | `"Importing… {current} / {total}"` |
| `meals.batchDoneAll` | `"All {total} imported"` |
| `meals.batchDoneMixed` | `"{imported} imported, {failed} failed"` |

`meals.importing` already exists and is not reused here.

## Files to touch

| File | Change |
|------|--------|
| `src/app/meals/page.tsx` | Add "Batch import" button; inline `BatchImportModal` component or extract to `BatchImportModal.tsx` in same folder |
| `src/app/meals/meals.module.css` | Reuse existing modal CSS; add `.batchProgress`, `.batchBar`, `.batchBarFill`, `.batchStatusList`, `.batchStatusItem`, `.batchSummary` |
| `src/lib/i18n/index.ts` | Add new keys to type definition and all three locale objects |

## Out of scope

- Duplicate detection — duplicates are allowed.
- Image upload — `imageUrl` from `og:image` is stored if present, same as single import.
- Editing parsed results before save — no review step by design.
