"use client"

import { createContext, useContext, useEffect, useState } from "react"

export type Theme = "light" | "dark" | "system"
type Resolved = "light" | "dark"

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
  resolvedTheme: Resolved
}>({ theme: "system", setTheme: () => {}, resolvedTheme: "light" })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")
  const [resolvedTheme, setResolvedTheme] = useState<Resolved>("light")

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme) || "system"
    setThemeState(stored)
  }, [])

  useEffect(() => {
    const apply = (t: Theme) => {
      const resolved: Resolved =
        t === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
          : t
      setResolvedTheme(resolved)
      document.documentElement.setAttribute("data-theme", resolved)
    }

    apply(theme)

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = () => apply("system")
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    }
  }, [theme])

  const setTheme = (t: Theme) => {
    localStorage.setItem("theme", t)
    setThemeState(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
