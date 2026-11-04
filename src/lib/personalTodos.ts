// src/lib/personalTodos.ts
// The "Gedanken" assistant: turns a free-text brain dump into categorised
// items on the user's private todo list. Shared by the API route and MCP tools.
// Every query here is scoped to a single userId — these items are private.
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { buildLifeContext } from "@/lib/personalProfile"
import type { PersonalTodo } from "@prisma/client"

const client = new Anthropic()

export const FALLBACK_CATEGORY = "Inbox"
const MAX_CATEGORY_LENGTH = 40

const CaptureSchema = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      note: z.string().nullable(),
      category: z.string(),
      dueDate: z.string().nullable(),
    })
  ),
})

type CaptureItem = { title: string; note: string | null; category: string; dueDate: Date | null }

function parseDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  return isNaN(d.getTime()) ? null : d
}

export async function listCategories(userId: string): Promise<string[]> {
  const rows = await prisma.personalTodo.groupBy({
    by: ["category"],
    where: { userId },
    _count: { _all: true },
    orderBy: { _count: { category: "desc" } },
  })
  return rows.map((r) => r.category)
}

async function splitAndCategorize(text: string, categories: string[], today: string, lifeContext: string): Promise<CaptureItem[]> {
  const contextBlock = lifeContext
    ? `\n\nWhat you know about the person (private, from their profile and the family app):\n<life_context>\n${lifeContext}\n</life_context>\nUse this to understand who and what they mean ("Mama", "her birthday", "the bathroom") and file things better: write titles with the real names, pick fitting categories, add a short note with relevant facts from the context (e.g. "Mia wird 10"), and when a todo clearly hinges on a known date (e.g. a present for a birthday) use that date as dueDate unless the person gave another. Only use facts that are in the context or the brain dump — never invent any. Don't create items from the context itself, only from the brain dump.`
    : ""

  const response = await client.messages.parse({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    output_config: { format: zodOutputFormat(CaptureSchema) },
    system: `You are a personal assistant that files a person's thoughts into their private todo list.
The person sends you a quick, unstructured brain dump (any language, often German). Turn it into list items:
- Split it into separate, self-contained items — one per todo, idea or thought. Don't merge unrelated things, don't split one thing into many.
- title: short and actionable, in the language the person wrote in (e.g. "Zahnarzttermin vereinbaren"). Keep names, numbers and details.
- note: extra context worth keeping that doesn't fit the title, otherwise null. Never invent details.
- category: a short label (1–2 words) in the person's language. Strongly prefer one of their existing categories when it fits; only create a new one when none does. Use broad, reusable categories (e.g. "Arbeit", "Haushalt", "Gesundheit", "Einkaufen", "Ideen", "Finanzen", "Familie") rather than very specific ones.
- dueDate: YYYY-MM-DD only if a date or deadline is stated or clearly implied ("morgen", "bis Freitag", "nächste Woche"); resolve relative dates against today. Otherwise null.
Today is ${today}.${contextBlock}`,
    messages: [
      {
        role: "user",
        content: `Existing categories: ${categories.length ? categories.join(", ") : "(none yet)"}

Brain dump:
${text}`,
      },
    ],
  })

  const existing = new Map(categories.map((c) => [c.toLowerCase(), c]))
  return (response.parsed_output?.items ?? [])
    .filter((i) => i.title.trim())
    .map((i) => {
      const raw = i.category.trim().slice(0, MAX_CATEGORY_LENGTH) || FALLBACK_CATEGORY
      return {
        title: i.title.trim(),
        note: i.note?.trim() || null,
        // Reuse the existing spelling so "arbeit" and "Arbeit" don't become two groups
        category: existing.get(raw.toLowerCase()) ?? raw,
        dueDate: parseDate(i.dueDate),
      }
    })
}

// Files a brain dump. If the AI call fails the text is kept as a single
// uncategorised item so nothing the user sent is ever lost.
export async function captureThoughts(userId: string, text: string): Promise<PersonalTodo[]> {
  const trimmed = text.trim()
  if (!trimmed) return []

  const [categories, lifeContext] = await Promise.all([
    listCategories(userId),
    buildLifeContext(userId).catch((err) => {
      console.error("[personalTodos] life context error:", err)
      return ""
    }),
  ])
  const today = new Date().toISOString().slice(0, 10)

  let items: CaptureItem[]
  try {
    items = await splitAndCategorize(trimmed, categories, today, lifeContext)
  } catch (err) {
    console.error("[personalTodos] Claude capture error:", err)
    items = []
  }
  if (items.length === 0) {
    items = [{ title: trimmed.slice(0, 200), note: trimmed.length > 200 ? trimmed : null, category: FALLBACK_CATEGORY, dueDate: null }]
  }

  return prisma.$transaction(items.map((item) => prisma.personalTodo.create({ data: { userId, ...item } })))
}
