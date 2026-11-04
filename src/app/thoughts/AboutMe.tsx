// src/app/thoughts/AboutMe.tsx
// Collapsible private "About me" profile. The thoughts assistant reads it as
// life context when filing brain dumps (see src/lib/personalProfile.ts).
"use client"

import { useState, useEffect } from "react"
import { ChevronDown, UserRound } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./thoughts.module.css"

const MAX_LENGTH = 10000

export function AboutMe() {
  const { t } = useTranslation()
  const tt = t.thoughts
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState("")
  const [text, setText] = useState("")
  const [open, setOpen] = useState(false)
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

  const preview = saved ? saved.split("\n")[0] : tt.aboutEmpty

  return (
    <div className={`${styles.about} ${!saved ? styles.aboutEmpty : ""}`}>
      <button className={styles.aboutToggle} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <UserRound size={16} strokeWidth={2} className={styles.aboutIcon} />
        <span className={styles.aboutTitle}>{tt.aboutTitle}</span>
        {!open && <span className={styles.aboutPreview}>{preview}</span>}
        <ChevronDown size={16} className={`${styles.aboutChevron} ${open ? styles.aboutChevronOpen : ""}`} />
      </button>

      {open && (
        <div className={styles.aboutBody}>
          <p className={styles.subtitle}>{tt.aboutHint}</p>
          <textarea
            className={`${styles.composerInput} ${styles.aboutInput}`}
            value={text}
            placeholder={tt.aboutPlaceholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                save()
              }
            }}
            rows={8}
            maxLength={MAX_LENGTH}
            disabled={saving}
          />
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.composerFooter}>
            {justSaved && !dirty && <span className={styles.aboutSavedHint}>{tt.aboutSaved}</span>}
            <button className={styles.sendBtn} onClick={save} disabled={saving || !dirty}>
              {saving ? tt.aboutSaving : tt.save}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
