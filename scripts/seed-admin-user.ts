/**
 * One-off script: create/upsert an "admin" credentials user in the given family.
 *
 * Usage (production):
 *   DATABASE_URL="postgresql://..." npx tsx scripts/seed-admin-user.ts
 *
 * Usage (local):
 *   npx tsx scripts/seed-admin-user.ts
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import bcrypt from "bcryptjs"

const { Pool } = pg

const USERNAME = "admin"
const PASSWORD = "password"
const FAMILY_NAME = "admin"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool as Parameters<typeof PrismaPg>[0])
const prisma = new PrismaClient({ adapter })

async function main() {
  // 1. Find the family
  const family = await prisma.family.findFirst({
    where: { name: { equals: FAMILY_NAME, mode: "insensitive" } },
    select: { id: true, name: true },
  })

  if (!family) {
    const all = await prisma.family.findMany({ select: { id: true, name: true } })
    console.error(`❌  No family named "${FAMILY_NAME}" found.`)
    console.error("   Existing families:", all.map((f) => `"${f.name}" (${f.id})`).join(", "))
    process.exit(1)
  }

  console.log(`✓  Family found: "${family.name}" (${family.id})`)

  // 2. Hash the password
  const passwordHash = await bcrypt.hash(PASSWORD, 12)

  // 3. Upsert the user
  const user = await prisma.user.upsert({
    where: { username: USERNAME },
    update: {
      passwordHash,
      familyId: family.id,
      active: true,
      role: "ADMIN",
    },
    create: {
      username: USERNAME,
      name: "Admin",
      passwordHash,
      active: true,
      role: "ADMIN",
      familyId: family.id,
    },
    select: { id: true, username: true, role: true, familyId: true },
  })

  console.log(`✓  User upserted:`, user)
  console.log(`\n   Login with username="${USERNAME}" password="${PASSWORD}"`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
