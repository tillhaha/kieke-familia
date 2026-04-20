"use client"

import { Sun, Moon, Monitor } from "lucide-react"
import { useTheme, type Theme } from "@/lib/theme/ThemeContext"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./settings.module.css"

const OPTIONS: { value: Theme; icon: React.ReactNode; labelKey: "themeLight" | "themeDark" | "themeSystem" }[] = [
  { value: "light", icon: <Sun size={16} strokeWidth={1.75} />, labelKey: "themeLight" },
  { value: "dark", icon: <Moon size={16} strokeWidth={1.75} />, labelKey: "themeDark" },
  { value: "system", icon: <Monitor size={16} strokeWidth={1.75} />, labelKey: "themeSystem" },
]

export function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.settings.appearance}</h2>
      <p className={styles.sectionDesc}>{t.settings.appearanceDesc}</p>

      <div className={styles.themeRow}>
        {OPTIONS.map(({ value, icon, labelKey }) => (
          <button
            key={value}
            className={`${styles.themeBtn} ${theme === value ? styles.themeBtnActive : ""}`}
            onClick={() => setTheme(value)}
          >
            {icon}
            {t.settings[labelKey]}
          </button>
        ))}
      </div>
    </div>
  )
}
