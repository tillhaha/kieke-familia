# Mobile Optimization Design

**Date:** 2026-03-23
**Scope:** Make Familia work well on mobile without rebuilding it as a mobile-first app.
**Approach:** Targeted fixes — one breakpoint, additive CSS, minimal component changes.

---

## Context

Familia is a desktop-first family management app. The primary users access it on desktop, but the app should work well when accessed on a phone. The current codebase has zero mobile breakpoints and no viewport meta tag, causing layouts to break on small screens.

---

## Approach: Targeted Fixes at 768px

One breakpoint (`768px`) applied consistently across all CSS modules. All changes are additive — existing desktop styles remain untouched. No mobile-first rewrite, no new dependencies, no breakpoint system.

---

## Section 1: Foundation

### Viewport Meta Tag (`src/app/layout.tsx`)
Export a `viewport` metadata object using Next.js's built-in API:
```ts
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};
```
This is the single most critical fix — without it, mobile browsers render a zoomed-out desktop view.

### Touch Target Baseline (`src/app/globals.css`)
Add a global rule ensuring all interactive elements meet the 44px minimum tap target (Apple/Google HIG):
```css
@media (max-width: 768px) {
  button, [role="button"] {
    min-height: 44px;
  }
}
```
Note: `<a>` tags are intentionally excluded from this global rule. Inline `<a>` elements (e.g. links inside text) are `display: inline` and `min-height` has no effect on them — but including them globally could cause unintended layout shifts on block-level links styled as buttons. Per-component overrides (e.g. nav links, sidebar buttons) apply `min-height: 44px` explicitly where needed.

### Breakpoint Convention
All mobile overrides use `@media (max-width: 768px)`. No CSS custom properties or breakpoint variables — just a consistent convention across all CSS modules.

---

## Section 2: Navbar — Hamburger Menu

**Files:** `src/components/Navbar.tsx`, `src/components/navbar.module.css`

### Component changes (`Navbar.tsx`)
The existing `Navbar.tsx` already uses `useState` (for `open`, the user dropdown), `usePathname`, `useEffect`, and `useRef`. The hamburger adds one new piece of state alongside these:

- Add a **second** `useState<boolean>` named `menuOpen` (distinct from the existing `open` for the user dropdown).
- Add a `☰` / `✕` button inside `<nav>` that toggles `menuOpen`. The button is hidden on desktop via CSS (`display: none`).
- Apply the open state to the `.navLinks` wrapper via a template literal: `` className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ''}`} ``.
- Add a `useEffect` that watches `pathname` and calls `setMenuOpen(false)` — this closes the hamburger menu on route change. (Pattern mirrors the existing `open` dropdown's close-on-outside-click effect.)

### CSS changes (`navbar.module.css`)
Two new classes (`.hamburger` and `.navLinksOpen`) plus mobile overrides for `.navLinks`:

```css
/* Desktop: hide hamburger button */
.hamburger { display: none; }

@media (max-width: 768px) {
  .hamburger { display: flex; }              /* show toggle button */
  .navLinks { display: none; }              /* hide links by default */
  .navLinks.navLinksOpen {                  /* show when toggled */
    display: flex;
    flex-direction: column;
    position: absolute;
    top: 100%;
    left: 0; right: 0;
    background: var(--background);
    padding: 0.5rem 0;
    z-index: 100;
  }
  .navLinks.navLinksOpen .navLink {
    padding: 0.75rem 1.5rem;
    min-height: 44px;
    border-bottom: 1px solid var(--border);
  }
}
```
Note: Use `.navLinksOpen` (not a generic `.open`) to avoid accidental reuse elsewhere in the module. Both classes get their own CSS Modules hash and the compound selector `.navLinks.navLinksOpen` matches only when both are on the same element. No third-party libraries. No new files.

---

## Section 3: Settings Page — Sidebar Stacking

**File:** `src/app/settings/settings.module.css`

The settings layout is `flex-row` with a fixed `180px` sidebar. On mobile it stacks to `flex-column`, and the sidebar becomes a horizontal scrollable tab strip:

```css
@media (max-width: 768px) {
  .container {
    flex-direction: column;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }
  .sidebar {
    width: 100%;
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
  .sidebarTitle {
    display: none;              /* hides the "Settings" label above the tab strip */
  }
  .sectionBtn {
    white-space: nowrap;
    padding: 0.75rem 1rem;
    min-height: 44px;
  }
  .fieldInput {
    max-width: 100%;            /* overrides desktop max-width: 320px */
  }
}
```
Note: the sidebar uses `.sectionBtn` (`<button>` elements), not `<a>` links. No component changes needed.

---

## Section 4: Page-by-Page CSS Fixes

All changes are `@media (max-width: 768px)` additions to the relevant CSS module.

### Global padding reduction (per CSS module)
Since `.container` and similar class names are CSS Module-scoped, the padding override must be added to each relevant module's `@media (max-width: 768px)` block — it cannot be set from `globals.css`. The affected modules are: `page.module.css`, `week.module.css`, `calendar.module.css`, `meals.module.css`, `shopping.module.css`, `settings.module.css`.
```css
@media (max-width: 768px) {
  .container { padding-left: 0.75rem; padding-right: 0.75rem; }
}
```

### Week Planner (`week.module.css`)
- Reduce corner/row label cell width: `80px → 56px` (target the `.cornerCell` and row label classes)
- Reduce day column header font size to `0.65rem` to help labels fit narrow columns
- **No JSX change needed:** `WeekBlock.tsx` already renders day names using `{ weekday: "short" }` (e.g. "Mon"), so labels are already abbreviated. The fix is purely CSS font size + cell width. Table already has `overflow-x: auto` — no structural change needed.

### Calendar (`calendar.module.css`)
- Reduce day cell `min-height`: `110px → 70px`
- Reduce font size on day numbers and event pills
- **Important:** At 375px viewport, a 7-column grid yields ~53px per column — this is very tight. Wrap the calendar grid in `overflow-x: auto` on mobile so users can scroll horizontally rather than seeing a crushed layout. The alternative (switching to a list view on mobile) is out of scope for this iteration.

### Meals Detail (`meals.module.css`)
- The detail page styles (`.detailContainer`, `.detailHeader`) are in the same `meals.module.css` file as the list page.
- `.detailHeader` uses `justify-content: space-between` in a row — change to `flex-direction: column` on mobile so title and action buttons stack cleanly.

### Shopping, Home (`shopping.module.css`, `page.module.css`)
- Already single-column — only padding reduction needed

---

## General Mobile Guidelines

These rules apply to all future pages, components, and features added to Familia:

### Layout
- **One breakpoint:** Use `@media (max-width: 768px)` exclusively. Do not introduce additional breakpoints unless a specific layout genuinely requires it.
- **Additive overrides:** Write desktop styles first. Add mobile overrides in a `@media (max-width: 768px)` block at the bottom of each CSS module.
- **Padding:** Use `1.5rem` side padding on desktop; reduce to `0.75rem` on mobile.
- **Max-widths:** Keep existing max-widths — they center content on desktop and work fine on mobile when combined with correct padding.
- **No fixed widths in flex rows:** Avoid `width: NNpx; flex-shrink: 0` patterns in flex containers. Either use percentages or ensure the layout stacks at `768px`.

### Navigation
- All new nav items must be included in the hamburger menu on mobile.
- Do not add navigation elements outside the Navbar component.

### Touch Targets
- Every interactive element (button, link, input, toggle) must have `min-height: 44px` on mobile.
- Inputs should be `font-size: 16px` minimum to prevent iOS auto-zoom on focus.

### Typography
- Do not use `font-size` below `14px` for body text on mobile.
- Long labels may be abbreviated on mobile using CSS (shorter `content` via `::after`, or separate hidden/shown spans with `display: none`).

### Forms & Inputs
- Inputs must be `width: 100%` on mobile — no fixed-width inputs.
- Stack label + input vertically on mobile (avoid inline label/input pairs).
- Use `inputmode` and `type` attributes appropriately (`type="email"`, `type="number"`, `inputmode="decimal"`) to trigger the correct mobile keyboard.

### Modals & Popovers
- Modals must have a `padding` on their backdrop container to prevent them from touching screen edges.
- Max-width of `calc(100vw - 2rem)` on mobile to ensure they fit.
- Popovers that are absolutely positioned must be checked for viewport overflow on small screens.

### Testing
- When adding or modifying a page/component, resize the browser to `375px` width (iPhone SE) and `768px` (tablet boundary) to verify the layout before committing.
- Pay particular attention to: flex rows that may not wrap, fixed widths, and absolute-positioned elements.

---

## Files to Change

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Add `viewport` export |
| `src/app/globals.css` | Touch target baseline, padding reduction |
| `src/components/Navbar.tsx` | Hamburger toggle state, close-on-navigate |
| `src/components/navbar.module.css` | Hamburger button, mobile nav dropdown |
| `src/app/settings/settings.module.css` | Sidebar stacking → tab strip, padding reduction, fieldInput full-width |
| `src/app/week/week.module.css` | Cell width + font size reduction |
| `src/app/calendar/calendar.module.css` | Cell height + font size reduction |
| `src/app/meals/meals.module.css` | Detail header stacking |
| `src/app/shopping/shopping.module.css` | Padding reduction |
| `src/app/page.module.css` | Padding reduction |

---

## Out of Scope

- Mobile-first rewrite of any page
- New breakpoints beyond `768px`
- PWA / installable app features
- Touch gesture support (swipe navigation, etc.)
- Performance optimization (image sizing, lazy loading)
