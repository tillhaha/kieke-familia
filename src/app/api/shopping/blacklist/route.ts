import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const terms = await prisma.shoppingBlacklist.findMany({
    where: { familyId },
    orderBy: { term: "asc" },
  })
  return NextResponse.json({ terms })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { term } = body
  if (!term || typeof term !== "string" || !term.trim()) {
    return NextResponse.json({ error: "term required" }, { status: 400 })
  }

  const normalized = term.trim().toLowerCase()
  try {
    const entry = await prisma.shoppingBlacklist.create({
      data: { familyId, term: normalized },
    })
    return NextResponse.json(entry, { status: 201 })
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Term already exists" }, { status: 409 })
    }
    console.error("Blacklist create error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
