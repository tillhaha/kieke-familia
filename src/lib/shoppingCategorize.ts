import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

const client = new Anthropic()

const CategorySchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      category: z.string().nullable(),
    })
  ),
})

// Picks categories for shopping items: first the remembered mapping, then one
// Claude call choosing among the family's own categories for the rest. AI picks
// are remembered so the next add of the same name is a plain lookup.
// Returns a map keyed by lowercased name; missing or null means uncategorised.
export async function categorizeShoppingItems(familyId: string, names: string[]): Promise<Map<string, string | null>> {
  const itemNames = [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))]
  const result = new Map<string, string | null>()
  if (itemNames.length === 0) return result

  const memories = await prisma.shoppingItemMemory.findMany({
    where: { familyId, itemName: { in: itemNames } },
  })
  for (const m of memories) result.set(m.itemName, m.categoryId)

  const unknown = itemNames.filter((n) => !result.has(n))
  if (unknown.length === 0) return result

  const categories = await prisma.shoppingCategory.findMany({
    where: { familyId },
    orderBy: { order: "asc" },
  })
  if (categories.length === 0) return result

  let picks: Array<{ name: string; category: string | null }>
  try {
    const response = await client.messages.parse({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      output_config: {
        format: zodOutputFormat(CategorySchema),
      },
      system: `You sort grocery items into supermarket categories. Given items (in any language) and the family's category names, return every item with its name exactly as given and the exact name of the best-fitting category, or null if none fits.`,
      messages: [
        {
          role: "user",
          content: `Categories:
${categories.map((c) => `- ${c.name}`).join("\n")}

Items:
${unknown.map((n) => `- ${n}`).join("\n")}`,
        },
      ],
    })
    picks = response.parsed_output?.items ?? []
  } catch (err) {
    console.error("[shopping] Claude categorisation error:", err)
    return result
  }

  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))
  const unknownSet = new Set(unknown)
  const learned: Array<{ itemName: string; categoryId: string }> = []
  for (const pick of picks) {
    const itemName = pick.name.trim().toLowerCase()
    const categoryId = categoryByName.get(pick.category?.trim().toLowerCase() ?? "")
    if (!unknownSet.has(itemName) || !categoryId || result.has(itemName)) continue
    result.set(itemName, categoryId)
    learned.push({ itemName, categoryId })
  }

  await prisma.shoppingItemMemory.createMany({
    data: learned.map((l) => ({ familyId, ...l })),
    skipDuplicates: true,
  })
  return result
}

export async function categorizeShoppingItem(familyId: string, name: string): Promise<string | null> {
  const result = await categorizeShoppingItems(familyId, [name])
  return result.get(name.trim().toLowerCase()) ?? null
}
