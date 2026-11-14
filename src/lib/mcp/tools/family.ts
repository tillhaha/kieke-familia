// src/lib/mcp/tools/family.ts
// Family members, week planner (meals, notes, work locations, custody) and recipes.
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { ISO_DATE, addDays, dateStr, dbDate, localClock, weekday } from "@/lib/localDate"
import { type McpTool, type ToolResult, text } from "../types"

const MAX_RANGE_DAYS = 31

function invalid(err: z.ZodError): ToolResult {
  return text(`Invalid arguments: ${err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")}`, true)
}

const DateRange = z.object({
  from: z.string().regex(ISO_DATE).optional(),
  to: z.string().regex(ISO_DATE).optional(),
})

/** Validated [from, to] (inclusive), defaulting to today + `defaultDays` - 1 */
function range(args: unknown, defaultDays: number, maxDays = MAX_RANGE_DAYS): { from: string; to: string } | ToolResult {
  const parsed = DateRange.safeParse(args ?? {})
  if (!parsed.success) return invalid(parsed.error)
  const from = parsed.data.from ?? localClock().date
  const to = parsed.data.to ?? addDays(from, defaultDays - 1)
  if (to < from) return text("`to` must not be before `from`.", true)
  if (dbDate(to).getTime() - dbDate(from).getTime() > (maxDays - 1) * 86_400_000) {
    return text(`At most ${maxDays} days at once.`, true)
  }
  return { from, to }
}

// ---------------------------------------------------------------------------
// Family members
// ---------------------------------------------------------------------------

async function listMembers(familyId: string): Promise<ToolResult> {
  const [members, children] = await Promise.all([
    prisma.user.findMany({
      where: { familyId, active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.custodySchedule.findMany({ where: { familyId }, distinct: ["personName"], select: { personName: true } }),
  ])
  const lines = members.map((m) => `- ${m.name ?? "?"} (id: ${m.id}, role: ${m.role.toLowerCase()})`)
  if (children.length) {
    lines.push("", `Children with a custody schedule (with us / with their other parent): ${children.map((c) => c.personName).join(", ")}`)
  }
  return text(lines.join("\n"))
}

// ---------------------------------------------------------------------------
// Week planner
// ---------------------------------------------------------------------------

async function getWeekPlan(familyId: string, args: unknown): Promise<ToolResult> {
  const r = range(args, 7)
  if ("content" in r) return r
  const where = { gte: dbDate(r.from), lte: dbDate(r.to) }
  const [days, members, work, custody] = await Promise.all([
    prisma.dayPlan.findMany({
      where: { familyId, date: where },
      include: { lunchMeal: { select: { id: true, name: true } }, dinnerMeal: { select: { id: true, name: true } } },
    }),
    prisma.user.findMany({ where: { familyId, active: true }, select: { id: true, name: true } }),
    prisma.workLocation.findMany({ where: { user: { familyId }, date: where } }),
    prisma.custodySchedule.findMany({ where: { familyId, date: where } }),
  ])
  const name = (userId: string) => members.find((m) => m.id === userId)?.name ?? "?"

  const lines: string[] = []
  for (let date = r.from; date <= r.to; date = addDays(date, 1)) {
    const day = days.find((d) => dateStr(d.date) === date)
    const parts: string[] = []
    if (!day) {
      parts.push("(week not planned yet)")
    } else {
      const meal = (label: string, value: string | null, note: string | null, recipe: { id: string; name: string } | null) => {
        if (!value && !note) return
        parts.push(`${label}: ${value ?? "–"}${recipe ? ` [recipe ${recipe.id}]` : ""}${note ? ` (${note})` : ""}`)
      }
      meal("Lunch", day.lunch, day.lunchNote, day.lunchMeal)
      meal("Dinner", day.dinner, day.dinnerNote, day.dinnerMeal)
      if (day.note) parts.push(`Note: ${day.note}`)
    }
    const dayWork = work.filter((w) => dateStr(w.date) === date)
    if (dayWork.length) {
      parts.push(`Work: ${dayWork.map((w) => `${name(w.userId)} ${w.location === "HOME" ? "from home" : "at the office"}`).join(", ")}`)
    }
    for (const c of custody.filter((c) => dateStr(c.date) === date)) {
      parts.push(`${c.personName}: ${c.location === "WITH_US" ? "with us" : "not with us"}`)
    }
    lines.push(`${date} (${weekday(date)}): ${parts.length ? parts.join(" | ") : "nothing entered"}`)
  }
  return text(lines.join("\n"))
}

const DayUpdate = z
  .object({
    date: z.string().regex(ISO_DATE),
    lunch: z.string().max(500).nullable().optional(),
    lunchNote: z.string().max(1000).nullable().optional(),
    lunchRecipeId: z.string().min(1).optional(),
    dinner: z.string().max(500).nullable().optional(),
    dinnerNote: z.string().max(1000).nullable().optional(),
    dinnerRecipeId: z.string().min(1).optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 1, { message: "Nothing to change" })

/** Make sure the Sun–Sat week containing `date` exists (like "+ next week" does). */
async function ensureWeek(familyId: string, date: string) {
  const sunday = addDays(date, -dbDate(date).getUTCDay())
  await prisma.dayPlan.createMany({
    data: Array.from({ length: 7 }, (_, i) => ({ date: dbDate(addDays(sunday, i)), familyId })),
    skipDuplicates: true,
  })
}

async function updateDay(familyId: string, args: unknown): Promise<ToolResult> {
  const parsed = DayUpdate.safeParse(args)
  if (!parsed.success) return invalid(parsed.error)
  const { date, lunchRecipeId, dinnerRecipeId, ...fields } = parsed.data

  const data: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) data[key] = value?.trim() ? value.trim() : null
  }
  // Free text replaces a linked recipe (like typing over it in the week planner)
  if (data.lunch !== undefined) data.lunchMealId = null
  if (data.dinner !== undefined) data.dinnerMealId = null
  for (const [field, recipeId] of [["lunch", lunchRecipeId], ["dinner", dinnerRecipeId]] as const) {
    if (!recipeId) continue
    const meal = await prisma.meal.findFirst({ where: { id: recipeId, familyId }, select: { id: true, name: true } })
    if (!meal) return text(`Unknown recipe id: ${recipeId}`, true)
    data[field] = meal.name
    data[`${field}MealId`] = meal.id
  }

  await ensureWeek(familyId, date)
  await prisma.dayPlan.update({ where: { date_familyId: { date: dbDate(date), familyId } }, data })
  const changed = Object.entries(data)
    .filter(([k]) => !k.endsWith("MealId"))
    .map(([k, v]) => `${k}: ${v ?? "(cleared)"}`)
  return text(`Updated ${date} (${weekday(date)}): ${changed.join(", ")}`)
}

const WorkLocationArgs = z.object({
  date: z.string().regex(ISO_DATE),
  userId: z.string().min(1),
  // NONE (or null from older clients) clears it
  location: z.enum(["HOME", "OFFICE", "NONE"]).nullable().transform((v) => (v === "NONE" ? null : v)),
})

async function setWorkLocation(familyId: string, args: unknown): Promise<ToolResult> {
  const parsed = WorkLocationArgs.safeParse(args)
  if (!parsed.success) return invalid(parsed.error)
  const { date, userId, location } = parsed.data
  const user = await prisma.user.findFirst({ where: { id: userId, familyId }, select: { name: true } })
  if (!user) return text(`Unknown family member id: ${userId}`, true)
  const day = dbDate(date)
  if (location === null) {
    await prisma.workLocation.deleteMany({ where: { date: day, userId } })
  } else {
    await prisma.workLocation.upsert({
      where: { date_userId: { date: day, userId } },
      create: { date: day, userId, location },
      update: { location },
    })
  }
  const label = location === null ? "not set" : location === "HOME" ? "working from home" : "at the office"
  return text(`${user.name ?? "?"} on ${date} (${weekday(date)}): ${label}`)
}

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

const RecipeSearch = z.object({
  query: z.string().trim().max(100).optional(),
  diet: z.enum(["Vegetarian", "Meat", "Fish"]).optional(),
  favoritesOnly: z.boolean().optional(),
  quickOnly: z.boolean().optional(),
  minServings: z.number().int().min(1).max(100).optional(),
  maxServings: z.number().int().min(1).max(100).optional(),
  limit: z.number().int().min(1).max(200).optional(),
})

async function searchRecipes(familyId: string, args: unknown): Promise<ToolResult> {
  const parsed = RecipeSearch.safeParse(args ?? {})
  if (!parsed.success) return invalid(parsed.error)
  const { query, diet, favoritesOnly, quickOnly, minServings, maxServings, limit = 60 } = parsed.data
  const meals = await prisma.meal.findMany({
    where: {
      familyId,
      ...(diet ? { diet } : {}),
      ...(favoritesOnly ? { favorite: true } : {}),
      ...(quickOnly ? { thirtyMinute: true } : {}),
      ...(minServings || maxServings ? { servings: { ...(minServings ? { gte: minServings } : {}), ...(maxServings ? { lte: maxServings } : {}) } } : {}),
      ...(query
        ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { ingredients: { has: query } }, { notes: { contains: query, mode: "insensitive" } }] }
        : {}),
    },
    select: { id: true, name: true, mealType: true, diet: true, servings: true, favorite: true, thirtyMinute: true, officeFriendly: true },
    orderBy: [{ favorite: "desc" }, { name: "asc" }],
    take: limit + 1,
  })
  if (!meals.length) return text("No matching recipes.")
  const more = meals.length > limit
  if (more) meals.pop()
  return text(
    meals
      .map((m) => {
        const tags = [m.mealType !== "Meal" ? m.mealType : null, m.diet, `serves ${m.servings}`, m.favorite && "favorite", m.thirtyMinute && "≤30 min", m.officeFriendly && "office-friendly"]
        return `- ${m.name} (id: ${m.id}; ${tags.filter(Boolean).join(", ")})`
      })
      .join("\n") + (more ? `\n… more than ${limit} found — narrow the search or raise limit (max 200).` : ""),
  )
}

async function getRecipe(familyId: string, args: unknown): Promise<ToolResult> {
  const parsed = z.object({ id: z.string().min(1) }).safeParse(args)
  if (!parsed.success) return invalid(parsed.error)
  const m = await prisma.meal.findFirst({ where: { id: parsed.data.id, familyId } })
  if (!m) return text("Recipe not found.", true)
  return text(
    [
      `${m.name} (id: ${m.id})`,
      `${m.mealType}, ${m.diet}, ${m.servings} servings${m.thirtyMinute ? ", ≤30 min" : ""}${m.favorite ? ", favorite" : ""}`,
      m.source ? `Source: ${m.source}` : "",
      m.notes ? `Notes: ${m.notes}` : "",
      "Ingredients:",
      ...m.ingredients.map((i) => `- ${i}`),
      "Steps:",
      ...m.steps.map((s, i) => `${i + 1}. ${s}`),
    ]
      .filter(Boolean)
      .join("\n"),
  )
}

// ---------------------------------------------------------------------------

const dateRangeSchema = {
  type: "object",
  properties: {
    from: { type: "string", description: "First day, YYYY-MM-DD (default: today)" },
    to: { type: "string", description: "Last day, YYYY-MM-DD, inclusive" },
  },
}

export const familyTools: McpTool[] = [
  {
    name: "list_family_members",
    description: "List the family members (with ids, needed for tasks and work locations) and the children who have a custody schedule.",
    inputSchema: { type: "object", properties: {} },
    handler: (auth) => listMembers(auth.familyId),
  },
  {
    name: "get_week_plan",
    description:
      "Read the family week planner for a date range (default: the next 7 days, max 31): lunch and dinner (with linked recipe ids), day notes, who works from home or at the office, and whether a child is with us.",
    inputSchema: { ...dateRangeSchema, properties: { ...dateRangeSchema.properties, to: { type: "string", description: "Last day, YYYY-MM-DD, inclusive (default: from + 6 days)" } } },
    handler: (auth, args) => getWeekPlan(auth.familyId, args),
  },
  {
    name: "update_day_plan",
    description:
      "Change one day in the week planner: lunch, dinner, their notes and the day note. Only the fields you pass are changed; pass \"\" to clear one. Pass lunchRecipeId / dinnerRecipeId (from search_recipes) to link a recipe instead of free text. Creates the week if it isn't planned yet.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        lunch: { type: "string" },
        lunchNote: { type: "string" },
        lunchRecipeId: { type: "string" },
        dinner: { type: "string" },
        dinnerNote: { type: "string" },
        dinnerRecipeId: { type: "string" },
        note: { type: "string", description: "Note for the whole day" },
      },
      required: ["date"],
    },
    handler: (auth, args) => updateDay(auth.familyId, args),
  },
  {
    name: "set_work_location",
    description: "Set where a family member works on a day: HOME (working from home), OFFICE, or NONE to clear. Get member ids from list_family_members.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        userId: { type: "string" },
        location: { type: "string", enum: ["HOME", "OFFICE", "NONE"] },
      },
      required: ["date", "userId", "location"],
    },
    handler: (auth, args) => setWorkLocation(auth.familyId, args),
  },
  {
    name: "search_recipes",
    description:
      "Search the family recipe library by name, ingredient or notes, and filter by diet, servings, favorites or quick (≤30 min). Without a query it lists recipes (favorites first). Each line shows type, diet and servings, so you rarely need get_recipe just to compare recipes.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        diet: { type: "string", enum: ["Vegetarian", "Meat", "Fish"] },
        favoritesOnly: { type: "boolean" },
        quickOnly: { type: "boolean", description: "Only recipes that take at most 30 minutes" },
        minServings: { type: "number", description: "At least this many servings" },
        maxServings: { type: "number", description: "At most this many servings" },
        limit: { type: "number", description: "Default 60, max 200" },
      },
    },
    handler: (auth, args) => searchRecipes(auth.familyId, args),
  },
  {
    name: "get_recipe",
    description: "Get a recipe with ingredients and steps by id.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    handler: (auth, args) => getRecipe(auth.familyId, args),
  },
]

export { range as dateRangeArgs, invalid as invalidArgs }
