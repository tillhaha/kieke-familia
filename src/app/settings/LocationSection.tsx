// src/app/settings/LocationSection.tsx
"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./settings.module.css"

export function LocationSection() {
  const { t } = useTranslation()
  const [city, setCity] = useState("")
  const [initialCity, setInitialCity] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch("/api/family")
      .then((r) => r.json())
      .then((data) => {
        const c = data.family?.city ?? ""
        setCity(c)
        setInitialCity(c)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/family", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city }),
      })
      if (!res.ok) throw new Error()
      setInitialCity(city)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError(t.settings.failedSave)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className={styles.spinner}>{t.settings.loading}</p>

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.settings.location}</h2>
      <p className={styles.sectionDesc}>{t.settings.locationDesc}</p>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel} htmlFor="city-input">
          {t.settings.homeCityLabel}
        </label>
        <input
          id="city-input"
          className={styles.fieldInput}
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder={t.settings.homeCityPlaceholder}
        />
      </div>

      {error && <p className={styles.saveError}>{error}</p>}

      <button
        className={styles.saveBtn}
        onClick={handleSave}
        disabled={saving || city.trim() === initialCity.trim()}
      >
        {saving ? t.settings.saving : saved ? t.settings.saved : t.settings.save}
      </button>
    </div>
  )
}
