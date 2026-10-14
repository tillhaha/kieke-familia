// src/lib/mealImages.ts
import { readdir, unlink } from "fs/promises"
import path from "path"

export const MEAL_IMAGE_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "meals")

export async function findStoredMealImage(id: string) {
  let files: string[]
  try {
    files = await readdir(MEAL_IMAGE_UPLOAD_DIR)
  } catch {
    return null
  }
  return files.find((f) => f.startsWith(`${id}-`)) ?? null
}

export async function deleteStoredMealImage(id: string) {
  const existing = await findStoredMealImage(id)
  if (existing) await unlink(path.join(MEAL_IMAGE_UPLOAD_DIR, existing)).catch(() => {})
}
