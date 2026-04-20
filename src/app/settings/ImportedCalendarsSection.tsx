// src/app/settings/ImportedCalendarsSection.tsx
"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./settings.module.css"

type ImportedCalendar = { id: string; url: string; name: string; color: string; createdAt: string }

export function ImportedCalendarsSection() {
  const { t } = useTranslation()
  const [imported, setImported] = useState<ImportedCalendar[]>([])
  const [loading, setLoading] = useState(true)
  const [newUrl, setNewUrl] = useState("")
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState("#d8ead8")
  const [addState, setAddState] = useState<"idle" | "adding" | "error">("idle")
  const [addError, setAddError] = useState<string | null>(null)
  const [deletingImportedId, setDeletingImportedId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/calendar/imported")
      .then((r) => r.json())
      .then((data) => { if (!data.error) setImported(data) })
      .finally(() => setLoading(false))
  }, [])

  const handleAddImported = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUrl.trim() || !newName.trim()) return
    setAddState("adding")
    setAddError(null)

    try {
      const res = await fetch("/api/calendar/imported", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl.trim(), name: newName.trim(), color: newColor }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Server error (${res.status})`)
      setImported((prev) => [...prev, data])
      setNewUrl("")
      setNewName("")
      setNewColor("#d8ead8")
      setAddState("idle")
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed to add calendar")
      setAddState("error")
    }
  }

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    setDeletingImportedId(id)
    setConfirmDeleteId(null)
    try {
      await fetch(`/api/calendar/imported/${id}`, { method: "DELETE" })
      setImported((prev) => prev.filter((c) => c.id !== id))
    } finally {
      setDeletingImportedId(null)
    }
  }

  if (loading) return <p className={styles.spinner}>{t.settings.loading}</p>

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.settings.calendarImport}</h2>
      <p className={styles.sectionDesc}>{t.settings.importedCalendarsDesc}</p>

      {imported.length > 0 && (
        <div className={styles.calendarList}>
          {imported.map((cal) => (
            <div key={cal.id} className={styles.calendarRow}>
              <span className={styles.colorDot} style={{ backgroundColor: cal.color }} />
              <span className={styles.calendarName}>{cal.name}</span>
              <span className={styles.importedUrlText} title={cal.url}>{cal.url}</span>
              <button
                className={confirmDeleteId === cal.id ? styles.confirmDeleteBtn : styles.deleteBtn}
                disabled={deletingImportedId === cal.id}
                onClick={() => handleDelete(cal.id)}
              >
                {confirmDeleteId === cal.id ? t.settings.confirmQuestion : deletingImportedId === cal.id ? "…" : t.settings.remove}
              </button>
            </div>
          ))}
        </div>
      )}

      {imported.length === 0 && (
        <p className={styles.emptyMsg}>{t.settings.noImportedCalendars}</p>
      )}

      <form onSubmit={handleAddImported} className={styles.importedForm}>
        <input
          type="text"
          className={styles.fieldInput}
          placeholder={t.settings.calendarNamePlaceholder}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
        />
        <input
          type="url"
          className={styles.fieldInput}
          placeholder="https://calendar.google.com/…/basic.ics"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          required
        />
        <div className={styles.importedFormRow}>
          <label className={styles.importedColorLabel}>
            {t.settings.colorLabel}
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className={styles.colorPicker}
            />
          </label>
          <button
            type="submit"
            className={styles.saveBtn}
            disabled={addState === "adding"}
          >
            {addState === "adding" ? t.settings.adding : t.settings.addCalendar}
          </button>
        </div>
        {addState === "error" && addError && (
          <p className={styles.saveError}>{addError}</p>
        )}
      </form>
    </div>
  )
}
