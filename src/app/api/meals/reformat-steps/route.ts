import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"

const ReformattedStepsSchema = z.object({
  steps: z.array(z.string()),
})

const client = new Anthropic()

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const { steps } = body as Record<string, unknown>
  if (!Array.isArray(steps) || steps.length === 0) {
    return NextResponse.json({ error: "steps array is required" }, { status: 400 })
  }

  try {
    const response = await client.messages.parse({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      output_config: {
        format: zodOutputFormat(ReformattedStepsSchema),
      },
      system: `You are a recipe formatter. Reformat the provided preparation steps into a clean, structured format.

Rules:
- Number every instruction step: "1. Do this", "2. Do that"
- Where the recipe has distinct phases (e.g. dough + sauce + assembly, or marinade + grill + serve), insert a bold group header as its own array item before that phase — e.g. "**Make the dough**". Only add group headers when the recipe genuinely has multiple distinct phases; omit them for simple single-phase recipes.
- Where an ingredient quantity appears in a step, keep or add it in parentheses at the end of that step — e.g. "1. Add the flour and mix until smooth (250g flour)".
- Preserve all existing content — only restructure, number, and group. Do not add or remove any cooking instructions.`,
      messages: [{ role: "user", content: (steps as string[]).join("\n") }],
    })

    if (!response.parsed_output) {
      return NextResponse.json({ error: "Failed to reformat steps" }, { status: 422 })
    }

    return NextResponse.json({ steps: response.parsed_output.steps })
  } catch (err) {
    console.error("[POST /api/meals/reformat-steps]", err)
    return NextResponse.json({ error: "Failed to reformat steps" }, { status: 500 })
  }
}
