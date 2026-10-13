# Meal Notes Hyperlinks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users insert and auto-shorten hyperlinks in the meal recipe notes field, matching the Cmd+K / paste-wrap / auto-shorten behavior `WeekBlock.tsx` already has for day notes.

**Architecture:** Port three existing WeekBlock mechanisms (link-insert prompt, paste auto-wrap, render-time auto-shortening) into `src/app/meals/[id]/page.tsx`'s notes field, which only needs single-field state (no per-cell key map). Links render via a custom `ReactMarkdown` `a` component that opens in a new tab.

**Tech Stack:** Next.js 16, React, `react-markdown` + `remark-breaks` (already in use on this page), CSS Modules.

## Global Constraints

- No test suite exists in this repo — verification is manual via the dev server (per `CLAUDE.md`).
- Scope is the notes field only; do not touch ingredients, steps, or source fields.
- Do not modify `WeekBlock.tsx`'s existing hyperlink behavior.
- `Link` is already imported from `next/link` in this file — the lucide-react icon must be imported under an alias.
- Link labels are always plain hostname text (no favicon/preview metadata), matching WeekBlock.

Spec: `docs/superpowers/specs/2026-10-13-meal-notes-hyperlinks-design.md`

---

### Task 1: Link-insert prompt (Cmd/Ctrl+K) + paste auto-wrap

**Files:**
- Modify: `src/app/meals/[id]/page.tsx`
- Modify: `src/app/meals/meals.module.css`

**Interfaces:**
- Produces: `linkPrompt` state (`NotesLinkPrompt | null`), `linkUrl` state (`string`), `insertLink(url: string)`, `dismissLinkPrompt()`, `handleNotesKeyDown(e)`, `handleNotesPaste(e)`, `notesTextareaRef`, `linkUrlInputRef`. Task 2 consumes none of these directly (it only touches the read-view render path) but must not collide with these names.

- [ ] **Step 1: Add the CSS classes for the link prompt bar and inline links**

In `src/app/meals/meals.module.css`, insert immediately before the `/* ── Mobile ──... */` comment (currently at line 1395, right after the `.batchThumbRemove:hover` block):

```css
/* ── Link prompt bar ─────────────────────────────────── */

.inlineLink {
  color: var(--primary);
  text-decoration: none;
  font-size: inherit;
}

.inlineLink:hover {
  text-decoration: underline;
}

.linkPromptBar {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.5rem;
  border-top: 1px solid var(--border);
  background: var(--surface);
}

.linkPromptIcon {
  flex-shrink: 0;
  color: var(--secondary);
}

.linkPromptInput {
  flex: 1;
  min-width: 0;
  padding: 0.2rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--background);
  color: var(--foreground);
  font-size: 0.6875rem;
  font-family: inherit;
  outline: none;
}

.linkPromptInput:focus {
  border-color: var(--primary);
}

.linkPromptSubmit {
  flex-shrink: 0;
  padding: 0.2rem 0.5rem;
  border: none;
  border-radius: 4px;
  background: var(--primary);
  color: #fff;
  font-size: 0.6875rem;
  font-family: inherit;
  cursor: pointer;
  line-height: 1.4;
}

.linkPromptSubmit:hover {
  opacity: 0.85;
}
```

- [ ] **Step 2: Alias the lucide-react `Link` icon import**

In `src/app/meals/[id]/page.tsx`, line 10, change:

```ts
import { ChevronLeft, ImagePlus, Pencil, Star, Trash2, Wand2 } from "lucide-react"
```

to:

```ts
import { ChevronLeft, ImagePlus, Link as LinkIcon, Pencil, Star, Trash2, Wand2 } from "lucide-react"
```

- [ ] **Step 3: Add link-prompt state and refs**

In `src/app/meals/[id]/page.tsx`, after line 71 (`const fileInputRef = useRef<HTMLInputElement>(null)`), add:

```ts
  type NotesLinkPrompt = { selStart: number; selEnd: number; selText: string; baseText: string }
  const [linkPrompt, setLinkPrompt] = useState<NotesLinkPrompt | null>(null)
  const [linkUrl, setLinkUrl] = useState("")
  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const linkUrlInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (linkPrompt) setTimeout(() => linkUrlInputRef.current?.focus(), 0)
  }, [linkPrompt])
```

Note: `NotesLinkPrompt` is declared as a local type alias inside the component for colocation with the state it describes — move it above the component (next to the other `type` declarations at the top of the file, e.g. near `EditingField`) if preferred, but inline is fine since nothing outside this component uses it.

- [ ] **Step 4: Add `insertLink`, `dismissLinkPrompt`, `handleNotesKeyDown`, `handleNotesPaste`**

Add these after `handleNotesBlur` (which ends around line 166 with its closing `}`):

```ts
  const insertLink = (url: string) => {
    if (!linkPrompt) return
    const { selStart, selEnd, selText, baseText } = linkPrompt
    const label = selText || (() => { try { return new URL(url).hostname.replace(/^www\./, "") } catch { return url } })()
    const mdLink = `[${label}](${url})`
    const newText = baseText.slice(0, selStart) + mdLink + baseText.slice(selEnd)
    setDraftNotes(newText)
    setLinkPrompt(null)
    setLinkUrl("")
    setTimeout(() => {
      const ta = notesTextareaRef.current
      if (ta) { ta.focus(); const pos = selStart + mdLink.length; ta.setSelectionRange(pos, pos); autoResize(ta) }
    }, 0)
  }

  const dismissLinkPrompt = () => {
    setLinkPrompt(null)
    setLinkUrl("")
    handleNotesBlur()
  }

  const handleNotesKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault()
      const ta = e.currentTarget
      setLinkPrompt({
        selStart: ta.selectionStart,
        selEnd: ta.selectionEnd,
        selText: ta.value.slice(ta.selectionStart, ta.selectionEnd),
        baseText: ta.value,
      })
      setLinkUrl("")
    }
  }

  const handleNotesPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text").trim()
    if (!/^https?:\/\/\S+$/.test(pasted)) return
    e.preventDefault()
    const ta = e.currentTarget
    const selStart = ta.selectionStart
    const selEnd = ta.selectionEnd
    const selText = ta.value.slice(selStart, selEnd)
    let insert: string
    if (selText) {
      insert = `[${selText}](${pasted})`
    } else {
      try { insert = `[${new URL(pasted).hostname.replace(/^www\./, "")}](${pasted})` } catch { insert = pasted }
    }
    const newVal = ta.value.slice(0, selStart) + insert + ta.value.slice(selEnd)
    setDraftNotes(newVal)
    setTimeout(() => { if (notesTextareaRef.current) autoResize(notesTextareaRef.current) }, 0)
  }
```

- [ ] **Step 5: Wire the handlers onto the notes textarea and render the prompt bar**

In `src/app/meals/[id]/page.tsx`, find the notes field block (currently lines 396–418):

```tsx
      <div className={styles.fieldSection}>
        <span className={styles.fieldLabel}>{t.meals.notesLabel}</span>
        {isOwner && editingField === "notes" ? (
          <textarea
            autoFocus
            className={styles.fieldTextarea}
            value={draftNotes}
            onChange={(e) => { setDraftNotes(e.target.value); autoResize(e.target) }}
            onBlur={handleNotesBlur}
            ref={(el) => { if (el) autoResize(el) }}
          />
        ) : (
```

Replace the `<textarea>` with:

```tsx
          <>
            <textarea
              autoFocus
              className={styles.fieldTextarea}
              value={draftNotes}
              onChange={(e) => { setDraftNotes(e.target.value); autoResize(e.target) }}
              onBlur={(e) => {
                if (e.relatedTarget === linkUrlInputRef.current) return
                handleNotesBlur()
              }}
              onKeyDown={handleNotesKeyDown}
              onPaste={handleNotesPaste}
              ref={(el) => { notesTextareaRef.current = el; if (el) autoResize(el) }}
            />
            {linkPrompt && (
              <div className={styles.linkPromptBar}>
                <LinkIcon size={11} className={styles.linkPromptIcon} />
                <input
                  ref={linkUrlInputRef}
                  className={styles.linkPromptInput}
                  value={linkUrl}
                  placeholder="https://…"
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); if (linkUrl.trim()) insertLink(linkUrl.trim()) }
                    if (e.key === "Escape") { e.preventDefault(); setLinkPrompt(null); setLinkUrl(""); setTimeout(() => notesTextareaRef.current?.focus(), 0) }
                  }}
                  onBlur={(e) => {
                    if (e.relatedTarget === notesTextareaRef.current) return
                    dismissLinkPrompt()
                  }}
                />
                <button
                  className={styles.linkPromptSubmit}
                  onMouseDown={(e) => { e.preventDefault(); if (linkUrl.trim()) insertLink(linkUrl.trim()) }}
                >
                  Insert
                </button>
              </div>
            )}
          </>
        ) : (
```

This changes the `isOwner && editingField === "notes" ? ( ... ) : ( ... )` ternary's truthy branch from a single `<textarea>` element to a `<>...</>` fragment containing the textarea plus the conditional prompt bar — the rest of the ternary (the read-view branch) is unchanged in this step.

- [ ] **Step 6: Manually verify in the dev server**

Run `npm run dev`, open any recipe at `/meals/[id]`, click into the notes field to start editing.

- Select some text, press Cmd+K (or Ctrl+K), type a URL into the prompt, press Enter. Expected: the textarea's raw text now contains `[<selected text>](<url>)` at the selection point, cursor lands right after it.
- With no selection, repeat Cmd+K and insert `https://example.com/some/path`. Expected: textarea text contains `[example.com](https://example.com/some/path)`.
- Select some text and paste a bare URL (e.g. copy `https://example.com` then paste over a selection). Expected: textarea text contains `[<selected text>](https://example.com)`.
- With no selection, paste a bare URL. Expected: textarea text contains `[example.com](https://example.com)`.
- Press Escape while the prompt is open. Expected: prompt closes, no text inserted, focus returns to the textarea.

- [ ] **Step 7: Commit**

```bash
git add src/app/meals/[id]/page.tsx src/app/meals/meals.module.css
git commit -m "feat: add link-insert prompt and paste auto-wrap to meal notes"
```

---

### Task 2: Render-time link shortening and styled link output

**Files:**
- Modify: `src/app/meals/[id]/page.tsx`

**Interfaces:**
- Consumes: `draftNotes` (string state from Task 1/existing code), `styles.inlineLink` (CSS class added in Task 1).
- Produces: `linkifyNotes(text: string): string`.

- [ ] **Step 1: Add the `linkifyNotes` helper**

In `src/app/meals/[id]/page.tsx`, add this near the other top-level helper functions (after `isUrl`, around line 38):

```ts
function linkifyNotes(text: string): string {
  return text.replace(/(?<!\]\()https?:\/\/[^\s)\]>]+/g, (url) => {
    try { return `[${new URL(url).hostname.replace(/^www\./, "")}](${url})` } catch { return url }
  })
}
```

- [ ] **Step 2: Apply `linkifyNotes` and a custom link renderer to the read view**

Find the read-view rendering of notes (currently line 413):

```tsx
            {draftNotes
              ? <div className={styles.markdown}><ReactMarkdown remarkPlugins={[remarkBreaks]}>{draftNotes}</ReactMarkdown></div>
              : <span style={{ color: "var(--secondary)", opacity: 0.5, fontSize: "0.875rem" }}>{t.meals.notesEmptyPrompt}</span>
            }
```

Replace with:

```tsx
            {draftNotes
              ? <div className={styles.markdown}>
                  <ReactMarkdown
                    remarkPlugins={[remarkBreaks]}
                    components={{
                      a: ({ href, children }: React.ComponentPropsWithoutRef<"a">) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.inlineLink}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {linkifyNotes(draftNotes)}
                  </ReactMarkdown>
                </div>
              : <span style={{ color: "var(--secondary)", opacity: 0.5, fontSize: "0.875rem" }}>{t.meals.notesEmptyPrompt}</span>
            }
```

- [ ] **Step 3: Manually verify in the dev server**

With the dev server still running on a recipe's notes field:

- Using the Task 1 Cmd+K flow, insert a link, then click outside the textarea to blur and save. Expected: the notes display shows the link label (not the raw markdown), styled in the primary color, underlining only on hover.
- Click the rendered link. Expected: it opens in a new browser tab; clicking it does not also trigger the "click to edit" handler on the surrounding `.editableField` div.
- Directly set a recipe's `notes` to contain a bare URL with no markdown brackets (e.g. via `npx prisma studio`, or by temporarily pasting a URL followed by other text so the paste-wrap in Task 1 doesn't intercept it, then removing the brackets by hand in the textarea before blurring) and reload the page. Expected: the bare URL renders as a shortened hostname link, not the full raw URL.

- [ ] **Step 4: Commit**

```bash
git add src/app/meals/[id]/page.tsx
git commit -m "feat: auto-shorten and style links rendered in meal notes"
```
