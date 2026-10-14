import { MealType, Diet } from "@prisma/client"

export function isMealType(v: unknown): v is MealType {
  return typeof v === "string" && (Object.values(MealType) as string[]).includes(v)
}

export function isDiet(v: unknown): v is Diet {
  return typeof v === "string" && (Object.values(Diet) as string[]).includes(v)
}
