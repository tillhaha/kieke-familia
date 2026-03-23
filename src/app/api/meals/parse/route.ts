// src/app/api/meals/parse/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"

const ParsedRecipeSchema = z.object({
  name: z.string(),
  mealType: z.enum(["Meal", "Snack", "Drink", "Baked"]),
  diet: z.enum(["Vegetarian", "Meat", "Fish"]),
  servings: z.number().int().min(1).max(99),
  officeFriendly: z.boolean(),
  thirtyMinute: z.boolean(),
  ingredients: z.array(z.string()),
  steps: z.array(z.string()),
  notes: z.string().nullable(),
})

const client = new Anthropic()

function isUrl(text: string): boolean {
  try {
    const url = new URL(text.trim())
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function extractOgImage(html: string): string | null {
  const match =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  return match?.[1] ?? null
}

async function fetchPage(url: string): Promise<{ text: string; imageUrl: string | null }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; RecipeParser/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
  })
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`)
  const html = await res.text()

  const imageUrl = extractOgImage(html)

  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20000)

  return { text, imageUrl }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const { text } = body as Record<string, unknown>
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 })
  }

  let content = text.trim()
  let imageUrl: string | null = null
  let source: string | null = null

  if (isUrl(content)) {
    source = content
    try {
      const page = await fetchPage(content)
      content = page.text
      imageUrl = page.imageUrl
    } catch (err) {
      console.error("[parse] URL fetch failed:", err)
      return NextResponse.json({ error: "Could not fetch that URL." }, { status: 422 })
    }
  }

  try {
    const response = await client.messages.parse({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      output_config: {
        format: zodOutputFormat(ParsedRecipeSchema),
      },
      system: `You are a recipe parser. Extract structured recipe data from any text the user provides — including text scraped from recipe websites.

Rules:
- name: the recipe title
- mealType: "Meal" for main dishes, "Snack" for snacks/appetizers, "Drink" for beverages, "Baked" for baked goods
- servings: number of servings (default 2 if not stated)
- diet: "Vegetarian" if no meat or fish, "Fish" if it contains fish/seafood but no meat, "Meat" if it contains meat
- officeFriendly ("Office"): true only if the dish doesn't need reheating, has no strong smell, and can be eaten cold
- thirtyMinute ("Quick"): true only if total prep + cook time is ≤ 30 minutes
- ingredients: each ingredient as a separate string, preserving quantities and units
- steps: each step as a separate instruction string, without numbering. Where an ingredient is used in a step, append the exact quantity in parentheses at the end of that step — e.g. "Add the flour and mix until smooth (250g flour)". This avoids the reader having to scroll back to the ingredients list.
- notes: any tips, storage info, variations, or other info that doesn't fit above (null if none)`,
      messages: [{ role: "user", content }],
    })

    if (!response.parsed_output) {
      return NextResponse.json({ error: "Failed to parse recipe" }, { status: 422 })
    }

    return NextResponse.json({ recipe: { ...response.parsed_output, imageUrl, source } })
  } catch (err) {
    console.error("[POST /api/meals/parse]", err)
    return NextResponse.json({ error: "Failed to parse recipe" }, { status: 500 })
  }
}
