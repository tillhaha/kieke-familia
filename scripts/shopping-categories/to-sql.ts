/**
 * One-off script: turn result.json from the editor into a SQL file that applies
 * the same changes as apply.ts, for running against a database you can't reach
 * from here (e.g. production).
 *
 * Usage:
 *   npx tsx scripts/shopping-categories/to-sql.ts "<family name>" [result.json] > migrate.sql
 *   psql "$DATABASE_URL" -f migrate.sql
 *
 * The SQL looks the family up by name, runs in one transaction and is safe to re-run.
 */

import { readFileSync } from "fs"
import { resolve } from "path"

type Item = { name: string; category: string | null; want: "auto" | "buy" | "skip" }
type Term = { term: string; keep: boolean }
type Result = { categories: string[]; terms: Term[]; items: Item[] }

const [familyName, fileArg] = process.argv.slice(2)
if (!familyName) {
  console.error('Usage: to-sql.ts "<family name>" [result.json]')
  process.exit(1)
}
const data: Result = JSON.parse(readFileSync(resolve(fileArg ?? "scripts/shopping-categories/result.json"), "utf8"))

const q = (s: string) => `'${s.replace(/'/g, "''")}'`
const norm = (s: string) => s.trim().toLowerCase()

const wanted = new Set(data.terms.filter((t) => t.keep).map((t) => norm(t.term)))
for (const i of data.items) if (i.want === "skip") wanted.add(norm(i.name))
const removed = data.terms.filter((t) => !t.keep).map((t) => norm(t.term)).filter((t) => !wanted.has(t))
const withCat = data.items.filter((i) => i.category)
const withoutCat = data.items.filter((i) => !i.category).map((i) => norm(i.name))

const out: string[] = []
out.push(`-- Shopping categories + blacklist from scripts/shopping-categories/result.json`)
out.push(`-- Family: ${familyName}`)
out.push(`BEGIN;`)
out.push(`DO $$
DECLARE
  fam text;
  n int;
BEGIN
  SELECT count(*) INTO n FROM "Family" WHERE name = ${q(familyName)};
  IF n <> 1 THEN RAISE EXCEPTION 'Expected exactly one family named %, found %', ${q(familyName)}, n; END IF;
  SELECT id INTO fam FROM "Family" WHERE name = ${q(familyName)};
`)

out.push(`  -- Categories (new ones go to the end)`)
for (const name of data.categories) {
  out.push(`  INSERT INTO "ShoppingCategory" (id, "familyId", name, "order")
    SELECT gen_random_uuid()::text, fam, ${q(name)}, COALESCE(MAX("order"), -1) + 1 FROM "ShoppingCategory" WHERE "familyId" = fam
    ON CONFLICT ("familyId", name) DO NOTHING;`)
}

out.push(`\n  -- Item name → category`)
for (const i of withCat) {
  out.push(`  INSERT INTO "ShoppingItemMemory" (id, "familyId", "itemName", "categoryId")
    SELECT gen_random_uuid()::text, fam, ${q(norm(i.name))}, c.id FROM "ShoppingCategory" c WHERE c."familyId" = fam AND c.name = ${q(i.category!)}
    ON CONFLICT ("familyId", "itemName") DO UPDATE SET "categoryId" = EXCLUDED."categoryId";`)
}
if (withoutCat.length) {
  out.push(`  DELETE FROM "ShoppingItemMemory" WHERE "familyId" = fam AND "itemName" IN (${withoutCat.map(q).join(", ")});`)
}
out.push(`  -- Leftover memories saved with quantities/descriptions in the name`)
out.push(`  DELETE FROM "ShoppingItemMemory" WHERE "familyId" = fam AND "itemName" ~ '[0-9,(]';`)

out.push(`\n  -- Blacklist`)
if (removed.length) {
  out.push(`  DELETE FROM "ShoppingBlacklist" WHERE "familyId" = fam AND lower(term) IN (${removed.map(q).join(", ")});`)
}
for (const term of wanted) {
  out.push(`  INSERT INTO "ShoppingBlacklist" (id, "familyId", term) VALUES (gen_random_uuid()::text, fam, ${q(term)})
    ON CONFLICT ("familyId", term) DO NOTHING;`)
}
out.push(`END $$;`)
out.push(`COMMIT;`)

console.log(out.join("\n"))
