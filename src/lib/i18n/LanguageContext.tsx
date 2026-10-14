"use client"

// src/lib/i18n/LanguageContext.tsx

import { createContext, useContext, useSyncExternalStore, ReactNode } from "react"
import { translations, Translations } from "./index"

const LANG_KEY = "lang"
const LANG_EVENT = "familia-lang-change"

function subscribeLang(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener(LANG_EVENT, callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(LANG_EVENT, callback)
  }
}
function getLangSnapshot(): string {
  const stored = localStorage.getItem(LANG_KEY)
  return stored && translations[stored] ? stored : "en"
}
function getServerLangSnapshot(): string {
  return "en"
}

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
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getServerLangSnapshot)

  const setLang = (l: string) => {
    if (!translations[l]) return
    localStorage.setItem(LANG_KEY, l)
    window.dispatchEvent(new Event(LANG_EVENT))
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
