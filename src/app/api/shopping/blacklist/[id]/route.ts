import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const familyId = (session.user as any).familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const { id } = await params
  const entry = await prisma.shoppingBlacklist.findFirst({ where: { id, familyId } })
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.shoppingBlacklist.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
