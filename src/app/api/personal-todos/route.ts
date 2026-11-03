// src/app/api/personal-todos/route.ts
// Private todo list of the signed-in user. Scoped by userId, never by family.
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { captureThoughts } from "@/lib/personalTodos"

const MAX_TEXT_LENGTH = 5000

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const includeDone = new URL(request.url).searchParams.get("includeDone") === "true"
  try {
    const todos = await prisma.personalTodo.findMany({
      where: { userId, ...(includeDone ? {} : { done: false }) },
      orderBy: [{ createdAt: "desc" }],
    })
    return NextResponse.json({ todos })
  } catch (err) {
    console.error("[GET /api/personal-todos]", err)
    return NextResponse.json({ error: "Failed to fetch todos" }, { status: 500 })
  }
}

// Body: { text } — a free-text brain dump, split and categorised by Claude.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { text } = (body ?? {}) as Record<string, unknown>
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 })
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "Text too long" }, { status: 400 })
  }

  try {
    const todos = await captureThoughts(userId, text)
    return NextResponse.json({ todos }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/personal-todos]", err)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
