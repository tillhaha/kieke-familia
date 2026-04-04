"use client"

// src/lib/i18n/LanguageContext.tsx

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { translations, Translations } from "./index"

type LanguageContextValue = {
  lang: string
  t: Translations
  setLang: (lang: string) => void
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  t: translations.en,
  setLang: () => {},
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState("en")

  useEffect(() => {
    const stored = localStorage.getItem("lang")
    if (stored && translations[stored]) {
      setLangState(stored)
    }
  }, [])

  const setLang = (l: string) => {
    if (!translations[l]) return
    setLangState(l)
    localStorage.setItem("lang", l)
  }

  return (
    <LanguageContext.Provider value={{ lang, t: translations[lang], setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  return useContext(LanguageContext)
}
