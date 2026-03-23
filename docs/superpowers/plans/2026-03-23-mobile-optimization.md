# Mobile Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Familia work well on mobile phones without restructuring the desktop-first layout.

**Architecture:** Additive `@media (max-width: 768px)` blocks appended to each existing CSS module; minimal component changes for the hamburger menu only. All desktop styles are left untouched.

**Tech Stack:** Next.js 16, CSS Modules, TypeScript. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-23-mobile-optimization-design.md`

---

## Files Changed

| File | What changes |
|------|-------------|
| `src/app/layout.tsx` | Add `viewport` export |
| `src/app/globals.css` | Add touch target baseline for `button` and `[role="button"]` |
| `src/components/Navbar.tsx` | Add `menuOpen` state, hamburger button, close-on-navigate effect |
| `src/components/navbar.module.css` | Add `.hamburger` class + mobile dropdown styles |
| `src/app/settings/settings.module.css` | Sidebar stacking, tab strip, fieldInput full-width |
| `src/app/week/week.module.css` | Reduce `.cornerCell`/`.rowLabel` width, reduce header font size |
| `src/app/calendar/calendar.module.css` | Scrollable grid, reduced cell height, smaller font sizes |
| `src/app/meals/meals.module.css` | Stack `.detailHeader` on mobile |
| `src/app/page.module.css` | Padding reduction on `.main` |
| `src/app/shopping/shopping.module.css` | Padding reduction on `.container` |
| `src/app/imprint/imprint.module.css` | Padding reduction on `.page` |
| `src/app/privacy/privacy.module.css` | Padding reduction on `.page` |

---

## How to verify changes (no unit tests for CSS)

All tasks are verified visually. After each task:
1. Run `npm run dev` if not already running
2. Open the relevant page in your browser
3. Open DevTools → Toggle device toolbar (Cmd+Shift+M on Mac)
4. Set width to **375px** (iPhone SE) and confirm the layout
5. Set width to **768px** (tablet boundary) and confirm the layout
6. Restore to desktop width and confirm no regressions

---

## Task 1: Viewport meta tag + touch target baseline

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

This is the single most critical fix. Without the viewport meta tag, mobile browsers render the full desktop page at 1/3 zoom.

- [ ] **Step 1: Add viewport export to `layout.tsx`**

Open `src/app/layout.tsx`. Add a `Viewport` import and a `viewport` export alongside the existing `metadata` export:

```ts
import type { Metadata, Viewport } from "next";

// existing metadata export stays unchanged
export const metadata: Metadata = {
  title: "YourKieke - Shared Family Management",
  description: "A comprehensive platform for family coordination, calendar, and planning.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};
```

- [ ] **Step 2: Add touch target baseline to `globals.css`**

Append to the end of `src/app/globals.css`:

```css
/* ── Mobile baseline ─────────────────────────────────── */

@media (max-width: 768px) {
  button,
  [role="button"] {
    min-height: 44px;
  }
}
```

Note: `<a>` tags are excluded intentionally. Nav links and sidebar buttons get explicit `min-height: 44px` in their own component CSS.

- [ ] **Step 3: Verify**

Start dev server (`npm run dev`). Open any page at 375px. Confirm the page renders at phone width instead of zoomed-out desktop. Confirm buttons visually have adequate tap height.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: add viewport meta tag and 44px touch target baseline"
```

---

## Task 2: Hamburger menu in Navbar

**Files:**
- Modify: `src/components/Navbar.tsx`
- Modify: `src/components/navbar.module.css`

The existing `Navbar.tsx` already has `useState` (for the user dropdown `open`), `usePathname`, `useEffect`, and `useRef`. We're adding a second independent state `menuOpen` for the hamburger. Do not remove or modify the existing `open` state.

- [ ] **Step 1: Add `menuOpen` state and hamburger button to `Navbar.tsx`**

In `src/components/Navbar.tsx`, make these changes:

1. Add a second state variable after the existing `open` state:
```ts
const [menuOpen, setMenuOpen] = useState(false)
```

2. Add a `useEffect` that closes the hamburger when the route changes (add after the existing `useEffect`):
```ts
useEffect(() => {
  setMenuOpen(false)
}, [pathname])
```

3. Inside the `{session && (...)}` block that renders `.navLinks`, change the `className` to conditionally apply the open class:
```tsx
<div className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ""}`}>
```

4. Add the hamburger button inside `<nav className={styles.inner}>`, between the logo and the navLinks div:
```tsx
{session && (
  <button
    className={styles.hamburger}
    onClick={() => setMenuOpen((v) => !v)}
    aria-label={menuOpen ? "Close menu" : "Open menu"}
    aria-expanded={menuOpen}
  >
    {menuOpen ? "✕" : "☰"}
  </button>
)}
```

- [ ] **Step 2: Add hamburger CSS to `navbar.module.css`**

Append to the end of `src/components/navbar.module.css`:

```css
/* ── Mobile: hamburger menu ─────────────────────────── */

.hamburger {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: var(--foreground);
  font-size: 1.25rem;
  cursor: pointer;
  border-radius: 6px;
  margin-left: auto;
}

.hamburger:hover {
  background: var(--surface-hover);
}

@media (max-width: 768px) {
  .hamburger {
    display: flex;
  }

  .navLinks {
    display: none;
  }

  .navLinks.navLinksOpen {
    display: flex;
    flex-direction: column;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--background);
    border-bottom: 1px solid var(--border);
    box-shadow: var(--shadow-md);
    padding: 0.5rem 0;
    z-index: 100;
  }

  .navLinks.navLinksOpen .navLink {
    padding: 0.75rem 1.5rem;
    min-height: 44px;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
  }

  .navLinks.navLinksOpen .navLink:last-child {
    border-bottom: none;
  }
}
```

- [ ] **Step 3: Verify**

At 375px: confirm hamburger `☰` button appears, nav links are hidden. Tap hamburger — links appear in a dropdown. Tap a link — menu closes and you navigate. The user dropdown (`.userSection`) remains visible in the navbar alongside the hamburger — this is intentional; users can still access settings and sign-out from there. At desktop width — hamburger is invisible, nav links show normally.

- [ ] **Step 4: Commit**

```bash
git add src/components/Navbar.tsx src/components/navbar.module.css
git commit -m "feat: add hamburger menu for mobile navigation"
```

---

## Task 3: Settings sidebar stacking

**Files:**
- Modify: `src/app/settings/settings.module.css`

The settings page has a fixed `180px` sidebar (`flex-shrink: 0`) that forces a horizontal layout even on small screens. On mobile it becomes a horizontal scrollable tab strip above the content.

- [ ] **Step 1: Append mobile block to `settings.module.css`**

Append to the end of `src/app/settings/settings.module.css`:

```css
/* ── Mobile ──────────────────────────────────────────── */

@media (max-width: 768px) {
  .container {
    flex-direction: column;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
    gap: 0;
  }

  .sidebar {
    width: 100%;
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0;
  }

  .sidebarTitle {
    display: none;
  }

  .sectionBtn {
    white-space: nowrap;
    padding: 0.75rem 1rem;
    min-height: 44px;
    border-radius: 0;
  }

  .fieldInput {
    max-width: 100%;
  }
}
```

- [ ] **Step 2: Verify**

At 375px on `/settings`: sidebar appears as a horizontal scrollable row of buttons. Content fills the full width below. Text inputs stretch to full width. At desktop: sidebar is vertical on the left, unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/settings.module.css
git commit -m "feat: stack settings sidebar on mobile"
```

---

## Task 4: Week planner mobile tweaks

**Files:**
- Modify: `src/app/week/week.module.css`

The week planner table already has `overflow-x: auto` — it scrolls horizontally on mobile. We just need to reduce the fixed label column widths so more content is visible before scrolling.

Current values: `.cornerCell` and `.rowLabel` both have `width: 80px; min-width: 80px`.

- [ ] **Step 1: Append mobile block to `week.module.css`**

Append to the end of `src/app/week/week.module.css`:

```css
/* ── Mobile ──────────────────────────────────────────── */

@media (max-width: 768px) {
  .container {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
    gap: 1rem;
  }

  .cornerCell,
  .rowLabel {
    width: 56px;
    min-width: 56px;
  }

  .rowLabel {
    font-size: 0.6875rem;
    padding: 0.5rem 0.375rem;
  }

  .dayHeader {
    font-size: 0.65rem;
    padding: 0.5rem 0.25rem;
  }
}
```

- [ ] **Step 2: Verify**

At 375px on `/week`: table scrolls horizontally, label column is narrower. Day headers show abbreviated names (already rendered as "Mon" etc. by the component). At desktop: no change.

- [ ] **Step 3: Commit**

```bash
git add src/app/week/week.module.css
git commit -m "feat: reduce week planner label columns on mobile"
```

---

## Task 5: Calendar mobile fixes

**Files:**
- Modify: `src/app/calendar/calendar.module.css`

The 7-column calendar grid is too narrow at 375px (~53px per column). The fix is to make the grid scroll horizontally with a minimum width, and reduce cell height so more weeks fit in view.

Current: `.calendarGrid` has `overflow: hidden`. We override to `overflow-x: auto` on mobile and set `min-width: 560px` on the grid.

- [ ] **Step 1: Append mobile block to `calendar.module.css`**

Append to the end of `src/app/calendar/calendar.module.css`:

```css
/* ── Mobile ──────────────────────────────────────────── */

@media (max-width: 768px) {
  .calendarContainer {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
    gap: 0.75rem;
    overflow-x: auto;
  }

  .calendarHeader {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .monthTitle {
    font-size: 1.125rem;
  }

  .calendarGrid {
    overflow-x: auto;
    min-width: 560px;
  }

  .dayCell {
    min-height: 70px;
    padding: 0.25rem;
  }

  .dayNumber {
    font-size: 0.6875rem;
  }

  .eventItem {
    font-size: 0.625rem;
    padding: 1px 4px;
  }
}
```

- [ ] **Step 2: Verify**

At 375px on `/calendar`: the month grid scrolls horizontally and is readable (not crushed). Day cells have adequate height. At desktop: no change.

- [ ] **Step 3: Commit**

```bash
git add src/app/calendar/calendar.module.css
git commit -m "feat: make calendar grid scrollable on mobile"
```

---

## Task 6: Meals detail header stacking

**Files:**
- Modify: `src/app/meals/meals.module.css`

The meals list uses `auto-fill` grid and already works on mobile. Only the detail page needs a fix: `.detailHeader` uses `justify-content: space-between` in a row, which wraps badly when title and action buttons run out of space.

- [ ] **Step 1: Append mobile block to `meals.module.css`**

Append to the end of `src/app/meals/meals.module.css`:

```css
/* ── Mobile ──────────────────────────────────────────── */

@media (max-width: 768px) {
  .container {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  .detailContainer {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  .detailHeader {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
}
```

- [ ] **Step 2: Verify**

At 375px on `/meals/[any-id]`: the recipe title appears above the action buttons, stacked vertically. Meals list cards still reflow correctly (grid `auto-fill` handles this). At desktop: no change.

- [ ] **Step 3: Commit**

```bash
git add src/app/meals/meals.module.css
git commit -m "feat: stack meals detail header on mobile"
```

---

## Task 7: Remaining simple pages

**Files:**
- Modify: `src/app/page.module.css`
- Modify: `src/app/shopping/shopping.module.css`
- Modify: `src/app/imprint/imprint.module.css`
- Modify: `src/app/privacy/privacy.module.css`

These pages are already single-column — they just need padding reduced on mobile.

- [ ] **Step 1: Add mobile padding to `page.module.css`** (home page, container class is `.main`)

Append to `src/app/page.module.css`:

```css
/* ── Mobile ──────────────────────────────────────────── */

@media (max-width: 768px) {
  .main {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }
}
```

- [ ] **Step 2: Add mobile padding to `shopping.module.css`** (container class is `.container`)

Append to `src/app/shopping/shopping.module.css`:

```css
/* ── Mobile ──────────────────────────────────────────── */

@media (max-width: 768px) {
  .container {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }
}
```

- [ ] **Step 3: Add mobile padding to `imprint.module.css`** (container class is `.page`)

Append to `src/app/imprint/imprint.module.css`:

```css
/* ── Mobile ──────────────────────────────────────────── */

@media (max-width: 768px) {
  .page {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }
}
```

- [ ] **Step 4: Add mobile padding to `privacy.module.css`** (container class is `.page`)

Append to `src/app/privacy/privacy.module.css`:

```css
/* ── Mobile ──────────────────────────────────────────── */

@media (max-width: 768px) {
  .page {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }
}
```

- [ ] **Step 5: Verify**

At 375px: visit `/`, `/shopping`, `/imprint`, `/privacy`. Each page has comfortable side padding (not edge-to-edge). At desktop: no change.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.module.css src/app/shopping/shopping.module.css src/app/imprint/imprint.module.css src/app/privacy/privacy.module.css
git commit -m "feat: reduce side padding on remaining pages for mobile"
```

---

## Task 8: Final cross-page smoke check

- [ ] **Step 1: Run a full pass at 375px**

With `npm run dev` running, open DevTools device toolbar at 375px and visit every page:

| Page | What to check |
|------|--------------|
| `/` (home) | Comfortable padding, no horizontal overflow |
| `/week` | Table scrolls horizontally, labels readable |
| `/calendar` | Grid scrolls horizontally, events legible |
| `/meals` | Cards reflow to 1-col, detail header stacks |
| `/shopping` | Single column, comfortable padding |
| `/settings` | Sidebar becomes horizontal tab strip, inputs full-width |
| `/imprint` | Text readable, comfortable padding |
| `/privacy` | Text readable, comfortable padding |
| Navbar | Hamburger visible, dropdown works, closes on navigate |

- [ ] **Step 2: Run a full pass at desktop (1280px)**

Confirm no regressions — all desktop layouts unchanged.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Final commit if any touch-ups made**

```bash
git add -p   # stage only intentional changes
git commit -m "fix: mobile smoke check touch-ups"
```
