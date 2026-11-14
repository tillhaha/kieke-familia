// src/lib/familyFeatures.ts
// Optional modules a family can switch on or off (Settings → Family → Features).
import { prisma } from "@/lib/prisma"
import type { FamilyFeatures } from "./familyFeatureTypes"

export type { FamilyFeatures }

export const NO_FEATURES: FamilyFeatures = { heating: false, custody: false, calendarTitle: null }

export async function getFamilyFeatures(familyId: string): Promise<FamilyFeatures> {
  const f = await prisma.family.findUnique({
    where: { id: familyId },
    select: { heatingEnabled: true, custodyEnabled: true, calendarTitle: true },
  })
  return f ? { heating: f.heatingEnabled, custody: f.custodyEnabled, calendarTitle: f.calendarTitle } : NO_FEATURES
}
