// src/app/settings/FeaturesSection.tsx
// Settings → Family → Features: switch optional modules on/off and name the calendar link.
"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import { useFamilyFeatures } from "@/components/FamilyFeatures"
import { Button } from "@/components/ui/Button"
import styles from "./settings.module.css"

export function FeaturesSection() {
  const { t } = useTranslation()
  const ts = t.settings
  const { data: session } = useSession()
  const { features, reload } = useFamilyFeatures()
  const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "PARENT"

  const [heating, setHeating] = useState(false)
  const [custody, setCustody] = useState(false)
  const [calendarTitle, setCalendarTitle] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)

  // Fill the form once the family's features are known (and again after saving)
  useEffect(() => {
    if (!features) return
    setHeating(features.heating)
    setCustody(features.custody)
    setCalendarTitle(features.calendarTitle ?? "")
  }, [features])

  if (!features) return null

  const dirty =
    heating !== features.heating || custody !== features.custody || calendarTitle.trim() !== (features.calendarTitle ?? "")

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/family", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: { heating, custody, calendarTitle } }),
      })
      if (!res.ok) throw new Error()
      reload()
      setMessage({ text: ts.featuresSaved })
    } catch {
      setMessage({ text: ts.featuresSaveFailed, error: true })
    } finally {
      setSaving(false)
    }
  }

  const toggle = (checked: boolean, set: (v: boolean) => void, label: string, hint: string) => (
    <label className={styles.featureRow}>
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={checked}
        disabled={!canEdit}
        onChange={(e) => {
          set(e.target.checked)
          setMessage(null)
        }}
      />
      <span>
        <span className={styles.featureLabel}>{label}</span>
        <span className={styles.fieldHint}>{hint}</span>
      </span>
    </label>
  )

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{ts.featuresTitle}</h2>
      <p className={styles.sectionDesc}>{canEdit ? ts.featuresDesc : ts.featuresOnlyAdmins}</p>

      {toggle(heating, setHeating, ts.featureHeating, ts.featureHeatingHint)}
      {toggle(custody, setCustody, ts.featureCustody, ts.featureCustodyHint)}

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel} htmlFor="feature-calendar-title">{ts.calendarTitleLabel}</label>
        <span className={styles.fieldHint}>{ts.calendarTitleHint}</span>
        <input
          id="feature-calendar-title"
          className={styles.fieldInput}
          value={calendarTitle}
          placeholder={t.week.calendarLink}
          maxLength={60}
          disabled={!canEdit}
          onChange={(e) => {
            setCalendarTitle(e.target.value)
            setMessage(null)
          }}
        />
      </div>

      {canEdit && (
        <div>
          <Button variant="primary" disabled={saving || !dirty} onClick={save}>
            {saving ? ts.featuresSaving : ts.featuresSave}
          </Button>
        </div>
      )}
      {message && <p className={message.error ? styles.saveError : styles.fieldHint}>{message.text}</p>}
    </div>
  )
}
