// src/app/api/meals/[id]/image/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { writeFile, mkdir, unlink } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

type Params = { params: Promise<{ id: string }> }

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "meals")
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const meal = await prisma.meal.findFirst({ where: { id, familyId } })
  if (!meal) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let formData: FormData
  try { formData = await request.formData() } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("image")
  if (!(file instanceof File)) return NextResponse.json({ error: "No image provided" }, { status: 400 })

  const ext = ALLOWED_TYPES[file.type]
  if (!ext) return NextResponse.json({ error: "Unsupported image type" }, { status: 400 })

  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Image too large (max 10 MB)" }, { status: 400 })

  await mkdir(UPLOAD_DIR, { recursive: true })

  // Remove previous uploaded image (not external URLs) if present
  if (meal.imageUrl?.startsWith("/uploads/meals/")) {
    const oldPath = path.join(process.cwd(), "public", meal.imageUrl)
    if (existsSync(oldPath)) await unlink(oldPath).catch(() => {})
  }

  const filename = `${id}.${ext}`
  const filepath = path.join(UPLOAD_DIR, filename)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filepath, buffer)

  const imageUrl = `/uploads/meals/${filename}`
  const updated = await prisma.meal.update({ where: { id }, data: { imageUrl } })

  return NextResponse.json({ meal: updated })
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const meal = await prisma.meal.findFirst({ where: { id, familyId } })
  if (!meal) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (meal.imageUrl?.startsWith("/uploads/meals/")) {
    const oldPath = path.join(process.cwd(), "public", meal.imageUrl)
    if (existsSync(oldPath)) await unlink(oldPath).catch(() => {})
  }

  const updated = await prisma.meal.update({ where: { id }, data: { imageUrl: null } })
  return NextResponse.json({ meal: updated })
}
