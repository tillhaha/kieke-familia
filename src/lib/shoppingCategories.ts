// src/lib/shoppingCategories.ts
// Shopping categories are stored per family as plain names. The built-in ones
// are seeded with English names; this maps them to the UI language for display.
// Custom (user-created or renamed) categories are shown exactly as stored.
import type { Translations } from "@/lib/i18n"

export function categoryLabel(name: string, t: Translations): string {
  return t.shopping.defaultCategories[name] ?? name
}
