// src/app/settings/GoogleSection.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import styles from "./settings.module.css"

type GoogleCalendar = { id: string; name: string; color: string | null }
type SelectedCalendar = { calendarId: string; name: string; color: string | null }
type ImportedCalendar = { id: string; url: string; name: string; color: string; createdAt: string }

export function GoogleSection() {
  const [available, setAvailable] = useState<GoogleCalendar[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [availableError, setAvailableError] = useState<string | null>(null)
  const [selectedError, setSelectedError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Imported calendars state
  const [imported, setImported] = useState<ImportedCalendar[]>([])
  const [newUrl, setNewUrl] = useState("")
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState("#d8ead8")
  const [addState, setAddState] = useState<"idle" | "adding" | "error">("idle")
  const [addError, setAddError] = useState<string | null>(null)
  const [deletingImportedId, setDeletingImportedId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setAvailableError(null)
    setSelectedError(null)
    setSaveError(null)

    const [availResult, selectedResult, importedResult] = await Promise.allSettled([
      fetch("/api/settings/calendars/available").then((r) => r.json()),
      fetch("/api/settings/calendars/selected").then((r) => r.json()),
      fetch("/api/calendar/imported").then((r) => r.json()),
    ])

    if (availResult.status === "fulfilled" && !availResult.value.error) {
      setAvailable(availResult.value)
    } else {
      setAvailableError(
        availResult.status === "fulfilled"
          ? availResult.value.error
          : "Could not load your Google calendars."
      )
    }

    if (selectedResult.status === "fulfilled" && !selectedResult.value.error) {
      setSelected(
        new Set((selectedResult.value as SelectedCalendar[]).map((c) => c.calendarId))
      )
    } else {
      setSelectedError(
        selectedResult.status === "fulfilled"
          ? selectedResult.value.error
          : "Could not load your saved selection."
      )
    }

    if (importedResult.status === "fulfilled" && !importedResult.value.error) {
      setImported(importedResult.value)
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const handleToggle = (calendarId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(calendarId)) next.delete(calendarId)
      else next.add(calendarId)
      return next
    })
  }

  const handleSave = async () => {
    setSaveState("saving")
    setSaveError(null)

    const payload = available
      .filter((cal) => selected.has(cal.id))
      .map((cal) => ({
        calendarId: cal.id,
        name: cal.name,
        ...(cal.color ? { color: cal.color } : {}),
      }))

    try {
      const res = await fetch("/api/settings/calendars/selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to save")
      }

      setSaveState("saved")
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to save")
      setSaveState("idle")
    }
  }

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
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to add")
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

  const handleDeleteImported = async (id: string) => {
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

  const saveBtnLabel =
    saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save"
  const saveDisabled = loading || saveState === "saving" || !!availableError

  if (loading) return <p className={styles.spinner}>Loading calendars…</p>

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Google Calendar</h2>
      <p className={styles.sectionDesc}>
        Choose which of your Google Calendars to sync with YourKieke.
      </p>

      {availableError && (
        <div className={styles.errorBox}>
          <span>{availableError}</span>
          <button onClick={fetchData} className={styles.retryBtn}>
            Retry
          </button>
        </div>
      )}

      {selectedError && <div className={styles.errorBox}>{selectedError}</div>}

      {!availableError && available.length === 0 && (
        <p className={styles.emptyMsg}>No Google calendars found in your account.</p>
      )}

      {!availableError && available.length > 0 && (
        <div className={styles.calendarList}>
          {available.map((cal) => (
            <label key={cal.id} className={styles.calendarRow}>
              <span
                className={styles.colorDot}
                style={{ backgroundColor: cal.color ?? "#94A3B8" }}
              />
              <span className={styles.calendarName}>{cal.name}</span>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={selected.has(cal.id)}
                onChange={() => handleToggle(cal.id)}
              />
            </label>
          ))}
        </div>
      )}

      {!availableError && available.length > 0 && (
        <>
          {saveError && <p className={styles.saveError}>Failed to save. Please try again.</p>}
          <button onClick={handleSave} disabled={saveDisabled} className={styles.saveBtn}>
            {saveBtnLabel}
          </button>
        </>
      )}

      {/* Imported calendars sub-section */}
      <div className={styles.importedSection}>
        <h3 className={styles.importedTitle}>Imported Calendars (iCal)</h3>
        <p className={styles.sectionDesc}>
          Add any calendar via its .ics URL — Google Calendar, Outlook, public feeds, etc.
        </p>

        {imported.length > 0 && (
          <div className={styles.calendarList}>
            {imported.map((cal) => (
              <div key={cal.id} className={styles.calendarRow}>
                <span
                  className={styles.colorDot}
                  style={{ backgroundColor: cal.color }}
                />
                <span className={styles.calendarName}>{cal.name}</span>
                <span className={styles.importedUrlText} title={cal.url}>
                  {cal.url}
                </span>
                <button
                  className={confirmDeleteId === cal.id ? styles.confirmDeleteBtn : styles.deleteBtn}
                  disabled={deletingImportedId === cal.id}
                  onClick={() => handleDeleteImported(cal.id)}
                >
                  {confirmDeleteId === cal.id ? "Confirm?" : deletingImportedId === cal.id ? "…" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        )}

        {imported.length === 0 && (
          <p className={styles.emptyMsg}>No imported calendars yet.</p>
        )}

        <form onSubmit={handleAddImported} className={styles.importedForm}>
          <input
            type="text"
            className={styles.fieldInput}
            placeholder="Calendar name"
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
              Color
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
              {addState === "adding" ? "Adding…" : "Add calendar"}
            </button>
          </div>
          {addState === "error" && addError && (
            <p className={styles.saveError}>{addError}</p>
          )}
        </form>
      </div>
    </div>
  )
}
