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
  button, a, [role="button"] {
    min-height: 44px;
  }
}
```

### Breakpoint Convention
All mobile overrides use `@media (max-width: 768px)`. No CSS custom properties or breakpoint variables — just a consistent convention across all CSS modules.

---

## Section 2: Navbar — Hamburger Menu

**Files:** `src/components/Navbar.tsx`, `src/components/navbar.module.css`

### Component changes (`Navbar.tsx`)
- Add `useState<boolean>` for `menuOpen` toggle.
- Add a `☰` / `✕` button rendered only on mobile (CSS `display: none` on desktop).
- Wrap nav links in a container that conditionally applies an `open` class.
- Use `usePathname()` from `next/navigation` to close the menu on route change (via `useEffect`).

### CSS changes (`navbar.module.css`)
```css
@media (max-width: 768px) {
  .hamburger { display: flex; }          /* show toggle button */
  .navLinks { display: none; }           /* hide links by default */
  .navLinks.open {                       /* show when toggled */
    display: flex;
    flex-direction: column;
    position: absolute;
    top: 100%;
    left: 0; right: 0;
    background: var(--navbar-bg);
    padding: 0.5rem 0;
    z-index: 100;
  }
  .navLinks.open a {
    padding: 0.75rem 1.5rem;
    min-height: 44px;
    border-bottom: 1px solid var(--border);
  }
}
```
No third-party libraries. No new files.

---

## Section 3: Settings Page — Sidebar Stacking

**File:** `src/app/settings/settings.module.css`

The settings layout is `flex-row` with a fixed `180px` sidebar. On mobile it stacks to `flex-column`, and the sidebar becomes a horizontal scrollable tab strip:

```css
@media (max-width: 768px) {
  .container {
    flex-direction: column;
  }
  .sidebar {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
  .sidebar a {
    white-space: nowrap;
    padding: 0.75rem 1rem;
    min-height: 44px;
  }
}
```

No component changes needed.

---

## Section 4: Page-by-Page CSS Fixes

All changes are `@media (max-width: 768px)` additions to the relevant CSS module.

### Global padding reduction (`globals.css` or per-module)
```css
.container, .pageContainer { padding-left: 0.75rem; padding-right: 0.75rem; }
```

### Week Planner (`week.module.css`)
- Reduce corner/row label cell width: `80px → 56px`
- Reduce day column header font size to fit abbreviations
- Table already has `overflow-x: auto` — no structural change needed

### Calendar (`calendar.module.css`)
- Reduce day cell `min-height`: `110px → 70px`
- Reduce font size on day numbers and event pills
- No grid structure change (7-col still works at smaller sizes)

### Meals Detail (`meals.module.css`)
- Detail page header uses `justify-content: space-between` in a row — change to `flex-direction: column` on mobile so title and action buttons stack cleanly

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
| `src/app/settings/settings.module.css` | Sidebar stacking → tab strip |
| `src/app/week/week.module.css` | Cell width reduction |
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
