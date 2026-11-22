// src/lib/shoppingGenerate.ts
// Turns meals (MealSource from ./shoppingFromWeek) into shopping list items: Claude scales and
// merges the ingredients, then blacklisted and already-listed items are dropped, the rest is
// categorised and saved with a note naming the recipes. Used by "Add to shopping list" in the
// week planner (shopping/generate) and on a recipe page (meals/[id]/shopping).
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { categorizeShoppingItems } from "@/lib/shoppingCategorize"
import { type MealSource, describeSources } from "@/lib/shoppingFromWeek"

const client = new Anthropic()

const UnifiedSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.string().nullable(),
      recipes: z.array(z.string()),
    }),
  ),
})

const SYSTEM = `You are a shopping list assistant. Given the ingredients of the planned meals, return a clean, unified shopping list.

Rules:
- Each meal comes with a scaling instruction. Scale its quantities first (e.g. "multiply every quantity by 0.5": "400 g pasta" → "200 g", "1 onion" → "½ onion"), then merge. Round to sensible shopping amounts (whole eggs, ½ for produce, grams to 5–10 g); items without a quantity stay without one.
- For a meal whose ingredients are written in a note, read the ingredients out of that text (one per line or separated by commas) and use their quantities as written.
- Merge clearly identical ingredients and add up their (scaled) quantities (e.g. "2 chicken breasts" and "3 chicken pieces" → one "chicken breast" entry).
- For similar-but-potentially-different ingredients (e.g. "potatoes" and "small potatoes"), keep both but place them adjacent in the list.
- Strip quantities and units from the name field — put them in the quantity field (null if none).
- Strip all preparation descriptors from the name field — only keep the core ingredient (e.g. "garlic cloves, crushed" → "garlic", "olives, pitted and quartered lengthways" → "olive", "finely chopped onion" → "onion", "bone-in chicken thighs" → "chicken thigh").
- Normalise names to lowercase, singular where natural (e.g. "tomatoes" → "tomato").
- In "recipes", list the meal titles (exactly as written after "## ", without the part in brackets) that need this item, each title once.
- Return items in a logical shopping order (produce together, proteins together, etc.).`

/** Steps of the generation, reported when one fails so the UI can show why */
export type Stage = "load-week" | "load-recipe" | "ai" | "blacklist" | "existing-items" | "categorize" | "save"

export class ShoppingGenerateError extends Error {
  constructor(
    public stage: Stage,
    public cause: unknown,
  ) {
    super(`${stage} failed`)
  }
}

/** The real reason behind a failure: API status + message for Claude, otherwise the error message */
export function errorDetail(err: unknown): string {
  // Anthropic errors already start with the HTTP status, e.g. "404 {…not_found_error…}"
  if (err instanceof Anthropic.APIError) return `Anthropic ${err.message}`.slice(0, 500)
  const message = err instanceof Error ? err.message : String(err)
  // The answer was cut off (output limit) — say so instead of only the JSON parse error
  if (/structured output|Unterminated|Unexpected end of JSON/i.test(message)) {
    return `The AI answer was incomplete (probably too long): ${message}`.slice(0, 500)
  }
  return message.slice(0, 500)
}

/** 500 response + log line for a failed generation */
export function failureBody(err: unknown, fallbackStage: Stage) {
  const stage = err instanceof ShoppingGenerateError ? err.stage : fallbackStage
  const cause = err instanceof ShoppingGenerateError ? err.cause : err
  console.error(`[shopping/generate] ${stage} failed:`, cause)
  return { error: `Shopping list generation failed (${stage})`, stage, detail: errorDetail(cause) }
}

/** "Lasagne, Curry" — which meals an item is for (shown under the item on the list) */
function recipeNote(recipes: string[]): string | null {
  const unique = [...new Set(recipes.map((r) => r.trim()).filter(Boolean))]
  return unique.length ? unique.join(", ").slice(0, 300) : null
}

/**
 * Add the ingredients of these meals to the family's shopping list.
 * Returns how many new items were added; throws ShoppingGenerateError naming the failed step.
 */
export async function addMealsToShoppingList(familyId: string, sources: MealSource[]): Promise<{ added: number }> {
  if (sources.length === 0) return { added: 0 }

  // 1. Claude scales, merges and orders the ingredients
  let unified: Array<{ name: string; quantity: string | null; recipes: string[] }>
  try {
    const response = await client.messages.parse({
      model: "claude-haiku-4-5-20251001",
      // A full week with recipe notes per item easily needs more than 2k tokens; a cut-off
      // answer is invalid JSON. Only the tokens actually generated are billed.
      max_tokens: 16000,
      output_config: { format: zodOutputFormat(UnifiedSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: `Planned meals:\n\n${describeSources(sources)}` }],
    })
    if (!response.parsed_output) {
      throw new Error(`Claude returned no usable list (stop_reason: ${response.stop_reason ?? "?"})`)
    }
    unified = response.parsed_output.items
  } catch (err) {
    throw new ShoppingGenerateError("ai", err)
  }
  if (unified.length === 0) return { added: 0 }

  // 2. Drop blacklisted items: a term matches the normalised name exactly, so
  //    "onion" filters "onion" but not "spring onion", and "salt" never hits "unsalted butter"
  try {
    const blacklist = await prisma.shoppingBlacklist.findMany({ where: { familyId } })
    const terms = new Set(blacklist.map((b) => b.term.trim().toLowerCase()))
    unified = unified.filter((i) => !terms.has(i.name.trim().toLowerCase()))
  } catch (err) {
    throw new ShoppingGenerateError("blacklist", err)
  }
  if (unified.length === 0) return { added: 0 }

  // 3. Skip what's already on the list
  let newItems: typeof unified
  try {
    const existing = await prisma.shoppingItem.findMany({ where: { familyId }, select: { name: true } })
    const names = new Set(existing.map((i) => i.name.toLowerCase()))
    newItems = unified.filter((i) => !names.has(i.name.toLowerCase()))
  } catch (err) {
    throw new ShoppingGenerateError("existing-items", err)
  }
  if (newItems.length === 0) return { added: 0 }

  // 4. Categories: remembered mapping, then AI for unknown names
  let categoryMap: Map<string, string | null>
  try {
    categoryMap = await categorizeShoppingItems(familyId, newItems.map((i) => i.name))
  } catch (err) {
    throw new ShoppingGenerateError("categorize", err)
  }

  // 5. Insert in Claude's order, assigning sortOrder (atomic to avoid race conditions)
  try {
    await prisma.$transaction(async (tx) => {
      const max = await tx.shoppingItem.aggregate({ where: { familyId }, _max: { sortOrder: true } })
      const baseOrder = (max._max.sortOrder ?? -1) + 1
      await tx.shoppingItem.createMany({
        data: newItems.map((item, index) => ({
          familyId,
          name: item.name,
          quantity: item.quantity ?? null,
          note: recipeNote(item.recipes),
          categoryId: categoryMap.get(item.name.trim().toLowerCase()) ?? null,
          sortOrder: baseOrder + index,
        })),
      })
    })
  } catch (err) {
    throw new ShoppingGenerateError("save", err)
  }
  return { added: newItems.length }
}
