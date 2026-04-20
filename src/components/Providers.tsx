// components/Providers.tsx
"use client"

import { SessionProvider } from "next-auth/react"
import { LanguageProvider } from "@/lib/i18n/LanguageContext"
import { ThemeProvider } from "@/lib/theme/ThemeContext"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
