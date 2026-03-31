# Visual Redesign — Design Spec
**Date:** 2026-03-31
**Status:** Approved

## Overview

Restyle the Familia app from its current generic warm-amber SaaS look to a distinctive **Nordic / Functional · Minimal / Airy** aesthetic using a Forest Green palette. The new design is clean, structured, and original — recognisably different from a Tailwind template.

No layout changes, no new features. CSS-only: update `globals.css` and all `*.module.css` files.

---

## Design Language

**Style:** Nordic / Functional — geometric structure, precision spacing, uppercase labels, clear hierarchy.
**Personality:** Minimal / Airy — generous whitespace, rounded cards, pill navigation, approachable without being cold.

---

## Color System

### Light mode
| Token | Value | Usage |
|---|---|---|
| `--background` | `#f8faf8` | Page background (green-tinted off-white) |
| `--foreground` | `#1a2e22` | Primary text |
| `--primary` | `#2d6a4f` | Accent, active states, CTA buttons |
| `--primary-hover` | `#245a42` | Hover on primary |
| `--secondary` | `#5a8a6a` | Secondary text, inactive nav |
| `--border` | `#d8e8dc` | Card borders, dividers |
| `--surface` | `#ffffff` | Card backgrounds |
| `--surface-hover` | `#eef6f1` | Hover state on surfaces |
| `--accent-soft` | `#e8f4ee` | Soft highlight backgrounds |
| `--accent-border` | `#c0ddc8` | Highlight card border (stronger than `--border`) |
| `--radius` | `8px` | Card border radius |
| `--shadow-sm` | `0 1px 3px rgba(45,106,79,0.08)` | Subtle card shadow |
| `--shadow-md` | `0 4px 16px rgba(45,106,79,0.12)` | Elevated card / dropdown shadow |

### Dark mode

All tokens below must be **added or updated** inside the `@media (prefers-color-scheme: dark)` block in `globals.css`. Note: `--primary`, `--primary-hover`, and `--secondary` do **not** exist in the current dark block — they must be added, not merely updated.

| Token | Dark value |
|---|---|
| `--background` | `#0f1a13` |
| `--foreground` | `#d4ead8` |
| `--primary` | `#52b788` ← **add this** |
| `--primary-hover` | `#3d9e70` ← **add this** |
| `--secondary` | `#3d6a4a` ← **add this** |
| `--border` | `#1e3328` |
| `--surface` | `#142010` |
| `--surface-hover` | `#1e3328` |
| `--accent-soft` | `#1e3328` |
| `--accent-border` | `#2d5040` |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.3)` |
| `--shadow-md` | `0 4px 16px rgba(0,0,0,0.4)` |

---

## Typography

- **Font stack:** unchanged — Geist Sans + Geist Mono via `next/font`
- **Eyebrow labels:** `9–10px`, `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: 0.1em`, color `var(--secondary)`
- **Page headings:** `font-weight: 300` for first part, `font-weight: 700` for name/emphasis (e.g. "Good morning, **Till**")
- **Section titles:** `10px`, uppercase, `var(--secondary)`, `border-bottom: 1px solid var(--border)`, `padding-bottom: 4px`
- **Body text:** `13–14px`, `color: var(--foreground)`
- **Meta / helper text:** `10–11px`, `color: var(--secondary)`

---

## Navbar

- Background: `var(--background)` (not white — blends with page)
- Border bottom: `1px solid var(--border)`
- **Logo:** `F` lettermark in a `22×22px` rounded square (`border-radius: 5px`) filled `var(--primary)`, white bold "F"; followed by `familia` in `13px font-weight: 600`
- **Nav links (desktop):** pill shape (`border-radius: 20px`), `11px font-weight: 500`, inactive color `var(--secondary)`
- **Active nav link (desktop):** filled pill — `background: var(--primary); color: #fff; font-weight: 600`
- **Active nav link (mobile drawer):** the mobile drawer forces `border-radius: 0` on nav links — do not apply the filled-pill background inside the drawer. Instead use `color: var(--primary); font-weight: 700; border-left: 3px solid var(--primary)` to indicate the active route, and compensate padding so text stays aligned.
- **User button:** `11px`, `var(--secondary)`, no background until hover

---

## Cards & Surfaces

- Background: `var(--surface)` (white)
- Border: `1px solid var(--border)` (green-tinted, not grey)
- Border radius: `var(--radius)` = `8px`
- Padding: `11px 13px` (compact but not cramped)
- **Highlight card** (e.g. tonight's dinner on homepage): `background: var(--accent-soft); border-color: var(--accent-border)`
- No heavy drop shadows on cards — use border only; reserve `--shadow-md` for dropdowns/modals

---

## Buttons

### Consolidated danger colour

There are currently three different danger reds in the codebase (`#dc2626`, `#e05252`, `#e11d48`). Unify all of them during this redesign:

| | Light | Dark |
|---|---|---|
| Danger text | `#c0392b` | `#e07070` |
| Danger surface (hover bg) | `#fdecea` | `#2d0a0a` |
| Danger border | `#c0392b` | `#e07070` |

Replace all three old reds with the above values wherever they appear — including `calendar.module.css` form/validation error rules (`.modalError`, `.custodyPopoverError`). Calendar **event chip** colours (birthday, travel, custody category chips) remain untouched.

### Button styles

- **Primary (CTA):** `background: var(--primary); color: #fff; border-radius: 20px; font-size: 11px; font-weight: 600; padding: 5px 12px`
- **Primary hover:** `background: var(--primary-hover)`
- **Ghost:** `border: 1px solid var(--border); color: var(--secondary); border-radius: 20px; background: transparent`
- **Ghost hover:** `border-color: var(--primary); color: var(--foreground)`
- **Danger text button:** `color: #c0392b` (dark: `#e07070`)
- **Danger hover:** `background: #fdecea` (dark: `#2d0a0a`)
- All buttons: `font-family: inherit`

---

## Form Inputs

- Border: `1px solid var(--border)`; border-radius: `7px`
- Background: `var(--surface)`
- Focus: `border-color: var(--primary)` (no box-shadow outline)
- Font size: `13px`

---

## Task rows

- Checkbox: `14px`, `border: 1.5px solid var(--primary)`, `border-radius: 3px`
- Completed: checkbox filled `var(--primary)`; text `color: #aaa; text-decoration: line-through`
- Overdue meta: `color: #d4604a` light / `color: #e08060` dark (warm red — not harsh)
- Row separator: `border-bottom: 1px solid var(--border)` on container; last child has no border

---

## Error & Status States

### Cell errors (week grid)
The current `.cellError` rule sets `background` only — `color` is absent. Both properties must be set:
- Light: `background: #fef2f2; color: #c0392b` (**add** `color`)
- Dark: `background: #2d1414; color: #e07070` (**add** `color`)

### Tooltips (`week.module.css` `.pillTooltip`)
- Light: keep current dark-background tooltip (`background: #1e293b; color: #f8fafc`) — this is intentional (dark tooltip on light bg for contrast)
- Dark mode: `background: #d4ead8; color: #0f1a13` (invert)

### Onboarding success state
- The onboarding file contains `#dcfce7 / #16a34a` for a success confirmation — these are coincidentally green and can remain as-is. No change needed.

### Onboarding error state
- `#ef4444` → replace with `#c0392b` (light) / `#e07070` (dark) for consistency with the unified danger colour.

---

## Calendar Event-Type Chips

The calendar contains ~50 hardcoded hex values for semantic event-type chips (birthday, travel, custody in pink/mauve, gold, teal/green tones). **These are intentional semantic colours and are explicitly out of scope.** Do not change calendar event chip colours. Only update `calendar.module.css` surface tokens: `--background`, `--surface`, `--border`, `--shadow-*` usage.

---

## Scope of Changes

| File | Key changes |
|---|---|
| `src/app/globals.css` | Replace all CSS custom properties; add `--accent-border` token; add `--primary`, `--primary-hover`, `--secondary` to dark-mode block |
| `src/components/navbar.module.css` | Pill active link, F logomark styles; mobile drawer active state uses border-left instead of filled pill |
| `src/app/page.module.css` | Card borders → green-tinted; highlight card uses `var(--accent-soft)` + `var(--accent-border)` |
| `src/app/tasks/tasks.module.css` | Section title style, task row styles, unified danger/overdue colours |
| `src/app/week/week.module.css` | Today column → `var(--accent-soft)`; header row → light green; cell error colours updated; tooltip dark-mode updated |
| `src/app/meals/meals.module.css` | Card + button updates |
| `src/app/shopping/shopping.module.css` | Input + button + card updates |
| `src/app/calendar/calendar.module.css` | Surface/border token updates only — event chip colours untouched |
| `src/app/settings/settings.module.css` | Input + card + section updates |
| `src/app/onboarding/page.module.css` | Button + input updates; `#ef4444` error → `#c0392b` / `#e07070` |
| `src/components/footer.module.css` | Already token-only — verify no regressions, no edits expected |
| `src/app/privacy/privacy.module.css` | Token-only surface/text updates if any hardcoded values exist |
| `src/app/imprint/imprint.module.css` | Token-only surface/text updates if any hardcoded values exist |

**No changes to:** component structure, layout, spacing logic, breakpoints, JS/TSX files, calendar event chip colours, onboarding success state.
