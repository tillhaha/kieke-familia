import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool as ConstructorParameters<typeof PrismaPg>[0])
const prisma = new PrismaClient({ adapter })

const CATEGORIES = [
  { name: "Fruit/Vegetables", order: 0 },
  { name: "Meat",             order: 1 },
  { name: "Fish",             order: 2 },
  { name: "Milk Products",    order: 3 },
  { name: "Bread",            order: 4 },
  { name: "Canned, Glass",    order: 5 },
  { name: "Condiments",       order: 6 },
  { name: "Frozen",           order: 7 },
  { name: "Nuts/Snacks",      order: 8 },
  { name: "Drinks",           order: 9 },
]

const BLACKLIST_TERMS = [
  "flour",
  "garlic",
  "mustard",
  "oil",
  "onion",
  "onions",
  "pepper",
  "salt",
  "sugar",
  "vinegar",
  "water",
]

async function main() {
  const families = await prisma.family.findMany({ select: { id: true, name: true } })

  if (families.length === 0) {
    console.log("No families found — skipping seed.")
    return
  }

  for (const family of families) {
    console.log(`Seeding family: ${family.name} (${family.id})`)

    for (const cat of CATEGORIES) {
      await prisma.shoppingCategory.upsert({
        where: { familyId_name: { familyId: family.id, name: cat.name } },
        update: { order: cat.order },
        create: { familyId: family.id, name: cat.name, order: cat.order },
      })
    }
    console.log(`  ✓ ${CATEGORIES.length} categories`)

    for (const term of BLACKLIST_TERMS) {
      await prisma.shoppingBlacklist.upsert({
        where: { familyId_term: { familyId: family.id, term } },
        update: {},
        create: { familyId: family.id, term },
      })
    }
    console.log(`  ✓ ${BLACKLIST_TERMS.length} blacklist terms`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
