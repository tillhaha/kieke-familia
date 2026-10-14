/**
 * One-off script: create a fresh family + credentials user for local testing.
 *
 * Usage:
 *   npx tsx scripts/seed-test-user.ts
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import bcrypt from "bcryptjs"

const { Pool } = pg

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool as Parameters<typeof PrismaPg>[0])
const prisma = new PrismaClient({ adapter })

async function main() {
  const family = await prisma.family.create({
    data: {
      name: "Test Family",
      joinCode: "TESTCODE",
    },
  })

  const passwordHash = await bcrypt.hash("testpass123", 10)
  const user = await prisma.user.create({
    data: {
      username: "testuser",
      passwordHash,
      name: "Test User",
      familyId: family.id,
      role: "ADMIN",
      active: true,
    },
  })

  console.log("Created family:", family.id)
  console.log("Created user:", user.id, user.username)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
