# Batch Recipe Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Batch import" button to `/meals` that opens a modal where users paste multiple URLs or recipe texts and imports them all sequentially via the existing `/api/meals/parse` + `/api/meals` endpoints.

**Architecture:** `BatchImportModal` is a self-contained client component in its own file. `MealsPage` (`page.tsx`) holds the open/close state and passes a refresh callback. The modal manages all import state internally.

**Tech Stack:** Next.js 16, React `useState`, CSS Modules (`meals.module.css`), existing `/api/meals/parse` + `/api/meals` endpoints, i18n via `src/lib/i18n/index.ts`.

**Spec:** `docs/superpowers/specs/2026-04-09-batch-import-recipes-design.md`

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `src/lib/i18n/index.ts` | Modify | Add 9 new keys to type definition + all 3 locale objects |
| `src/app/meals/meals.module.css` | Modify | Add `.pageHeaderActions`, `.batchBtn`, `.batchHint`, `.batchTextarea`, `.batchProgressSection`, `.batchProgressLabel`, `.batchBar`, `.batchBarFill`, `.batchStatusList`, `.batchStatusItem`, `.batchStatusPending`, `.batchStatusSuccess`, `.batchStatusFail`, `.batchSummary`, `.batchBottomRow`, `.batchCountLabel` |
| `src/app/meals/BatchImportModal.tsx` | Create | New client component — modal UI + import loop |
| `src/app/meals/page.tsx` | Modify | Add `batchOpen` state, "Batch import" button, pass refresh callback |

---

## Task 1: Add i18n keys

**Files:**
- Modify: `src/lib/i18n/index.ts`

The file has three sections: TypeScript type definition (around line 92), EN locale object (around line 388), ES locale (around line 684), DE locale (around line 980). Each `meals` block must get the same 9 new keys.

- [ ] **Step 1: Add keys to the type definition**

In the `meals: { ... }` type block (ends around line 141), add after `stepsEmptyPrompt: string`:

```
    batchImport: string
    batchHint: string
    batchPlaceholder: string
    batchItemDetected: string
    batchItemsDetected: string
    importAll: string
    batchImporting: string
    batchDoneAll: string
    batchDoneMixed: string
```

- [ ] **Step 2: Add keys to the EN locale**

In the EN `meals` object (around line 388), add after `stepsEmptyPrompt: "Click to add steps…",`:

```
    batchImport: "Batch import",
    batchHint: "One URL per line, or separate recipe texts with ---",
    batchPlaceholder: "https://example.com/pasta\nhttps://example.com/soup\n---\nBanana Bread\n\nIngredients:\n3 ripe bananas…",
    batchItemDetected: "1 item detected",
    batchItemsDetected: "{n} items detected",
    importAll: "Import all",
    batchImporting: "Importing… {current} / {total}",
    batchDoneAll: "All {total} imported",
    batchDoneMixed: "{imported} imported, {failed} failed",
```

- [ ] **Step 3: Add keys to the ES locale**

In the ES `meals` object (around line 684), add after `stepsEmptyPrompt: "Haz clic para añadir pasos…",`:

```
    batchImport: "Importación masiva",
    batchHint: "Una URL por línea, o separa recetas completas con ---",
    batchPlaceholder: "https://example.com/pasta\nhttps://example.com/sopa\n---\nPan de plátano\n\nIngredientes:\n3 plátanos maduros…",
    batchItemDetected: "1 elemento detectado",
    batchItemsDetected: "{n} elementos detectados",
    importAll: "Importar todo",
    batchImporting: "Importando… {current} / {total}",
    batchDoneAll: "{total} importados",
    batchDoneMixed: "{imported} importados, {failed} fallidos",
```

- [ ] **Step 4: Add keys to the DE locale**

In the DE `meals` object (around line 980), add after `stepsEmptyPrompt: "Klicken um Schritte hinzuzufügen…",`:

```
    batchImport: "Stapelimport",
    batchHint: "Eine URL pro Zeile oder Rezepte mit --- trennen",
    batchPlaceholder: "https://example.com/pasta\nhttps://example.com/suppe\n---\nBananenbrot\n\nZutaten:\n3 reife Bananen…",
    batchItemDetected: "1 Element erkannt",
    batchItemsDetected: "{n} Elemente erkannt",
    importAll: "Alle importieren",
    batchImporting: "Importiere… {current} / {total}",
    batchDoneAll: "Alle {total} importiert",
    batchDoneMixed: "{imported} importiert, {failed} fehlgeschlagen",
```

- [ ] **Step 5: Verify no TypeScript errors**

```bash
npm run build 2>&1 | head -40
```

Expected: build succeeds or shows only pre-existing errors unrelated to i18n.

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n/index.ts
git commit -m "feat: add batch import i18n keys (en/es/de)"
```

---

## Task 2: Add CSS

**Files:**
- Modify: `src/app/meals/meals.module.css`

All new classes go before the `/* ── Mobile ──` comment (the final `@media (max-width: 768px)` block at the bottom of the file). The modal structure reuses existing `.modalBackdrop`, `.modal`, `.modalHeader`, `.modalTitle`, `.modalCloseBtn` — no changes to those.

- [ ] **Step 1: Add the new CSS classes**

Insert before the `/* ── Mobile ──` comment:

```css
/* ── Page header actions (wraps New Recipe + Batch import) ── */

.pageHeaderActions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* ── Batch import button (ghost/secondary) ─────────────── */

.batchBtn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.45rem 0.875rem;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--foreground);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 150ms, background-color 150ms;
  white-space: nowrap;
}

.batchBtn:hover {
  border-color: var(--primary);
  background: var(--accent-soft);
}

/* ── Batch modal internals ──────────────────────────────── */

.batchHint {
  font-size: 0.8125rem;
  color: var(--secondary);
  margin: 0;
}

.batchTextarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--foreground);
  font-size: 0.8125rem;
  font-family: monospace;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  min-height: 160px;
  transition: border-color 150ms;
}

.batchTextarea:focus { border-color: var(--primary); }
.batchTextarea::placeholder { color: var(--secondary); opacity: 0.5; }

/* ── Progress section ───────────────────────────────────── */

.batchProgressSection {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.batchProgressLabel {
  font-size: 0.8125rem;
  color: var(--secondary);
}

.batchBar {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.batchBarFill {
  height: 100%;
  background: #6366f1;
  border-radius: 2px;
  transition: width 200ms ease;
}

/* ── Per-item status list ───────────────────────────────── */

.batchStatusList {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 200px;
  overflow-y: auto;
}

.batchStatusItem {
  font-size: 0.8125rem;
  line-height: 1.4;
  word-break: break-all;
}

.batchStatusPending { color: var(--secondary); }
.batchStatusSuccess { color: #4ade80; }
.batchStatusFail    { color: #f87171; }

/* ── Summary line ───────────────────────────────────────── */

.batchSummary {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--foreground);
}

/* ── Bottom row (count + button) ────────────────────────── */

.batchBottomRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.batchCountLabel {
  font-size: 0.8125rem;
  color: var(--secondary);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/meals/meals.module.css
git commit -m "feat: add batch import CSS classes"
```

---

## Task 3: BatchImportModal component

**Files:**
- Create: `src/app/meals/BatchImportModal.tsx`

- [ ] **Step 1: Create the component file with the following exact content**

```tsx
// src/app/meals/BatchImportModal.tsx
"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./meals.module.css"

type ItemStatus =
  | { status: "pending" }
  | { status: "success"; name: string }
  | { status: "fail"; label: string }

function parseItems(text: string): string[] {
  return text
    .split(/^---\s*$/m)
    .map((c) => c.trim())
    .filter(Boolean)
}

interface Props {
  onClose: () => void
  onRefresh: () => void
}

export default function BatchImportModal({ onClose, onRefresh }: Props) {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ItemStatus[]>([])
  const [summary, setSummary] = useState<string | null>(null)

  const items = parseItems(text)
  const n = items.length

  const countLabel =
    n === 1
      ? t.meals.batchItemDetected
      : t.meals.batchItemsDetected.replace("{n}", String(n))

  const completedCount = results.filter((r) => r.status !== "pending").length
  const totalCount = results.length

  const handleClose = () => {
    if (importing) return
    onClose()
  }

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return
    handleClose()
  }

  const runImport = async () => {
    const batch = parseItems(text)
    if (batch.length === 0 || importing) return

    setImporting(true)
    setResults(batch.map(() => ({ status: "pending" })))
    setSummary(null)

    const headers = { "Content-Type": "application/json" }

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i]

      const parseRes = await fetch("/api/meals/parse", {
        method: "POST",
        headers,
        body: JSON.stringify({ text: item }),
      })
      const parseData = await parseRes.json().catch(() => ({}))

      if (!parseRes.ok) {
        const errMsg = parseData.error ?? parseRes.statusText
        const label = item.slice(0, 60) + " — " + errMsg
        setResults((prev) =>
          prev.map((r, idx) => (idx === i ? { status: "fail", label } : r))
        )
        continue
      }

      const saveRes = await fetch("/api/meals", {
        method: "POST",
        headers,
        body: JSON.stringify(parseData.recipe),
      })
      const saveData = await saveRes.json().catch(() => ({}))

      if (!saveRes.ok) {
        const errMsg = saveData.error ?? saveRes.statusText
        const label = item.slice(0, 60) + " — " + errMsg
        setResults((prev) =>
          prev.map((r, idx) => (idx === i ? { status: "fail", label } : r))
        )
        continue
      }

      setResults((prev) =>
        prev.map((r, idx) =>
          idx === i ? { status: "success", name: parseData.recipe.name } : r
        )
      )
    }

    setImporting(false)

    // Read final results snapshot to compute summary and repopulate textarea
    setResults((finalResults) => {
      const failedInputs = batch.filter((_, i) => finalResults[i]?.status === "fail")
      const importedCount = batch.length - failedInputs.length

      if (importedCount > 0) onRefresh()

      const newSummary =
        failedInputs.length === 0
          ? t.meals.batchDoneAll.replace("{total}", String(batch.length))
          : t.meals.batchDoneMixed
              .replace("{imported}", String(importedCount))
              .replace("{failed}", String(failedInputs.length))

      setSummary(newSummary)
      setText(failedInputs.length > 0 ? failedInputs.join("\n---\n") : "")

      return finalResults
    })
  }

  const statusText = (r: ItemStatus) => {
    if (r.status === "pending") return "⋯"
    if (r.status === "success") return `✓ ${r.name}`
    return `✗ ${r.label}`
  }

  const statusClass = (r: ItemStatus) => {
    if (r.status === "pending") return styles.batchStatusPending
    if (r.status === "success") return styles.batchStatusSuccess
    return styles.batchStatusFail
  }

  return (
    <div className={styles.modalBackdrop} onClick={handleBackdrop}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{t.meals.batchImport}</span>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={handleClose}
          >
            <X size={16} />
          </button>
        </div>

        <p className={styles.batchHint}>{t.meals.batchHint}</p>

        <textarea
          className={styles.batchTextarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.meals.batchPlaceholder}
          disabled={importing}
        />

        {importing && totalCount > 0 && (
          <div className={styles.batchProgressSection}>
            <span className={styles.batchProgressLabel}>
              {t.meals.batchImporting
                .replace("{current}", String(completedCount))
                .replace("{total}", String(totalCount))}
            </span>
            <div className={styles.batchBar}>
              <div
                className={styles.batchBarFill}
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className={styles.batchStatusList}>
            {results.map((r, i) => (
              <div key={i} className={`${styles.batchStatusItem} ${statusClass(r)}`}>
                {statusText(r)}
              </div>
            ))}
          </div>
        )}

        {summary && <p className={styles.batchSummary}>{summary}</p>}

        <div className={styles.batchBottomRow}>
          <span className={styles.batchCountLabel}>{n > 0 ? countLabel : ""}</span>
          <button
            type="button"
            className={styles.parseBtn}
            onClick={runImport}
            disabled={importing || n === 0}
          >
            {t.meals.importAll}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep -E "BatchImport|error TS" | head -20
```

Expected: no errors referencing `BatchImportModal`.

- [ ] **Step 3: Commit**

```bash
git add src/app/meals/BatchImportModal.tsx
git commit -m "feat: add BatchImportModal component"
```

---

## Task 4: Wire modal into the meals page

**Files:**
- Modify: `src/app/meals/page.tsx`

- [ ] **Step 1: Add the import and open state**

At the top of `page.tsx`, add the import after the existing imports:

```tsx
import BatchImportModal from "./BatchImportModal"
```

Inside `MealsPage`, add state after the existing state declarations:

```tsx
const [batchOpen, setBatchOpen] = useState(false)
```

- [ ] **Step 2: Replace the pageHeader with the two-button layout**

Find this block in the JSX (around line 75):

```tsx
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t.meals.title}</h1>
        <Link href="/meals/new" className={styles.newBtn}>
          <Plus size={14} strokeWidth={2.5} />
          {t.meals.newRecipe}
        </Link>
      </div>
```

Replace with:

```tsx
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t.meals.title}</h1>
        <div className={styles.pageHeaderActions}>
          <button
            type="button"
            className={styles.batchBtn}
            onClick={() => setBatchOpen(true)}
          >
            {t.meals.batchImport}
          </button>
          <Link href="/meals/new" className={styles.newBtn}>
            <Plus size={14} strokeWidth={2.5} />
            {t.meals.newRecipe}
          </Link>
        </div>
      </div>
```

- [ ] **Step 3: Render the modal at the bottom of the JSX**

Just before the closing `</div>` of the outer container (line 161 of `page.tsx`), add:

```tsx
      {batchOpen && (
        <BatchImportModal
          onClose={() => setBatchOpen(false)}
          onRefresh={() => {
            setLoading(true)
            fetchMeals(query).finally(() => setLoading(false))
          }}
        />
      )}
```

- [ ] **Step 4: Verify the build**

```bash
npm run build 2>&1 | grep -E "error TS|Error:" | grep -v "node_modules" | head -20
```

Expected: no new TypeScript errors.

- [ ] **Step 5: Smoke-test manually**

```bash
npm run dev
```

1. Navigate to `/meals`
2. Click "Batch import" — modal opens
3. Paste a recipe URL into the textarea — item count shows "1 item detected"
4. Paste a second URL on a new line — count shows "2 items detected"
5. Click "Import all" — progress bar appears, items resolve to ✓ or ✗
6. After completion, verify recipe list refreshes automatically
7. Open modal again, paste a guaranteed-failing URL (e.g. `https://localhost/fake`) — verify ✗ error row and textarea repopulated with that URL after import
8. During import, click ✕ — verify nothing happens (no-op)
9. During import, click backdrop — verify nothing happens (no-op)
10. Verify German and Spanish locales show correct translations for batch-related strings

- [ ] **Step 6: Commit**

```bash
git add src/app/meals/page.tsx
git commit -m "feat: add batch import button and modal to meals page"
```
