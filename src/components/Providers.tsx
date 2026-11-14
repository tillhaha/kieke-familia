// components/Providers.tsx
"use client"

import { SessionProvider } from "next-auth/react"
import { LanguageProvider } from "@/lib/i18n/LanguageContext"
import { ThemeProvider } from "@/lib/theme/ThemeContext"
import { FamilyFeaturesProvider } from "./FamilyFeatures"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <LanguageProvider>
          <FamilyFeaturesProvider>{children}</FamilyFeaturesProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
