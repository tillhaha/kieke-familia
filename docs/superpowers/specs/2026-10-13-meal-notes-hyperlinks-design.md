# Meal notes hyperlinks

## Problem

The meal recipe notes field (`src/app/meals/[id]/page.tsx`) renders markdown via `ReactMarkdown` but has no way to insert links conveniently, and any pasted URL shows up as a long raw string. `WeekBlock.tsx` already solved this for day notes / lunch / dinner fields with three mechanisms; this spec ports that same pattern to the meal notes field only.

## Reference implementation

`src/app/week/WeekBlock.tsx` already implements, for its per-cell textareas:

1. **Cmd/Ctrl+K insert prompt** (`handleTextareaKeyDown`, `linkPrompt` state, `renderLinkPromptBar`, `insertLink`) — opens an inline bar with a URL input below the textarea. Confirming wraps the current selection (or, with no selection, the URL's hostname) into a markdown link `[label](url)` spliced into the draft at the captured selection range.
2. **Paste auto-wrap** (`handleTextareaPaste`) — if the pasted clipboard text is a bare `http(s)://` URL, it's intercepted and wrapped the same way instead of inserted raw.
3. **Render-time auto-shortening** (`linkifyText`) — a regex pass over the saved text that finds bare URLs not already inside markdown link syntax and rewrites them to `[hostname](url)` before handing the string to `ReactMarkdown`. This catches URLs that entered the field some other way (e.g. legacy data).

Rendered `a` tags use a custom ReactMarkdown component that forces `target="_blank"`, `rel="noopener noreferrer"`, and applies `.inlineLink` styling (`color: var(--primary)`, underline only on hover).

## Scope

Port mechanisms 1–3 to the **notes field** on `src/app/meals/[id]/page.tsx` only. Ingredients, steps, and source fields are out of scope — they aren't free-text prose in the same way, and the user did not ask for them.

## Design

### State

Meals page only has one relevant textarea (no per-cell key map needed, unlike WeekBlock), so state is simplified:

```ts
type NotesLinkPrompt = { selStart: number; selEnd: number; selText: string; baseText: string }
const [linkPrompt, setLinkPrompt] = useState<NotesLinkPrompt | null>(null)
const [linkUrl, setLinkUrl] = useState("")
const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null)
const linkUrlInputRef = useRef<HTMLInputElement>(null)
```

### Handlers

- `handleNotesKeyDown(e)`: on Cmd/Ctrl+K, `preventDefault()`, capture `selectionStart`/`selectionEnd`/selected substring/current textarea value into `linkPrompt`, clear `linkUrl`.
- `handleNotesPaste(e)`: if clipboard text matches `^https?:\/\/\S+$`, `preventDefault()`; build `[selection or hostname](url)` and splice into `draftNotes` at the current selection; re-run `autoResize`.
- `insertLink(url)`: reads `linkPrompt`, builds `[label](url)` (label = `selText` or the URL's hostname with `www.` stripped), splices into `linkPrompt.baseText` at `selStart`/`selEnd`, sets `draftNotes`, closes the prompt, refocuses the textarea with the cursor placed right after the inserted link, and resizes.
- `dismissLinkPrompt()`: clears `linkPrompt`/`linkUrl` and calls `handleNotesBlur()` (matching the existing blur-driven autosave already in place for the notes field).
- `linkifyNotes(text)`: identical regex to WeekBlock's `linkifyText` — matches bare URLs not already inside `](...)`, rewrites each to `[hostname](url)`.

### Rendering changes

- Textarea (`editingField === "notes"`) gains `onKeyDown={handleNotesKeyDown}` and `onPaste={handleNotesPaste}`, plus a ref assignment to `notesTextareaRef`.
- A link-prompt bar renders directly below the textarea when `linkPrompt` is set (same structure as WeekBlock's `renderLinkPromptBar`: icon, text input bound to `linkUrl`, Enter/Escape handling, Insert button, blur-to-dismiss unless blurring into the textarea itself).
- The read view's `ReactMarkdown remarkPlugins={[remarkBreaks]}` call wraps `linkifyNotes(draftNotes)` instead of raw `draftNotes`, and receives a `components={{ a: ... }}` override for `target="_blank"` + `.inlineLink` styling (no `li`/pill logic — that's WeekBlock-specific and not used here).

### Imports

- `Link` is already imported from `next/link` in this file. The lucide-react link icon for the prompt bar must be aliased: `import { Link as LinkIcon, ... } from "lucide-react"`.

### Styling

Copy into `meals.module.css` (unchanged, since both files share the same global CSS variables):

```css
.inlineLink { color: var(--primary); text-decoration: none; font-size: inherit; }
.inlineLink:hover { text-decoration: underline; }

.linkPromptBar { display: flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.5rem; border-top: 1px solid var(--border); background: var(--surface); }
.linkPromptIcon { flex-shrink: 0; color: var(--secondary); }
.linkPromptInput { flex: 1; min-width: 0; padding: 0.2rem 0.4rem; border: 1px solid var(--border); border-radius: 4px; background: var(--background); color: var(--foreground); font-size: 0.6875rem; font-family: inherit; outline: none; }
.linkPromptInput:focus { border-color: var(--primary); }
.linkPromptSubmit { flex-shrink: 0; padding: 0.2rem 0.5rem; border: none; border-radius: 4px; background: var(--primary); color: #fff; font-size: 0.6875rem; font-family: inherit; cursor: pointer; line-height: 1.4; }
.linkPromptSubmit:hover { opacity: 0.85; }
```

## Out of scope

- Ingredients, steps, source fields.
- Any changes to WeekBlock's existing hyperlink behavior.
- Link preview/unfurling, favicon display, or any richer link metadata — label is always plain hostname text, matching WeekBlock.

## Testing

No test suite exists in this repo (per `CLAUDE.md`). Verify manually in the dev server:
- Cmd+K with a selection → selection becomes the link label.
- Cmd+K with no selection → hostname becomes the label.
- Pasting a bare URL with text selected → selection becomes the label.
- Pasting a bare URL with nothing selected → hostname becomes the label.
- Saved notes containing a bare URL (simulate via Prisma Studio or direct paste bypass) render as a shortened hostname link on reload.
- Links open in a new tab and are styled consistently with WeekBlock's inline links.
- Escape dismisses the prompt without inserting; blurring away from the prompt also dismisses and saves via the existing blur autosave.
