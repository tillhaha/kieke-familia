// src/app/week/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import { Plus } from "lucide-react"
import { WeekBlock, WeekData } from "./WeekBlock"
import styles from "./week.module.css"

export default function WeekPage() {
  const { status } = useSession()
  const [weeks, setWeeks] = useState<WeekData[]>([])
  const [loading, setLoading] = useState(true)
  const [planning, setPlanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status !== "authenticated") return
    fetch("/api/weeks")
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => setWeeks(data.weeks ?? []))
      .catch(() => setError("Failed to load weeks."))
      .finally(() => setLoading(false))
  }, [status])

  const handlePlanNextWeek = async () => {
    setPlanning(true)
    setError(null)
    try {
      const res = await fetch("/api/weeks", { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to create week.")
        return
      }
      setWeeks((prev) => [data.week, ...prev])
    } catch {
      setError("Failed to create week.")
    } finally {
      setPlanning(false)
    }
  }

  const handleDayUpdate = (
    weekStart: string,
    date: string,
    field: string,
    value: string | null
  ) => {
    setWeeks((prev) =>
      prev.map((w) =>
        w.startDate === weekStart
          ? {
              ...w,
              days: w.days.map((d) =>
                d.date === date ? { ...d, [field]: value } : d
              ),
            }
          : w
      )
    )
  }

  if (status === "loading" || loading) return null

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Week planning</h1>
        <button
          className={styles.planBtn}
          onClick={handlePlanNextWeek}
          disabled={planning}
        >
          <Plus size={14} strokeWidth={2.5} />
          {planning ? "Planning…" : "Plan next week"}
        </button>
      </div>

      {error && <p style={{ color: "var(--primary)", fontSize: "0.875rem" }}>{error}</p>}

      {weeks.length === 0 ? (
        <p className={styles.emptyState}>
          No weeks planned yet. Click "Plan next week" to get started.
        </p>
      ) : (
        <div className={styles.weeksList}>
          {weeks.map((week) => (
            <WeekBlock
              key={week.startDate}
              week={week}
              onDayUpdate={(date, field, value) =>
                handleDayUpdate(week.startDate, date, field, value)
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
