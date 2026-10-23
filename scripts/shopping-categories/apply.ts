/**
 * One-off script: write the ingredient categorisation from the editor
 * (scripts/shopping-categories/editor.html → result.json) into the database.
 *
 * - creates categories that don't exist yet
 * - upserts ShoppingItemMemory (item name → category) for every item with a category
 * - syncs ShoppingBlacklist: active terms are added, switched-off terms removed,
 *   items set to "Nicht kaufen" get their own term (terms match item names exactly)
 *
 * Usage (dry run by default, prints what would change):
 *   npx tsx --env-file=.env scripts/shopping-categories/apply.ts [result.json]
 *   npx tsx --env-file=.env scripts/shopping-categories/apply.ts [result.json] --apply
 *
 * Optional: --family <id> (required if more than one family exists),
 *           --prune-raw (delete memories whose name still contains quantities/commas,
 *           left over from items added before names were normalised)
 */

import { readFileSync } from "fs"
import { resolve } from "path"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const { Pool } = pg

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool as Parameters<typeof PrismaPg>[0])
const prisma = new PrismaClient({ adapter })

type Item = {
  name: string
  aliases?: string[]
  category: string | null
  want: "auto" | "buy" | "skip"
  raw?: string[]
}
type Term = { term: string; keep: boolean }
type Result = { categories: string[]; terms: Term[]; items: Item[] }

const args = process.argv.slice(2)
const apply = args.includes("--apply")
const pruneRaw = args.includes("--prune-raw")
const familyArg = args.includes("--family") ? args[args.indexOf("--family") + 1] : undefined
const file = resolve(args.find((a) => a.endsWith(".json")) ?? "scripts/shopping-categories/result.json")

// The shopping list may name an ingredient in either language, so every alias gets the same treatment
const namesOf = (i: Item) => [...new Set([i.name, ...(i.aliases ?? [])].map((n) => n.trim().toLowerCase()))]

async function main() {
  const data: Result = JSON.parse(readFileSync(file, "utf8"))

  const families = await prisma.family.findMany({ select: { id: true, name: true } })
  const family = familyArg ? families.find((f) => f.id === familyArg) : families.length === 1 ? families[0] : undefined
  if (!family) {
    console.error("Pick a family with --family <id>:", families.map((f) => `${f.id} (${f.name})`).join(", "))
    process.exit(1)
  }
  const familyId = family.id
  console.log(`${apply ? "APPLY" : "DRY RUN"} for family "${family.name}" from ${file}\n`)

  // Categories
  const existingCats = await prisma.shoppingCategory.findMany({ where: { familyId } })
  const catId = new Map(existingCats.map((c) => [c.name, c.id]))
  let nextOrder = Math.max(-1, ...existingCats.map((c) => c.order)) + 1
  for (const name of data.categories) {
    if (catId.has(name)) continue
    console.log(`+ category   ${name}`)
    if (apply) {
      const created = await prisma.shoppingCategory.create({ data: { familyId, name, order: nextOrder++ } })
      catId.set(name, created.id)
    }
  }

  // Item memories
  const memories = await prisma.shoppingItemMemory.findMany({ where: { familyId } })
  const memByName = new Map(memories.map((m) => [m.itemName, m]))
  const catName = new Map(existingCats.map((c) => [c.id, c.name]))
  for (const item of data.items) for (const itemName of namesOf(item)) {
    const current = memByName.get(itemName)
    if (!item.category) {
      if (current) {
        console.log(`- memory     ${itemName} (was ${catName.get(current.categoryId)})`)
        if (apply) await prisma.shoppingItemMemory.delete({ where: { id: current.id } })
      }
      continue
    }
    if (current && catName.get(current.categoryId) === item.category) continue
    console.log(`~ memory     ${itemName} → ${item.category}${current ? ` (was ${catName.get(current.categoryId)})` : ""}`)
    if (apply) {
      const categoryId = catId.get(item.category)
      if (!categoryId) throw new Error(`Unknown category "${item.category}" for ${itemName}`)
      await prisma.shoppingItemMemory.upsert({
        where: { familyId_itemName: { familyId, itemName } },
        update: { categoryId },
        create: { familyId, itemName, categoryId },
      })
    }
  }

  if (pruneRaw) {
    const keep = new Set(data.items.flatMap(namesOf))
    for (const m of memories) {
      if (keep.has(m.itemName) || !/[\d,(]/.test(m.itemName)) continue
      console.log(`- memory     ${m.itemName} (raw leftover)`)
      if (apply) await prisma.shoppingItemMemory.delete({ where: { id: m.id } })
    }
  }

  // Blacklist
  const wanted = new Set(data.terms.filter((t) => t.keep).map((t) => t.term.trim().toLowerCase()))
  // Terms match the normalised item name exactly (see api/shopping/generate)
  const covers = (item: Item) => namesOf(item).some((n) => wanted.has(n))
  for (const item of data.items) {
    if (item.want === "skip") namesOf(item).forEach((n) => wanted.add(n))
  }
  const existingTerms = await prisma.shoppingBlacklist.findMany({ where: { familyId } })
  const have = new Set(existingTerms.map((t) => t.term.toLowerCase()))
  for (const t of existingTerms) {
    if (wanted.has(t.term.toLowerCase())) continue
    console.log(`- blacklist  ${t.term}`)
    if (apply) await prisma.shoppingBlacklist.delete({ where: { id: t.id } })
  }
  for (const term of wanted) {
    if (have.has(term)) continue
    console.log(`+ blacklist  ${term}`)
    if (apply) await prisma.shoppingBlacklist.create({ data: { familyId, term } })
  }

  const conflicts = data.items.filter((i) => i.want === "buy" && covers(i))
  if (conflicts.length) {
    console.log(`\n! Still filtered although set to "Immer kaufen": ${conflicts.map((i) => i.name).join(", ")}`)
    console.log("  Adjust the blacklist terms in the editor to resolve these.")
  }
  if (!apply) console.log("\nNothing written. Re-run with --apply to save.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
