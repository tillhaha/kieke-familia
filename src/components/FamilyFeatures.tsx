// src/components/FamilyFeatures.tsx
// The family's optional modules (heating, custody, calendar title) for the whole app.
// `features` is null until loaded — callers hide optional UI until then.
"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import type { FamilyFeatures } from "@/lib/familyFeatureTypes"

type Ctx = { features: FamilyFeatures | null; reload: () => void }
const FamilyFeaturesContext = createContext<Ctx>({ features: null, reload: () => {} })

export function FamilyFeaturesProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const familyId = session?.user?.familyId
  const [features, setFeatures] = useState<FamilyFeatures | null>(null)

  const reload = useCallback(() => {
    if (!familyId) return
    fetch("/api/family")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.family?.features && setFeatures(d.family.features))
      .catch(() => {})
  }, [familyId])

  useEffect(() => {
    reload()
  }, [reload])

  return <FamilyFeaturesContext.Provider value={{ features: familyId ? features : null, reload }}>{children}</FamilyFeaturesContext.Provider>
}

export function useFamilyFeatures() {
  return useContext(FamilyFeaturesContext)
}
