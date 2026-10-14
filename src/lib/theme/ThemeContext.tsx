"use client"

import { createContext, useContext, useEffect, useSyncExternalStore } from "react"

export type Theme = "light" | "dark" | "system"
type Resolved = "light" | "dark"

const THEME_KEY = "theme"
const THEME_EVENT = "familia-theme-change"

function subscribeTheme(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener(THEME_EVENT, callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(THEME_EVENT, callback)
  }
}
function getThemeSnapshot(): Theme {
  return (localStorage.getItem(THEME_KEY) as Theme | null) ?? "system"
}
function getServerThemeSnapshot(): Theme {
  return "system"
}

function subscribeSystemPref(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)")
  mq.addEventListener("change", callback)
  return () => mq.removeEventListener("change", callback)
}
function getSystemPrefSnapshot(): Resolved {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}
function getServerSystemPrefSnapshot(): Resolved {
  return "light"
}

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
  resolvedTheme: Resolved
}>({ theme: "system", setTheme: () => {}, resolvedTheme: "light" })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot)
  const systemPref = useSyncExternalStore(subscribeSystemPref, getSystemPrefSnapshot, getServerSystemPrefSnapshot)
  const resolvedTheme: Resolved = theme === "system" ? systemPref : theme

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme)
  }, [resolvedTheme])

  const setTheme = (t: Theme) => {
    localStorage.setItem(THEME_KEY, t)
    window.dispatchEvent(new Event(THEME_EVENT))
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
