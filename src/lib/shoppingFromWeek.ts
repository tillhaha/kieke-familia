// src/lib/shoppingFromWeek.ts
// Which ingredients go on the shopping list for a planned week ("Add to shopping list").
//
// Rules (family guideline):
// - We cook for 2 servings by default: a linked recipe's quantities are scaled from its own
//   servings to 2 (a recipe for 4 is halved).
// - If the meal's note in the week planner says "x servings" / "x Portionen", we cook x instead.
// - A meal without a linked recipe takes its ingredients from that note.

export const DEFAULT_SERVINGS = 2

/** "3 servings", "4 Portionen", "für 6 Personen", "2 porciones" → the number, else null */
export function servingsFromNote(note: string | null | undefined): number | null {
  if (!note) return null
  const m = note.match(/(\d+(?:[.,]\d+)?)\s*(?:x\s*)?(servings?|portions?|portionen|personen|persons?|people|pers\.?|porci[oó]n(?:es)?|raci[oó]n(?:es)?)\b/i)
  if (!m) return null
  const n = Number(m[1].replace(",", "."))
  return n > 0 && n <= 50 ? n : null
}

type Recipe = { name: string; servings: number; ingredients: string[] }

export type MealSource = {
  date: string
  slot: "lunch" | "dinner"
  title: string
} & (
  | { kind: "recipe"; ingredients: string[]; recipeServings: number; targetServings: number; factor: number }
  | { kind: "note"; noteText: string }
)

/** One entry per planned meal that contributes ingredients */
export function mealSources(
  days: {
    date: Date
    lunch: string | null
    lunchNote: string | null
    lunchMeal: Recipe | null
    dinner: string | null
    dinnerNote: string | null
    dinnerMeal: Recipe | null
  }[],
): MealSource[] {
  const out: MealSource[] = []
  for (const day of days) {
    const date = day.date.toISOString().slice(0, 10)
    for (const slot of ["lunch", "dinner"] as const) {
      const recipe = slot === "lunch" ? day.lunchMeal : day.dinnerMeal
      const note = (slot === "lunch" ? day.lunchNote : day.dinnerNote)?.trim() || null
      const title = (slot === "lunch" ? day.lunch : day.dinner)?.trim() || recipe?.name || ""
      if (recipe) {
        if (!recipe.ingredients.length) continue
        const recipeServings = recipe.servings > 0 ? recipe.servings : DEFAULT_SERVINGS
        const targetServings = servingsFromNote(note) ?? DEFAULT_SERVINGS
        out.push({ date, slot, title: recipe.name, kind: "recipe", ingredients: recipe.ingredients, recipeServings, targetServings, factor: targetServings / recipeServings })
      } else if (note) {
        out.push({ date, slot, title, kind: "note", noteText: note })
      }
    }
  }
  return out
}

function factorText(f: number): string {
  return Number.isInteger(f) ? String(f) : String(Math.round(f * 1000) / 1000)
}

/** The ingredient list as given to the model that merges it into a shopping list */
export function describeSources(sources: MealSource[]): string {
  return sources
    .map((s) => {
      if (s.kind === "recipe") {
        const scale =
          s.factor === 1
            ? `recipe is for ${s.recipeServings} servings, we cook ${s.targetServings} — use quantities as written`
            : `recipe is for ${s.recipeServings} servings, we cook ${s.targetServings} — multiply every quantity by ${factorText(s.factor)}`
        return `## ${s.title} (${s.date} ${s.slot}; ${scale})\n${s.ingredients.map((i) => `- ${i}`).join("\n")}`
      }
      return `## ${s.title || "Meal"} (${s.date} ${s.slot}; no recipe — ingredients written in the planner note, quantities as written; ignore anything in the note that isn't an ingredient, e.g. a servings remark)\n${s.noteText}`
    })
    .join("\n\n")
}
