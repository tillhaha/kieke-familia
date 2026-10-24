// src/lib/shoppingTags.ts
// Fixed set of tags that can be put on shopping items (e.g. which shop to buy them at)
export const SHOPPING_TAGS = ["Drogerie", "Asia"] as const
export type ShoppingTag = (typeof SHOPPING_TAGS)[number]

export function isShoppingTagList(value: unknown): value is ShoppingTag[] {
  return Array.isArray(value) && value.every((v) => (SHOPPING_TAGS as readonly unknown[]).includes(v))
}
