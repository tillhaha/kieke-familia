// src/app/settings/GoogleSection.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import styles from "./settings.module.css"

type GoogleCalendar = { id: string; name: string; color: string | null }
type SelectedCalendar = { calendarId: string; name: string; color: string | null }

export function GoogleSection() {
  const [available, setAvailable] = useState<GoogleCalendar[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [availableError, setAvailableError] = useState<string | null>(null)
  const [selectedError, setSelectedError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setAvailableError(null)
    setSelectedError(null)
    setSaveError(null)

    const [availResult, selectedResult] = await Promise.allSettled([
      fetch("/api/settings/calendars/available").then((r) => r.json()),
      fetch("/api/settings/calendars/selected").then((r) => r.json()),
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

  const saveBtnLabel =
    saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save"
  const saveDisabled = loading || saveState === "saving" || !!availableError

  if (loading) return <p className={styles.spinner}>Loading calendars…</p>

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Google Calendar</h2>
      <p className={styles.sectionDesc}>
        Choose which of your Google Calendars to sync with Familia.
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
    </div>
  )
}
