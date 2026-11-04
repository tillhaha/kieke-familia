// src/app/settings/AboutMeSection.tsx
// Private "About me" profile (Settings → Profile). The thoughts assistant reads
// it as life context when filing brain dumps (see src/lib/personalProfile.ts).
"use client"

import { useState, useEffect } from "react"
import { Lock } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./settings.module.css"
import { Button } from "@/components/ui/Button"

const MAX_LENGTH = 10000

export function AboutMeSection() {
  const { t } = useTranslation()
  const tt = t.thoughts
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState("")
  const [text, setText] = useState("")
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/personal-profile")
      .then((r) => (r.ok ? r.json() : { text: "" }))
      .then((d) => {
        setSaved(d.text ?? "")
        setText(d.text ?? "")
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const dirty = text.trim() !== saved

  async function save() {
    if (saving || !dirty) return
    setSaving(true)
    setError("")
    try {
      const r = await fetch("/api/personal-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      if (!r.ok) throw new Error()
      const d = await r.json()
      setSaved(d.text)
      setText(d.text)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    } catch {
      setError(tt.failed)
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return null

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{tt.aboutTitle}</h2>
      <p className={styles.sectionDesc}>
        <Lock size={12} strokeWidth={2.25} className={styles.aboutLock} />
        {tt.aboutHint}
      </p>

      <textarea
        className={`${styles.fieldInput} ${styles.aboutInput}`}
        value={text}
        placeholder={tt.aboutPlaceholder}
        onChange={(e) => { setText(e.target.value); setJustSaved(false) }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            save()
          }
        }}
        rows={10}
        maxLength={MAX_LENGTH}
        disabled={saving}
      />

      {error && <p className={styles.saveError}>{error}</p>}

      <Button variant="primary" onClick={save} disabled={saving || !dirty}>
        {saving ? tt.aboutSaving : justSaved && !dirty ? tt.aboutSaved : tt.save}
      </Button>
    </div>
  )
}
