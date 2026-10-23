import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateToken } from "@/lib/apiTokens"
import { NextResponse } from "next/server"

const tokenSelect = { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true }

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const tokens = await prisma.apiToken.findMany({
    where: { userId },
    select: tokenSelect,
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ tokens })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session?.user?.familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { name } = body as Record<string, unknown>
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 })
  }

  const { token, prefix, tokenHash } = generateToken()
  const created = await prisma.apiToken.create({
    data: { userId, name: name.trim(), prefix, tokenHash },
    select: tokenSelect,
  })

  // The plain token is returned only here; it cannot be recovered later
  return NextResponse.json({ ...created, token }, { status: 201 })
}
