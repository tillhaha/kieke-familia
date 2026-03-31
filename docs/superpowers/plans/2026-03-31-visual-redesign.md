# Visual Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's warm-amber SaaS palette with a Forest Green / Nordic-Functional design system across all CSS modules.

**Architecture:** All colour and style tokens live in `globals.css` as CSS custom properties; every component file consumes them via `var(--token)`. Task 1 rewrites the token layer; subsequent tasks fix hardcoded hex values that won't update automatically. The final result is a consistent green palette in both light and dark mode.

**Tech Stack:** CSS Modules, Next.js 16, no test suite — verification is visual via `npm run dev`.

---

## Verification method (no test suite)

After each task, run `npm run dev` and open the relevant page in a browser. Use `prefers-color-scheme: dark` in DevTools to verify dark mode. There is no `npm test`.

---

## Task 1: globals.css — replace token layer

**Files:**
- Modify: `src/app/globals.css`

This is the foundation. All component files consume CSS custom properties; updating them here propagates most of the new palette automatically.

- [ ] **Step 1: Replace the `:root` block**

Replace the entire `:root` block (lines 3–16) with:

```css
:root {
  --background: #f8faf8;
  --foreground: #1a2e22;
  --primary: #2d6a4f;
  --primary-hover: #245a42;
  --secondary: #5a8a6a;
  --border: #d8e8dc;
  --surface: #ffffff;
  --surface-hover: #eef6f1;
  --accent-soft: #e8f4ee;
  --accent-border: #c0ddc8;
  --radius: 8px;
  --shadow-sm: 0 1px 3px rgba(45, 106, 79, 0.08);
  --shadow-md: 0 4px 16px rgba(45, 106, 79, 0.12);
}
```

- [ ] **Step 2: Replace the dark-mode block**

Replace the entire `@media (prefers-color-scheme: dark) :root` block (lines 18–29) with:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --background: #0f1a13;
    --foreground: #d4ead8;
    --primary: #52b788;
    --primary-hover: #3d9e70;
    --secondary: #3d6a4a;
    --border: #1e3328;
    --surface: #142010;
    --surface-hover: #1e3328;
    --accent-soft: #1e3328;
    --accent-border: #2d5040;
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
    --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
  }
}
```

Note: `--primary`, `--primary-hover`, and `--secondary` did **not** exist in the old dark block — they are additions, not replacements.

- [ ] **Step 3: Verify dev server reflects new palette**

Run `npm run dev` and open `/`. Background should be `#f8faf8` (very slightly green-tinted white). Primary orange/amber tones should be gone from any token-driven elements.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "style: replace color tokens with forest green palette"
```

---

## Task 2: navbar.module.css — pill nav + lettermark logo

**Files:**
- Modify: `src/components/navbar.module.css`

The current navbar logo renders a `<Bot>` SVG icon + text span. We'll hide the SVG and inject a CSS `::before` lettermark. The active nav state changes from a soft-tinted pill to a filled green pill. Mobile drawer active state uses a left border instead.

- [ ] **Step 1: Update `.logo` — hide SVG, add lettermark via `::before`**

Replace the `.logo` rule:

```css
.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.8125rem;
  color: var(--foreground);
  letter-spacing: -0.01em;
  flex-shrink: 0;
  cursor: pointer;
}

/* Hide the existing SVG icon */
.logo svg {
  display: none;
}

/* Inject F lettermark */
.logo::before {
  content: 'F';
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: var(--primary);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  border-radius: 5px;
  flex-shrink: 0;
  line-height: 1;
}
```

- [ ] **Step 2: Update `.navLink` and `.navLink.active` — pill active state**

Replace the `.navLink` and `.navLink.active` rules:

```css
.navLink {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 4px 11px;
  border-radius: 20px;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--secondary);
  transition: background-color 150ms, color 150ms;
  cursor: pointer;
}

.navLink:hover {
  background: var(--surface-hover);
  color: var(--foreground);
}

.navLink.active {
  background: var(--primary);
  color: #fff;
  font-weight: 600;
}
```

- [ ] **Step 3: Update `.navLinkDisabled`**

```css
.navLinkDisabled {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 4px 11px;
  border-radius: 20px;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--secondary);
  opacity: 0.4;
  cursor: default;
}
```

- [ ] **Step 4: Mobile drawer active state — left border instead of filled pill**

Inside the `@media (max-width: 768px)` block, update the active state override:

```css
/* After the existing .navLinks .navLink rule, add: */
.navLinks .navLink.active {
  background: transparent;
  color: var(--primary);
  font-weight: 700;
  border-left: 3px solid var(--primary);
  padding-left: calc(1.5rem - 3px); /* compensate for border width */
}
```

- [ ] **Step 5: Verify**

Open `/` in browser. Navbar should show: `F` green square + app name text. Active link should be a filled green pill on desktop. Toggle mobile view — active should show left green border, not filled pill. Check dark mode: logo `F` square uses `--primary` (lighter green in dark).

- [ ] **Step 6: Commit**

```bash
git add src/components/navbar.module.css
git commit -m "style: pill nav links, F lettermark logo, mobile drawer active state"
```

---

## Task 3: page.module.css — homepage

**Files:**
- Modify: `src/app/page.module.css`

Most of this file already uses CSS custom properties. **Card borders are automatically green-tinted by the token change in Task 1** (`--border` is now `#d8e8dc`). No manual change needed for `.card` borders. The `--accent-soft` / `--accent-border` highlight-card pattern is available for future use but no existing element in this file currently needs it. Actual changes here: sign-in button pill shape, checkbox accent, danger colour.

- [ ] **Step 1: Update `.signInBtn` — pill shape**

Replace `border-radius: var(--radius)` with `border-radius: 20px` in `.signInBtn`.

- [ ] **Step 2: Update `.credentialError` dark mode**

The current dark override uses `#f87171`. Replace with `#e07070`:

```css
@media (prefers-color-scheme: dark) {
  .credentialError {
    color: #e07070;
  }
}
```

- [ ] **Step 3: Update `.tasksWidgetCheckbox` accent-color**

Change `accent-color: var(--foreground)` to `accent-color: var(--primary)`.

- [ ] **Step 4: Update `.tasksWidgetMeta.overdue`**

Change `color: #e05252` to `color: #d4604a`.

Add dark override if not present:

```css
@media (prefers-color-scheme: dark) {
  .tasksWidgetMeta.overdue {
    color: #e08060;
  }
}
```

- [ ] **Step 5: Verify**

Open `/` in browser. Sign-in button (if shown) should have pill shape. Task widget overdue dates should show warm terracotta (not harsh red). Checkboxes should use green accent.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.module.css
git commit -m "style: homepage pill button, green checkbox accent, overdue colour"
```

---

## Task 4: tasks.module.css — task page

**Files:**
- Modify: `src/app/tasks/tasks.module.css`

Overdue labels use `#e05252` (four occurrences). Checkboxes use `var(--foreground)` for accent. Fallback values in `var(--border, #e5e7eb)` can be cleaned up.

- [ ] **Step 1: Replace all `#e05252` with `#d4604a`**

There are 4 occurrences (lines 103, 170, 310, 322 approximately). Replace all:
- `.sectionLabel.overdue { color: #e05252; }` → `color: #d4604a`
- `.taskMeta.overdue { color: #e05252; }` → `color: #d4604a`
- Any other `.overdue` class with `#e05252`

- [ ] **Step 2: Add dark-mode override for overdue colours**

Add at the bottom of the file (before mobile breakpoints):

```css
@media (prefers-color-scheme: dark) {
  .sectionLabel.overdue,
  .taskMeta.overdue {
    color: #e08060;
  }
}
```

- [ ] **Step 3: Update checkbox accent-color**

Find `.checkbox { accent-color: var(--foreground); }` and change to `accent-color: var(--primary)`.

- [ ] **Step 4: Remove border fallback values**

`var(--border, #e5e7eb)` → `var(--border)` in all three occurrences (lines ~119, 229, 260).

- [ ] **Step 5: Update `.newBtn` border-radius to pill**

Change `border-radius: 6px` to `border-radius: 20px` on `.newBtn`.

- [ ] **Step 6: Verify**

Open `/tasks`. Overdue section label and task meta should show warm terracotta, not harsh red. Checkboxes should use green accent. Completed tasks show strikethrough. Dark mode: overdue should be a muted orange-red.

- [ ] **Step 7: Commit**

```bash
git add src/app/tasks/tasks.module.css
git commit -m "style: tasks overdue colours, green checkbox accent, pill new-task button"
```

---

## Task 5: week.module.css — week grid

**Files:**
- Modify: `src/app/week/week.module.css`

Three targeted changes: cell error colours (add `color` property), tooltip dark mode override, plan/generate button pill shape.

- [ ] **Step 1: Update `.cellError` — add `color` property**

Find the `.cellError` rule (has `background: #fef2f2`). It currently has no `color` property. Add one:

```css
.cellError {
  background: #fef2f2;
  color: #c0392b;  /* ADD this line */
  /* keep any other existing properties */
}
```

Also update the dark-mode override for `.cellError`:

```css
@media (prefers-color-scheme: dark) {
  .cellError {
    background: #2d1414;
    color: #e07070;
  }
}
```

The existing dark override has `background: #2d0a0a` — update it to `#2d1414` and add the `color` line.

- [ ] **Step 2: Add tooltip dark-mode override**

Find `.pillTooltip` — it has `background: #1e293b; color: #f8fafc` which is intentional (stays in light mode). Add a dark-mode override to invert it:

```css
@media (prefers-color-scheme: dark) {
  .pillTooltip {
    background: #d4ead8;
    color: #0f1a13;
  }
}
```

- [ ] **Step 3: Update `.planBtn` border-radius to pill**

Change `border-radius: 6px` → `border-radius: 20px` on `.planBtn`.

- [ ] **Step 4: Verify**

Open `/week`. In DevTools, temporarily add `cellError` class to a cell — it should show red background + red text. Hover a meal pill to see tooltip. Toggle dark mode: tooltip should invert (light background, dark text in dark mode).

- [ ] **Step 5: Commit**

```bash
git add src/app/week/week.module.css
git commit -m "style: week cell error colour, tooltip dark mode invert, pill button"
```

---

## Task 6: meals.module.css — buttons + danger states

**Files:**
- Modify: `src/app/meals/meals.module.css`

Hardcoded danger values in delete buttons and error messages. The existing dark overrides for delete buttons also need updating. Two error message classes need dark-mode overrides added.

- [ ] **Step 1: Update `.deleteBtn:hover`**

```css
.deleteBtn:hover {
  background: #fdecea;
  color: #c0392b;
  border-color: #c0392b;
}
```

- [ ] **Step 2: Update `.deleteBtnConfirm` (light and dark)**

```css
.deleteBtnConfirm {
  flex-shrink: 0;
  padding: 0.4rem 0.875rem;
  border-radius: 6px;
  border: 1px solid #c0392b;
  background: #fdecea;
  color: #c0392b;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 150ms;
  white-space: nowrap;
}

.deleteBtnConfirm:hover { background: #fbd5d5; }
```

Update the dark overrides:

```css
@media (prefers-color-scheme: dark) {
  .deleteBtn:hover { background: #2d0a0a; color: #e07070; border-color: #e07070; }
  .deleteBtnConfirm { background: #2d0a0a; border-color: #e07070; color: #e07070; }
  .deleteBtnConfirm:hover { background: #3d1010; }
}
```

- [ ] **Step 3: Update `.errorMsg` + add dark override**

```css
.errorMsg {
  font-size: 0.875rem;
  color: #c0392b;
}

@media (prefers-color-scheme: dark) {
  .errorMsg { color: #e07070; }
}
```

- [ ] **Step 4: Update `.parseError` + add dark override**

```css
.parseError {
  font-size: 0.8125rem;
  color: #c0392b;
}

@media (prefers-color-scheme: dark) {
  .parseError { color: #e07070; }
}
```

- [ ] **Step 5: Update button border-radius to pill where appropriate**

Update `.newBtn`, `.saveBtn`, `.parseBtn` from `border-radius: 6px` → `border-radius: 20px`.

- [ ] **Step 6: Verify**

Open `/meals` and `/meals/new`. Hover the delete button on a recipe — should show `#fdecea` background. Error messages (trigger a parse error) should be `#c0392b`. Dark mode: same elements should show `#e07070`.

- [ ] **Step 7: Commit**

```bash
git add src/app/meals/meals.module.css
git commit -m "style: meals danger states, unified error colours, pill buttons"
```

---

## Task 7: shopping.module.css — danger colours

**Files:**
- Modify: `src/app/shopping/shopping.module.css`

Three occurrences of `#e11d48` (clear button text, hover border, dark mode text).

- [ ] **Step 1: Update `.clearBtn`**

```css
.clearBtn {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.875rem;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: #c0392b;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: border-color 150ms;
}

.clearBtn:hover:not(:disabled) {
  border-color: #c0392b;
}
```

- [ ] **Step 2: Update `.addError` + dark override**

```css
.addError {
  font-size: 0.8125rem;
  color: #c0392b;
}
```

Update the existing dark override block:

```css
@media (prefers-color-scheme: dark) {
  .categoryPill {
    background: rgba(255,255,255,0.04);
  }
  .addError {
    color: #e07070;
  }
  .clearBtn {
    color: #e07070;
  }
}
```

- [ ] **Step 3: Update `.addBtn` border-radius**

Change `border-radius: 6px` → `border-radius: 20px` on `.addBtn`.

- [ ] **Step 4: Verify**

Open `/shopping`. The "Clear all" button text should be `#c0392b` (not the old hot pink). Dark mode: should be `#e07070`. Adding an invalid item should show `#c0392b` error.

- [ ] **Step 5: Commit**

```bash
git add src/app/shopping/shopping.module.css
git commit -m "style: shopping danger colour unification, pill add button"
```

---

## Task 8: calendar.module.css — surface tokens + form errors

**Files:**
- Modify: `src/app/calendar/calendar.module.css`

Three error-state classes need updating: `.errorBanner`, `.modalError`, `.custodyPopoverError`. Do NOT touch lines 179–221 (event chip colours — birthday, travel, custody).

- [ ] **Step 1: Update `.errorBanner` (light + dark)**

Find the `.errorBanner` rule (~line 233):

```css
.errorBanner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: #fdecea;
  border: 1px solid #c0392b;
  border-radius: var(--radius);
  color: #c0392b;
  font-size: 0.875rem;
}

@media (prefers-color-scheme: dark) {
  .errorBanner {
    background: #2d0a0a;
    border-color: #c0392b;
    color: #e07070;
  }
}
```

Also update `.retryBtn` border to match:

```css
.retryBtn {
  /* keep all existing properties, but update border: */
  border: 1px solid #c0392b;
  /* rest unchanged */
}
```

- [ ] **Step 2: Update `.modalError` (light + dark)**

```css
.modalError {
  font-size: 0.875rem;
  color: #c0392b;
  margin: 0.75rem 0 0;
}

/* Inside the existing @media (prefers-color-scheme: dark) block: */
.modalError {
  color: #e07070;
}
```

- [ ] **Step 3: Update `.custodyPopoverError` (light + dark)**

```css
.custodyPopoverError {
  font-size: 11px;
  color: #c0392b;
  margin-top: 2px;
}

/* Inside the existing dark block: */
.custodyPopoverError {
  color: #e07070;
}
```

- [ ] **Step 4: Verify — confirm event chips are untouched**

Open `/calendar`. Birthday, travel, and custody entries must retain their pink/gold/teal/green chip colours. Error banners (trigger by disconnecting from internet or providing bad data in custody form) should show `#c0392b` text. Dark mode: `#e07070`.

- [ ] **Step 5: Commit**

```bash
git add src/app/calendar/calendar.module.css
git commit -m "style: calendar error states unified, event chip colours preserved"
```

---

## Task 9: settings.module.css — inputs + danger states

**Files:**
- Modify: `src/app/settings/settings.module.css`

Hardcoded danger values in delete/confirm button states.

- [ ] **Step 1: Find and update all danger-state rules**

Grep for hardcoded reds: `#dc2626`, `#fef2f2`, `#fecaca`, `#991b1b`, `#7f1d1d`, `#fca5a5`, `#f87171`.

For each occurrence, apply the unified danger palette:
- `#dc2626` → `#c0392b`
- `#fef2f2` → `#fdecea`
- `#fecaca` → `#c0392b` (border)
- `#991b1b` → `#c0392b`
- Dark `#7f1d1d` → `#c0392b`
- Dark `#fca5a5` → `#e07070`
- Dark `#f87171` → `#e07070`
- Dark `#2d0a0a` — keep as-is (already target)

- [ ] **Step 2: Verify**

Open `/settings`. Hover a destructive action button — should show `#fdecea` background with `#c0392b` text. Dark mode: `#2d0a0a` bg with `#e07070` text.

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/settings.module.css
git commit -m "style: settings danger states unified to new palette"
```

---

## Task 10: onboarding/page.module.css — error state

**Files:**
- Modify: `src/app/onboarding/page.module.css`

One hardcoded error red. The success state (`#dcfce7 / #16a34a`) is intentionally unchanged.

- [ ] **Step 1: Update `#ef4444` → `#c0392b`**

Find `color: #ef4444` (approximately line 163). Replace with `color: #c0392b`.

- [ ] **Step 2: Add dark-mode override**

The class name at line 161 is `.error`. Add at the end of the file:

```css
@media (prefers-color-scheme: dark) {
  .error {
    color: #e07070;
  }
}
```

- [ ] **Step 3: Verify**

Open `/onboarding`. Trigger a join-code error. Error text should be `#c0392b`, not hot pink. The success confirmation (green background) should be untouched.

- [ ] **Step 4: Commit**

```bash
git add src/app/onboarding/page.module.css
git commit -m "style: onboarding error colour unified"
```

---

## Task 11: footer / privacy / imprint — verify no regressions

**Files:**
- Verify only (no edits expected): `src/components/footer.module.css`, `src/app/privacy/privacy.module.css`, `src/app/imprint/imprint.module.css`

All three files are already fully token-based — no hardcoded hex values exist. No code changes are needed, but confirm the files haven't regressed.

- [ ] **Step 1: Grep each file for hardcoded hex values**

```bash
grep -n '#[0-9a-fA-F]\{3,6\}' \
  src/components/footer.module.css \
  src/app/privacy/privacy.module.css \
  src/app/imprint/imprint.module.css
```

Expected output: no matches. If any appear, apply the unified colour rules from the spec.

- [ ] **Step 2: Visually verify in browser**

Open `/privacy` and `/imprint`. Text should use `--foreground` (dark green) and `--secondary` (muted green). Links should use `--primary` (forest green). No amber/terracotta should appear.

---

## Task 12: Final cross-page verification

No code changes — verification only.

- [ ] **Step 1: Full light-mode walkthrough**

Visit each page and confirm green palette is consistent:
- `/` — green background tint, green primary button, task widget
- `/week` — week table, today column
- `/calendar` — error banner colour (if triggerable), event chips unchanged
- `/meals` — recipe list, detail page, delete confirm state
- `/meals/new` — form inputs, parse button
- `/shopping` — clear button, add error
- `/tasks` — overdue label, checkbox accent
- `/settings` — sidebar, danger button hover

- [ ] **Step 2: Full dark-mode walkthrough**

In DevTools: Rendering → Emulate CSS `prefers-color-scheme: dark`. Walk the same pages. Key checks:
- Background should be `#0f1a13` (very dark green)
- Primary elements should be `#52b788` (lighter green)
- Danger/error text should be `#e07070` (not bright red)
- Tooltip in week page should invert (light on dark bg → dark on light bg)

- [ ] **Step 3: Commit any remaining fixes found**

```bash
git add src/app/globals.css src/components/navbar.module.css src/app/page.module.css \
  src/app/tasks/tasks.module.css src/app/week/week.module.css \
  src/app/meals/meals.module.css src/app/shopping/shopping.module.css \
  src/app/calendar/calendar.module.css src/app/settings/settings.module.css \
  src/app/onboarding/page.module.css
git commit -m "style: fix remaining palette inconsistencies found in final review"
```
