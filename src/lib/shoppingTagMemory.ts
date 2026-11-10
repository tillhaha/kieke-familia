// src/lib/shoppingTagMemory.ts
// Remembers which tags an item name was given, so re-adding it applies them by default
import { prisma } from "@/lib/prisma"
import { SHOPPING_TAGS, type ShoppingTag } from "@/lib/shoppingTags"

// Remembered tags for the given names, keyed by lowercased name
export async function getRememberedTags(familyId: string, names: string[]): Promise<Map<string, ShoppingTag[]>> {
  const itemNames = [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))]
  const result = new Map<string, ShoppingTag[]>()
  if (itemNames.length === 0) return result

  const memories = await prisma.shoppingItemTagMemory.findMany({
    where: { familyId, itemName: { in: itemNames } },
  })
  for (const m of memories) {
    // Drop tags that are no longer in the fixed list
    result.set(m.itemName, SHOPPING_TAGS.filter((tag) => m.tags.includes(tag)))
  }
  return result
}

// Overwrites the remembered tags for a name; an empty list forgets it
export async function rememberTags(familyId: string, name: string, tags: ShoppingTag[]): Promise<void> {
  const itemName = name.trim().toLowerCase()
  if (tags.length === 0) {
    await prisma.shoppingItemTagMemory.deleteMany({ where: { familyId, itemName } })
    return
  }
  await prisma.shoppingItemTagMemory.upsert({
    where: { familyId_itemName: { familyId, itemName } },
    update: { tags },
    create: { familyId, itemName, tags },
  })
}

// Tags for a newly added item: the ones given plus any remembered for its name
export function mergeTags(given: readonly ShoppingTag[] | undefined, remembered: readonly ShoppingTag[] | undefined): ShoppingTag[] {
  return SHOPPING_TAGS.filter((tag) => given?.includes(tag) || remembered?.includes(tag))
}
