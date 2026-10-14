// src/app/api/meals/[id]/image/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { writeFile, mkdir, unlink, readFile } from "fs/promises"
import path from "path"
import { MEAL_IMAGE_UPLOAD_DIR as UPLOAD_DIR, findStoredMealImage as findStoredFile } from "@/lib/mealImages"

type Params = { params: Promise<{ id: string }> }

// Served through this route handler rather than Next's static /public folder:
// in production, Next's router snapshots public/ once at server boot, so files
// written here at runtime 404 until the next restart. Reading them back via a
// route handler re-reads the filesystem on every request instead.
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
}

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = session.user.familyId
  if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const meal = await prisma.meal.findFirst({ where: { id, familyId } })
  if (!meal?.imageUrl) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const filename = await findStoredFile(id)
  if (!filename) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const ext = filename.split(".").pop() ?? ""
  const buffer = await readFile(path.join(UPLOAD_DIR, filename))
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    },
  })
}

export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = session.user.familyId
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

  // Remove any previously stored file for this meal
  const existing = await findStoredFile(id)
  if (existing) await unlink(path.join(UPLOAD_DIR, existing)).catch(() => {})

  const filename = `${id}-${Date.now()}.${ext}`
  const filepath = path.join(UPLOAD_DIR, filename)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filepath, buffer)

  const imageUrl = `/api/meals/${id}/image`
  const updated = await prisma.meal.update({ where: { id }, data: { imageUrl } })

  return NextResponse.json({ meal: updated })
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = session.user.familyId
  if (!familyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const meal = await prisma.meal.findFirst({ where: { id, familyId } })
  if (!meal) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const existing = await findStoredFile(id)
  if (existing) await unlink(path.join(UPLOAD_DIR, existing)).catch(() => {})

  const updated = await prisma.meal.update({ where: { id }, data: { imageUrl: null } })
  return NextResponse.json({ meal: updated })
}
