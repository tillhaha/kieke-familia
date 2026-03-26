# Responsive Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every page of Familia fully responsive across mobile (320–767px), tablet (768–1023px), and desktop (1024px+) using a consistent breakpoint system and polished mobile navigation.

**Architecture:** Keep CSS Modules as-is; establish a shared breakpoint reference comment in `globals.css`; replace the existing hamburger dropdown with a full-width slide-in drawer with a darkened backdrop; fix each page's layout with proper fluid containers and breakpoint-specific overrides. No external framework added — pure CSS with custom properties.

**Tech Stack:** Next.js 16, CSS Modules, CSS custom properties

---

## Current State Summary

- **Single breakpoint:** `768px` only — no tablet range
- **Fixed-width lists:** `tasks.module.css` has `min-width: 720px; max-width: 720px` on `.page` — trips on small screens even though the mobile block already clears `min-width` (the desktop value is the bug)
- **Navbar:** functional hamburger (`menuOpen` state → `navLinksOpen` CSS class) but uses `position: absolute` dropdown — replacing with `position: fixed` slide-in drawer + backdrop
- **Week grid:** `<table>` inside `.tableWrapper` (which already has `overflow-x: auto`) — needs `min-width` on `.table` and `padding: 0` on `.container` on mobile
- **Home grid:** `.grid` uses `repeat(auto-fill, minmax(220px, 1fr))` — already fluid; only the `.tasksWidget` (currently `max-width: 50%`) and padding need attention
- **Footer:** no mobile styles

---

## File Map

| File | Change |
|------|--------|
| `src/app/globals.css` | Document breakpoints; add fluid `.contentColumn` utility (optional for future use) |
| `src/components/Navbar.tsx` | Add `{menuOpen && <backdrop div />}` before closing `</header>` |
| `src/components/navbar.module.css` | Convert dropdown to fixed slide-in drawer; add backdrop styles |
| `src/components/footer.module.css` | Add mobile stacking styles |
| `src/app/page.module.css` | Make `.tasksWidget` fluid on tablet; ensure `.main` padding is consistent |
| `src/app/week/week.module.css` | Add tablet breakpoint; on mobile set `min-width` on `.table`, remove padding on `.container` |
| `src/app/calendar/calendar.module.css` | Add tablet breakpoint; polish `overflow-x: auto` wrapper |
| `src/app/tasks/tasks.module.css` | Remove `min-width: 720px` from desktop `.page`; filter bar wraps on mobile |
| `src/app/meals/meals.module.css` | Remove `min-width: 720px` from desktop `.container` |
| `src/app/shopping/shopping.module.css` | Remove `min-width: 720px` from desktop `.container` |
| `src/app/settings/settings.module.css` | Add tablet breakpoint for sidebar |

---

## Breakpoint Reference

```
--bp-sm: 480px   (phones in portrait)
--bp-md: 768px   (existing breakpoint — tablet portrait boundary)
--bp-lg: 1024px  (tablet landscape / small laptop)
```

All existing `@media (max-width: 768px)` rules remain valid and unchanged unless explicitly noted.

---

## Task 1: Globals — Breakpoint Documentation

**Files:**
- Modify: `src/app/globals.css`

No functional change — add a reference comment and a reusable `.contentColumn` utility for centered list pages (meals, tasks, shopping will use this pattern via their own CSS but having it in globals is useful for future pages).

- [ ] **Step 1: Read the file**

Run: `cat src/app/globals.css`

- [ ] **Step 2: Add at the bottom of globals.css** (after the existing `@media (max-width: 768px)` block)

```css
/* ─── Breakpoint reference ──────────────────────────────
 *   480px  phones (max-width: 480px)
 *   768px  tablet portrait / existing mobile breakpoint
 *   1024px tablet landscape / small desktop
 * ─────────────────────────────────────────────────────── */
```

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: document responsive breakpoints in globals.css"
```

---

## Task 2: Navbar Mobile Drawer

**Files:**
- Modify: `src/components/Navbar.tsx`
- Modify: `src/components/navbar.module.css`

**Context on current state:**
- `Navbar.tsx` uses `menuOpen` (JS state) to toggle the CSS class `navLinksOpen` on the nav links `<div>` (line 60)
- CSS already has `position: absolute` dropdown for mobile — replacing with `position: fixed` drawer
- The header structure is `<header> > <nav> > logo | hamburger | navLinks div | userSection div`
- Backdrop must sit outside `<nav>` to cover the full viewport; place it just before `</header>`

- [ ] **Step 1: Read both files**

```bash
cat src/components/Navbar.tsx
cat src/components/navbar.module.css
```

- [ ] **Step 2: Add backdrop to Navbar.tsx**

In `Navbar.tsx`, add the backdrop just before the closing `</header>` tag (after the `</nav>`):

```tsx
      </nav>

      {/* Backdrop — only rendered on mobile when drawer is open */}
      {menuOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </header>
```

- [ ] **Step 3: Update navbar.module.css**

Replace the existing `@media (max-width: 768px)` block entirely:

```css
/* Backdrop — hidden on desktop via display:none default */
.backdrop {
  display: none;
}

@media (max-width: 768px) {
  .hamburger {
    display: flex;
  }

  /* Slide-in drawer from the left */
  .navLinks {
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(280px, 85vw);
    background: var(--background);
    border-right: 1px solid var(--border);
    box-shadow: var(--shadow-md);
    padding: 4.5rem 0 1.5rem; /* top padding clears the navbar height */
    z-index: 200;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    overflow-y: auto;
    /* Override the desktop flex-row default */
    gap: 0;
  }

  .navLinks.navLinksOpen {
    transform: translateX(0);
  }

  .navLinks .navLink {
    padding: 0.875rem 1.5rem;
    min-height: 48px;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
    font-size: 1rem;
    justify-content: flex-start;
  }

  .navLinks .navLink:last-child {
    border-bottom: none;
  }

  /* Backdrop */
  .backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 199;
    animation: backdropIn 0.2s ease;
  }

  @keyframes backdropIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
}
```

- [ ] **Step 4: Verify**

Run `npm run dev`. Check:
- Desktop (>768px): horizontal nav bar, no drawer, no backdrop visible
- Mobile (<768px): hamburger visible; clicking opens drawer from left; backdrop darkens rest of page; clicking backdrop OR ✕ closes drawer; navigating to another page closes drawer (the `useEffect` on `pathname` already handles this)

- [ ] **Step 5: Commit**

```bash
git add src/components/Navbar.tsx src/components/navbar.module.css
git commit -m "style: replace mobile nav dropdown with slide-in drawer and backdrop"
```

---

## Task 3: Home Page Responsive

**Files:**
- Read: `src/app/page.tsx`, `src/app/page.module.css`
- Modify: `src/app/page.module.css`

**Context on current state:**
- `.main`: `max-width: 1100px`, `padding: 2rem 1.5rem` — fluid already
- `.grid`: `repeat(auto-fill, minmax(220px, 1fr))` — already responsive, no changes needed
- `.tasksWidget`: `max-width: 50%` on desktop — on tablet this becomes awkward; mobile override already sets `max-width: 100%`
- The mobile `@media` block is split across two rules (lines 219–224 and 322–327) — consolidate

- [ ] **Step 1: Read page.module.css**

Run: `cat src/app/page.module.css`

- [ ] **Step 2: Add tablet breakpoint for tasksWidget**

Add after the `.tasksWidgetLink:hover` rule and before the first `@media` block:

```css
/* Tablet: tasksWidget at 66% width so it doesn't dominate */
@media (max-width: 1023px) {
  .tasksWidget {
    max-width: 66%;
  }
}
```

- [ ] **Step 3: Consolidate the two mobile blocks**

The current file has two `@media (max-width: 768px)` blocks (one near top, one at bottom). Merge them into one at the bottom:

Replace the first one (lines ~219–224):
```css
/* (delete this block — content will merge below) */
```

Update the second one to include everything:
```css
@media (max-width: 768px) {
  .main {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  .greeting {
    font-size: 1.5rem;
  }

  .tasksWidget {
    max-width: 100%;
    margin-bottom: 1.5rem;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.module.css
git commit -m "style: home page — add tablet tasksWidget width, consolidate mobile blocks"
```

---

## Task 4: Week Page Responsive

**Files:**
- Read: `src/app/week/week.module.css` (already read — table-based layout)
- Modify: `src/app/week/week.module.css`

**Context on current state:**
- The week view is an HTML `<table>` inside `.tableWrapper` which already has `overflow-x: auto` and `border: 1px solid var(--border); border-radius: var(--radius)`
- `.cornerCell, .rowLabel` are `width: 120px; min-width: 120px`
- On mobile (current), row label shrinks to 56px but the 7 day columns still try to share remaining space — the table gets very cramped
- Fix: on mobile, give `.table` a `min-width` so columns stay readable, and let `.tableWrapper` scroll

- [ ] **Step 1: Add tablet breakpoint**

In `week.module.css`, add before the existing `@media (max-width: 768px)` block:

```css
/* Tablet: slightly smaller labels and headers */
@media (max-width: 1023px) {
  .container {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .cornerCell,
  .rowLabel {
    width: 80px;
    min-width: 80px;
  }

  .rowLabel {
    font-size: 0.6875rem;
    padding: 0.5rem 0.5rem;
  }

  .dayHeader {
    font-size: 0.7rem;
    padding: 0.5rem 0.25rem;
  }
}
```

- [ ] **Step 2: Update the mobile breakpoint**

Replace the existing `@media (max-width: 768px)` block:

```css
@media (max-width: 768px) {
  .container {
    padding-left: 0;
    padding-right: 0;
    gap: 1rem;
  }

  /* Let tableWrapper scroll; add side padding via inner padding trick */
  .tableWrapper {
    border-left: none;
    border-right: none;
    border-radius: 0;
    margin: 0;
  }

  /* Table wide enough that each day column is ~90px — readable */
  .table {
    min-width: 640px;
  }

  .cornerCell,
  .rowLabel {
    width: 60px;
    min-width: 60px;
  }

  .rowLabel {
    font-size: 0.625rem;
    padding: 0.5rem 0.25rem;
  }

  .dayHeader {
    font-size: 0.6rem;
    padding: 0.375rem 0.125rem;
  }

  /* Page header: stack on very small screens */
  .pageHeader {
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0 0.75rem;
  }
}

@media (max-width: 480px) {
  .table {
    min-width: 560px;
  }
}
```

- [ ] **Step 3: Verify**

Navigate to `/week`. At 375px: the table should be horizontally scrollable with usable column widths. The page header (title + button) should stack cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/app/week/week.module.css
git commit -m "style: week page — add tablet breakpoint, horizontal-scroll table on mobile"
```

---

## Task 5: Calendar Page Responsive

**Files:**
- Read: `src/app/calendar/calendar.module.css`
- Modify: `src/app/calendar/calendar.module.css`

**Context:** Calendar already has `min-width: 560px` on `.calendarGrid` in mobile breakpoint, and `.calendarContainer` has `overflow-x: auto`. This is correct. Polish and add tablet breakpoint.

- [ ] **Step 1: Read the file**

Run: `cat src/app/calendar/calendar.module.css`

- [ ] **Step 2: Add tablet breakpoint**

Add before the existing `@media (max-width: 768px)` block:

```css
@media (max-width: 1023px) {
  .calendarContainer {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .dayCell {
    min-height: 80px;
  }
}
```

- [ ] **Step 3: Ensure the mobile block is clean**

The existing mobile block should already handle the grid overflow. Verify it includes:

```css
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

@media (max-width: 480px) {
  .calendarGrid {
    min-width: 480px;
  }
}
```

> Keep existing rules that already match this. Only add/change what differs.

- [ ] **Step 4: Commit**

```bash
git add src/app/calendar/calendar.module.css
git commit -m "style: calendar — add tablet breakpoint, add 480px min-width for calendarGrid"
```

---

## Task 6: Tasks Page Responsive

**Files:**
- Modify: `src/app/tasks/tasks.module.css`

**Context on current state:**
- Desktop `.page`: `min-width: 720px; max-width: 720px` — the `min-width` breaks layout on screens narrower than 720px. The mobile block already sets `min-width: 0` but the desktop value overrides for screens 769px–720px
- Fix: remove `min-width: 720px` from the desktop rule
- Filter bar (`.filterBar`): `display: flex; gap: 0.5rem` — can overflow on narrow screens if there are many filters; make it wrap

- [ ] **Step 1: Remove min-width from desktop .page**

Find in `tasks.module.css`:
```css
.page {
  min-width: 720px;
  max-width: 720px;
```

Change to:
```css
.page {
  max-width: 720px;
```

- [ ] **Step 2: Make filterBar wrap on mobile**

In the existing `@media (max-width: 768px)` block, add:

```css
  .filterBar {
    flex-wrap: wrap;
  }
```

- [ ] **Step 3: Verify**

At 375px: the tasks page should fill the screen width, the filter bar should wrap if needed, modal should appear centered (`.modalOverlay` is already `position: fixed; inset: 0` — this works correctly as-is).

- [ ] **Step 4: Commit**

```bash
git add src/app/tasks/tasks.module.css
git commit -m "style: tasks page — remove fixed min-width, wrap filter bar on mobile"
```

---

## Task 7: Meals Page Responsive

**Files:**
- Read: `src/app/meals/meals.module.css`
- Modify: `src/app/meals/meals.module.css`

- [ ] **Step 1: Read the file**

Run: `cat src/app/meals/meals.module.css`

- [ ] **Step 2: Remove min-width from desktop .container**

Find the desktop `.container` rule. Remove the `min-width: 720px` line (keep `max-width: 720px`).

- [ ] **Step 3: Verify mobile block is intact**

The existing `@media (max-width: 768px)` should already have padding overrides. Confirm and keep them.

- [ ] **Step 4: Commit**

```bash
git add src/app/meals/meals.module.css
git commit -m "style: meals page — remove fixed min-width from container"
```

---

## Task 8: Shopping Page Responsive

**Files:**
- Read: `src/app/shopping/shopping.module.css`
- Modify: `src/app/shopping/shopping.module.css`

Same pattern as meals.

- [ ] **Step 1: Read the file**

Run: `cat src/app/shopping/shopping.module.css`

- [ ] **Step 2: Remove min-width from desktop .container**

Remove `min-width: 720px` (keep `max-width: 720px`).

- [ ] **Step 3: Commit**

```bash
git add src/app/shopping/shopping.module.css
git commit -m "style: shopping page — remove fixed min-width from container"
```

---

## Task 9: Settings Page Responsive

**Files:**
- Read: `src/app/settings/settings.module.css`
- Modify: `src/app/settings/settings.module.css`

**Context:** Settings sidebar converts to a horizontal scrolling tab row on mobile (768px). Add a tablet breakpoint to keep the sidebar visible but narrower.

- [ ] **Step 1: Read the file**

Run: `cat src/app/settings/settings.module.css`

- [ ] **Step 2: Add tablet breakpoint**

Add before the existing `@media (max-width: 768px)` block:

```css
/* Tablet: narrower sidebar, keep vertical layout */
@media (max-width: 1023px) {
  .container {
    gap: 1.5rem;
  }

  .sidebar {
    width: 160px;
    min-width: 140px;
    flex-shrink: 0;
  }

  .content {
    min-width: 0; /* Allow content column to shrink */
  }
}
```

> Adjust class names (`.container`, `.sidebar`, `.content`) to match what's actually in the file from step 1.

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/settings.module.css
git commit -m "style: settings — add tablet breakpoint, narrower sidebar on 768–1024px"
```

---

## Task 10: Footer Responsive

**Files:**
- Read: `src/components/Footer.tsx`, `src/components/footer.module.css`
- Modify: `src/components/footer.module.css`

- [ ] **Step 1: Read both files**

```bash
cat src/components/Footer.tsx
cat src/components/footer.module.css
```

- [ ] **Step 2: Add mobile block** (adjust selectors after reading)

```css
@media (max-width: 768px) {
  .inner {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.5rem;
    padding-top: 1rem;
    padding-bottom: 1rem;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/footer.module.css
git commit -m "style: footer — add mobile stacking styles"
```

---

## Task 11: Onboarding Page Responsive

**Files:**
- Read: `src/app/onboarding/page.module.css` (if it exists)
- Modify: `src/app/onboarding/page.module.css`

The onboarding folder is untracked (new feature in progress). If it has a CSS module, ensure it has mobile padding and a responsive card.

- [ ] **Step 1: Check if file exists and read it**

```bash
ls src/app/onboarding/
cat src/app/onboarding/page.module.css 2>/dev/null || echo "no css module"
```

- [ ] **Step 2: Add mobile styles if missing**

If the card has a fixed width or missing mobile override, add:

```css
@media (max-width: 768px) {
  .card {
    padding: 2rem 1.25rem;
    max-width: 100%;
  }
}
```

- [ ] **Step 3: Commit if changes made**

```bash
git add src/app/onboarding/
git commit -m "style: onboarding — ensure mobile padding on card"
```

---

## Task 12: Cross-Breakpoint QA

No code changes — visual verification only.

- [ ] **Step 1: Test each route at these viewport widths using Chrome DevTools (Cmd+Shift+M)**

| Width | Represents |
|-------|-----------|
| 375px | iPhone SE / common phone |
| 480px | Large phone landscape |
| 768px | Tablet portrait (breakpoint boundary) |
| 1024px | Tablet landscape |
| 1280px | Standard laptop |

- [ ] **Step 2: Checklist per page**

For each route (`/`, `/week`, `/calendar`, `/meals`, `/tasks`, `/shopping`, `/settings`):
- [ ] No horizontal overflow on `<body>` (check with DevTools "Dimensions" or `document.body.scrollWidth > window.innerWidth`)
- [ ] All text is readable — no truncation without accessible alternative
- [ ] All interactive elements ≥ 44px touch target height
- [ ] Navbar: drawer opens from left, backdrop visible, clicking backdrop closes it

- [ ] **Step 3: Fix issues per page, commit per fix**

```bash
git commit -m "style: fix [issue] on [page] at [breakpoint]"
```

---

## Summary

| Task | File(s) | Risk |
|------|---------|------|
| 1 — Foundation | globals.css | Low — comment only |
| 2 — Navbar drawer | Navbar.tsx + CSS | Medium — new fixed positioning |
| 3 — Home page | page.module.css | Low |
| 4 — Week grid | week.module.css | Medium — table layout |
| 5 — Calendar | calendar.module.css | Low |
| 6 — Tasks | tasks.module.css | Low — removing min-width |
| 7 — Meals | meals.module.css | Low |
| 8 — Shopping | shopping.module.css | Low |
| 9 — Settings | settings.module.css | Low |
| 10 — Footer | footer.module.css | Low |
| 11 — Onboarding | onboarding/page.module.css | Low |
| 12 — QA | Manual | Low |
