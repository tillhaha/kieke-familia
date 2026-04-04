"use client"

// src/app/settings/LanguageSection.tsx

import { useTranslation } from "@/lib/i18n/LanguageContext"
import { LANGUAGE_LABELS } from "@/lib/i18n/index"
import styles from "./settings.module.css"

export function LanguageSection() {
  const { lang, setLang, t } = useTranslation()

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.settings.languageTitle}</h2>
      <p className={styles.sectionDesc}>{t.settings.languageDesc}</p>

      <div className={styles.fieldGroup}>
        <label htmlFor="lang-select" className={styles.fieldLabel}>
          {t.settings.chooseLanguage}
        </label>
        <select
          id="lang-select"
          className={styles.fieldInput}
          value={lang}
          onChange={(e) => setLang(e.target.value)}
        >
          {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
