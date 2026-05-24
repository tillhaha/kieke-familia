# Recipe Screenshot Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users upload one or more recipe screenshots in the BatchImportModal; all images are sent together to Claude vision and parsed into a single recipe.

**Architecture:** The existing `/api/meals/parse` endpoint is extended to accept `{ images: string[] }` (base64) as an alternative to `{ text }`. `BatchImportModal` gains a two-tab toggle (Text/URL | Screenshots); the screenshots tab has a drag-drop zone, thumbnails, and runs the same parse → save flow as the text tab.

**Tech Stack:** Next.js 16, React, TypeScript, Anthropic SDK (claude-opus-4-6 with vision), CSS Modules

---

## Files to touch

| File | Change |
|------|--------|
| `src/lib/i18n/index.ts` | Add new translation keys for tab labels and screenshot UI |
| `src/app/api/meals/parse/route.ts` | Accept `{ images: string[] }` alternative body; build image content blocks for Claude |
| `src/app/meals/meals.module.css` | Add CSS for tab toggle, dropzone, and thumbnail grid |
| `src/app/meals/BatchImportModal.tsx` | Add tab state, file picker, drag-drop, thumbnails, and screenshot import flow |

---

### Task 1: Add i18n strings

**Files:**
- Modify: `src/lib/i18n/index.ts`

The `Translations` type and all three locale objects (`en`, `de`, `es`) must stay in sync. Add these keys under the `meals` namespace.

- [ ] **Step 1: Add keys to the `Translations` type**

Find the `meals` block in the type definition (around line 142) and add after `batchMixedDone`:

```typescript
batchTabText: string
batchTabScreenshots: string
batchDropzoneHint: string
batchScreenshotImport: string
```

- [ ] **Step 2: Add English strings**

Find the `en` locale `meals` block (around line 447) and add:

```typescript
batchTabText: "Text / URL",
batchTabScreenshots: "Screenshots",
batchDropzoneHint: "Drop images here or click to choose",
batchScreenshotImport: "Import recipe",
```

- [ ] **Step 3: Add German strings**

Find the `de` locale `meals` block (around line 1057) and add:

```typescript
batchTabText: "Text / URL",
batchTabScreenshots: "Screenshots",
batchDropzoneHint: "Bilder hier ablegen oder klicken",
batchScreenshotImport: "Rezept importieren",
```

- [ ] **Step 4: Add Spanish strings**

Find the `es` locale `meals` block (around line 752) and add:

```typescript
batchTabText: "Texto / URL",
batchTabScreenshots: "Capturas",
batchDropzoneHint: "Suelta imágenes aquí o haz clic",
batchScreenshotImport: "Importar receta",
```

- [ ] **Step 5: Verify lint passes for changed file**

```bash
npx next lint --file src/lib/i18n/index.ts
```

Expected: no errors on this file.

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n/index.ts
git commit -m "feat: add i18n strings for screenshot import tab"
```

---

### Task 2: Extend `/api/meals/parse` for image input

**Files:**
- Modify: `src/app/api/meals/parse/route.ts`

The endpoint currently only accepts `{ text: string }`. Extend it to also accept `{ images: string[] }` where each string is a base64 data URL (`data:image/jpeg;base64,...`). When `images` is present, build a multi-image Claude message instead of a text message. The response shape is identical.

- [ ] **Step 1: Replace the body extraction and validation block**

Current code (lines 73–81):

```typescript
let body: unknown
try { body = await request.json() } catch {
  return NextResponse.json({ error: "Invalid body" }, { status: 400 })
}

const { text } = body as Record<string, unknown>
if (typeof text !== "string" || !text.trim()) {
  return NextResponse.json({ error: "text is required" }, { status: 400 })
}
```

Replace with:

```typescript
let body: unknown
try { body = await request.json() } catch {
  return NextResponse.json({ error: "Invalid body" }, { status: 400 })
}

const raw = body as Record<string, unknown>
const hasImages = Array.isArray(raw.images) && (raw.images as unknown[]).length > 0
const hasText = typeof raw.text === "string" && (raw.text as string).trim()

if (!hasImages && !hasText) {
  return NextResponse.json({ error: "text or images required" }, { status: 400 })
}
```

- [ ] **Step 2: Replace the variable setup and URL-fetch block**

Current code (lines 83–97):

```typescript
let content = text.trim()
let imageUrl: string | null = null
let source: string | null = null

if (isUrl(content)) {
  source = content
  try {
    const page = await fetchPage(content)
    content = page.text
    imageUrl = page.imageUrl
  } catch (err) {
    console.error("[parse] URL fetch failed:", err)
    return NextResponse.json({ error: "Could not fetch that URL." }, { status: 422 })
  }
}
```

Replace with:

```typescript
let imageUrl: string | null = null
let source: string | null = null

// Build the Claude message content
type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }

let messageContent: string | ContentBlock[]

if (hasImages) {
  const imageBlocks: ContentBlock[] = (raw.images as string[]).map((dataUrl) => {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    const media_type = match?.[1] ?? "image/jpeg"
    const data = match?.[2] ?? dataUrl
    return { type: "image", source: { type: "base64", media_type, data } }
  })
  imageBlocks.push({
    type: "text",
    text: "Extract the recipe from these screenshot(s). If multiple images show different parts of the same recipe (e.g. ingredients on one page, steps on another), combine them into one recipe.",
  })
  messageContent = imageBlocks
} else {
  let content = (raw.text as string).trim()
  if (isUrl(content)) {
    source = content
    try {
      const page = await fetchPage(content)
      content = page.text
      imageUrl = page.imageUrl
    } catch (err) {
      console.error("[parse] URL fetch failed:", err)
      return NextResponse.json({ error: "Could not fetch that URL." }, { status: 422 })
    }
  }
  messageContent = content
}
```

- [ ] **Step 3: Update the Claude call to use `messageContent`**

Current line (line 119):

```typescript
messages: [{ role: "user", content }],
```

Replace with:

```typescript
messages: [{ role: "user", content: messageContent }],
```

- [ ] **Step 4: Verify lint passes**

```bash
npx next lint --file src/app/api/meals/parse/route.ts
```

Expected: no errors on this file.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/meals/parse/route.ts
git commit -m "feat: extend parse API to accept base64 images for vision parsing"
```

---

### Task 3: Add CSS for screenshots tab

**Files:**
- Modify: `src/app/meals/meals.module.css`

Add after the `.batchCountLabel` block (around line 943):

- [ ] **Step 1: Add tab toggle, dropzone, and thumbnail styles**

```css
/* ── Batch modal tab toggle ─────────────────────────────── */

.batchTabs {
  display: flex;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  width: fit-content;
}

.batchTab {
  padding: 0.375rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 500;
  background: transparent;
  border: none;
  color: var(--secondary);
  cursor: pointer;
  transition: background 150ms, color 150ms;
}

.batchTab + .batchTab {
  border-left: 1px solid var(--border);
}

.batchTab:hover {
  background: var(--accent-soft);
  color: var(--foreground);
}

.batchTabActive {
  background: var(--primary);
  color: #fff;
}

.batchTabActive:hover {
  background: var(--primary);
  color: #fff;
}

/* ── Dropzone ────────────────────────────────────────────── */

.batchDropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 2px dashed var(--border);
  border-radius: 8px;
  padding: 2rem 1rem;
  cursor: pointer;
  transition: border-color 150ms, background 150ms;
  text-align: center;
  min-height: 120px;
}

.batchDropzone:hover,
.batchDropzoneDragging {
  border-color: var(--primary);
  background: var(--accent-soft);
}

.batchDropzoneHint {
  font-size: 0.8125rem;
  color: var(--secondary);
  pointer-events: none;
}

/* ── Screenshot thumbnails ───────────────────────────────── */

.batchThumbnails {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.batchThumb {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border);
  flex-shrink: 0;
}

.batchThumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.batchThumbRemove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0,0,0,0.6);
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 10px;
  line-height: 1;
}

.batchThumbRemove:hover {
  background: rgba(0,0,0,0.85);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/meals/meals.module.css
git commit -m "feat: add CSS for batch import screenshot tab"
```

---

### Task 4: Update BatchImportModal with Screenshots tab

**Files:**
- Modify: `src/app/meals/BatchImportModal.tsx`

This is the main UI change. Add a tab switcher, file picker, drag-drop handling, thumbnail display, and a screenshot import path that calls `POST /api/meals/parse` with `{ images }` and then `POST /api/meals`.

- [ ] **Step 1: Replace the full file content**

```typescript
"use client"

import { useRef, useState } from "react"
import { X } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./meals.module.css"

type Tab = "text" | "screenshots"

type ItemStatus =
  | { status: "pending" }
  | { status: "success"; name: string }
  | { status: "fail"; label: string }

type ImageEntry = { dataUrl: string; name: string }

function parseItems(text: string): string[] {
  return text
    .split(/^---\s*$/m)
    .map((c) => c.trim())
    .filter(Boolean)
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

interface Props {
  onClose: () => void
  onRefresh: () => void
}

export default function BatchImportModal({ onClose, onRefresh }: Props) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>("text")

  // text tab state
  const [text, setText] = useState("")

  // screenshots tab state
  const [images, setImages] = useState<ImageEntry[]>([])
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // shared state
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

  const addFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"))
    const entries = await Promise.all(
      imageFiles.map(async (f) => ({ dataUrl: await fileToDataUrl(f), name: f.name }))
    )
    setImages((prev) => [...prev, ...entries])
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const runTextImport = async () => {
    const batch = parseItems(text)
    if (batch.length === 0 || importing) return

    setImporting(true)
    setResults(batch.map(() => ({ status: "pending" })))
    setSummary(null)

    const headers = { "Content-Type": "application/json" }
    const finalResults: ItemStatus[] = batch.map(() => ({ status: "pending" }))

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
        finalResults[i] = { status: "fail", label }
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
        finalResults[i] = { status: "fail", label }
        setResults((prev) =>
          prev.map((r, idx) => (idx === i ? { status: "fail", label } : r))
        )
        continue
      }

      finalResults[i] = { status: "success", name: parseData.recipe.name }
      setResults((prev) =>
        prev.map((r, idx) =>
          idx === i ? { status: "success", name: parseData.recipe.name } : r
        )
      )
    }

    const failedInputs = batch.filter((_, i) => finalResults[i]?.status === "fail")
    const importedCount = batch.length - failedInputs.length

    setImporting(false)
    if (importedCount > 0) onRefresh()
    setSummary(
      failedInputs.length === 0
        ? t.meals.batchDoneAll.replace("{total}", String(batch.length))
        : t.meals.batchDoneMixed
            .replace("{imported}", String(importedCount))
            .replace("{failed}", String(failedInputs.length))
    )
    setText(failedInputs.length > 0 ? failedInputs.join("\n---\n") : "")
  }

  const runScreenshotImport = async () => {
    if (images.length === 0 || importing) return

    setImporting(true)
    setResults([{ status: "pending" }])
    setSummary(null)

    const headers = { "Content-Type": "application/json" }

    const parseRes = await fetch("/api/meals/parse", {
      method: "POST",
      headers,
      body: JSON.stringify({ images: images.map((img) => img.dataUrl) }),
    })
    const parseData = await parseRes.json().catch(() => ({}))

    if (!parseRes.ok) {
      const errMsg = parseData.error ?? parseRes.statusText
      setResults([{ status: "fail", label: errMsg }])
      setImporting(false)
      setSummary(t.meals.batchDoneMixed.replace("{imported}", "0").replace("{failed}", "1"))
      return
    }

    const saveRes = await fetch("/api/meals", {
      method: "POST",
      headers,
      body: JSON.stringify(parseData.recipe),
    })
    const saveData = await saveRes.json().catch(() => ({}))

    if (!saveRes.ok) {
      const errMsg = saveData.error ?? saveRes.statusText
      setResults([{ status: "fail", label: errMsg }])
      setImporting(false)
      setSummary(t.meals.batchDoneMixed.replace("{imported}", "0").replace("{failed}", "1"))
      return
    }

    setResults([{ status: "success", name: parseData.recipe.name }])
    setImporting(false)
    onRefresh()
    setSummary(t.meals.batchDoneAll.replace("{total}", "1"))
    setImages([])
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

        {/* Tab toggle */}
        <div className={styles.batchTabs}>
          <button
            type="button"
            className={`${styles.batchTab} ${tab === "text" ? styles.batchTabActive : ""}`}
            onClick={() => { setTab("text"); setResults([]); setSummary(null) }}
            disabled={importing}
          >
            {t.meals.batchTabText}
          </button>
          <button
            type="button"
            className={`${styles.batchTab} ${tab === "screenshots" ? styles.batchTabActive : ""}`}
            onClick={() => { setTab("screenshots"); setResults([]); setSummary(null) }}
            disabled={importing}
          >
            {t.meals.batchTabScreenshots}
          </button>
        </div>

        {/* Text / URL tab */}
        {tab === "text" && (
          <>
            <p className={styles.batchHint}>{t.meals.batchHint}</p>
            <textarea
              className={styles.batchTextarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.meals.batchPlaceholder}
              disabled={importing}
            />
          </>
        )}

        {/* Screenshots tab */}
        {tab === "screenshots" && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={handleFileInput}
            />
            <div
              className={`${styles.batchDropzone} ${dragging ? styles.batchDropzoneDragging : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <span className={styles.batchDropzoneHint}>{t.meals.batchDropzoneHint}</span>
            </div>

            {images.length > 0 && (
              <div className={styles.batchThumbnails}>
                {images.map((img, i) => (
                  <div key={i} className={styles.batchThumb}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.dataUrl} alt={img.name} />
                    <button
                      type="button"
                      className={styles.batchThumbRemove}
                      onClick={(e) => { e.stopPropagation(); removeImage(i) }}
                      disabled={importing}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Progress bar (shared) */}
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

        {/* Per-item results (shared) */}
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

        {/* Bottom row */}
        <div className={styles.batchBottomRow}>
          {tab === "text" && (
            <>
              <span className={styles.batchCountLabel}>{n > 0 ? countLabel : ""}</span>
              <button
                type="button"
                className={styles.parseBtn}
                onClick={runTextImport}
                disabled={importing || n === 0}
              >
                {t.meals.importAll}
              </button>
            </>
          )}
          {tab === "screenshots" && (
            <>
              <span className={styles.batchCountLabel}>
                {images.length > 0
                  ? `${images.length} screenshot${images.length === 1 ? "" : "s"}`
                  : ""}
              </span>
              <button
                type="button"
                className={styles.parseBtn}
                onClick={runScreenshotImport}
                disabled={importing || images.length === 0}
              >
                {t.meals.batchScreenshotImport}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify lint passes**

```bash
npx next lint --file src/app/meals/BatchImportModal.tsx
```

Expected: no errors on this file.

- [ ] **Step 3: Start dev server and manually test**

```bash
npm run dev
```

Open `http://localhost:3000/meals`. Click "Batch import". Verify:
1. Two tabs appear: "Text / URL" and "Screenshots"
2. Text/URL tab works exactly as before
3. Screenshots tab shows dropzone and file picker
4. Selecting images shows thumbnails with × remove buttons
5. "Import recipe" button is disabled when no images selected
6. Uploading a recipe screenshot imports it and shows success
7. Switching tabs clears results/summary

- [ ] **Step 4: Commit**

```bash
git add src/app/meals/BatchImportModal.tsx
git commit -m "feat: add screenshot upload tab to batch import modal"
```
