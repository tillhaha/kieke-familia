# Meals Feature — Design Spec

## Goal

Add a family recipe library with a dedicated `/meals` page, and integrate meal search into the lunch/dinner cells of the week planner via a `/recipe` slash command.

---

## Data Model

### New: `Meal`

```prisma
model Meal {
  id          String   @id @default(cuid())
  name        String
  description String?
  servings    Int      @default(2)
  ingredients Json     // String[]
  steps       Json     // String[]
  familyId    String
  family      Family   @relation(fields: [familyId], references: [id])
  createdAt   DateTime @default(now())

  lunchDayPlans  DayPlan[] @relation("LunchMeal")
  dinnerDayPlans DayPlan[] @relation("DinnerMeal")
}
```

### Updated: `DayPlan`

Add two optional FK fields:

```prisma
lunchMealId    String?
lunchMeal      Meal?   @relation("LunchMeal",  fields: [lunchMealId],  references: [id])
dinnerMealId   String?
dinnerMeal     Meal?   @relation("DinnerMeal", fields: [dinnerMealId], references: [id])
```

The existing `lunch` and `dinner` text fields are kept. When a meal is selected via `/recipe`, both the meal name (text field) and its ID (FK) are stored. Free-text entries leave the FK null.

### Updated: `Family`

```prisma
meals Meal[]
```

---

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/meals?q=` | List meals for family; optional text search on `name` |
| POST | `/api/meals` | Create a new meal |
| GET | `/api/meals/[id]` | Fetch a single meal |
| PATCH | `/api/meals/[id]` | Update meal fields (partial) |
| DELETE | `/api/meals/[id]` | Delete a meal |

`PATCH /api/weeks/days/[date]` also accepts `lunchMealId` and `dinnerMealId` (nullable strings) alongside existing fields.

All routes are family-scoped (session `familyId`).

---

## Pages

### `/meals` — Recipe List

- Grid/list of recipe cards: name, description preview (truncated), servings count
- Each card links to `/meals/[id]`
- "New Recipe" button → navigates to `/meals/new`
- Matches the app's existing visual style (card-based, same nav)

### `/meals/new` — Create Recipe

- Form with fields: name, description, servings, ingredients (one per line in a textarea), steps (one per line in a textarea)
- "Save" button POSTs to `/api/meals` and redirects to `/meals/[id]`

### `/meals/[id]` — Recipe Detail

- All fields shown inline and editable (auto-save on blur, same pattern as week planner)
- Ingredients: list with add/remove per item
- Steps: numbered list with add/remove per item
- "Delete" button with confirmation
- Back link to `/meals`

---

## Week Planner Integration

### `/recipe` slash command

The lunch and dinner cells in `WeekBlock.tsx` detect the `/recipe` trigger:

1. User types `/recipe` in a lunch or dinner cell
2. Cell switches to **search mode**: the textarea is replaced with a search input and a floating dropdown beneath it
3. User continues typing → debounced fetch to `GET /api/meals?q=<query>`
4. Results shown in dropdown (name + servings)
5. **Select**: meal name written to the text field, `mealId` saved via PATCH, dropdown closed
6. **Escape or blur with no selection**: cell reverts to the text before `/recipe` was typed

### Preview mode (not focused)

When a meal FK is set on the day plan:
- Meal name shown in the cell preview as usual
- Small external-link icon (↗) rendered next to the name, opening `/meals/[id]` in a new tab

When no meal FK (free text): rendered as plain text / markdown as today.

---

## Out of Scope

- Meal categories or tags
- Nutritional information
- Importing recipes from URLs
- Images
- Sharing meals across families
