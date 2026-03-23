// src/app/api/user/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as any).id as string | undefined
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const { name } = body as Record<string, unknown>
  if (name !== undefined && typeof name !== "string") {
    return NextResponse.json({ error: "name must be a string" }, { status: 400 })
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name: typeof name === "string" && name.trim() ? name.trim() : null },
      select: { id: true, name: true, email: true },
    })
    return NextResponse.json({ user: updated })
  } catch (err) {
    console.error("[PATCH /api/user]", err)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
