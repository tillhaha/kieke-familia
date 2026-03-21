// src/app/week/WeekBlock.tsx
"use client"

import { useState, useCallback } from "react"
import styles from "./week.module.css"

export type DayData = {
  id: string
  date: string // YYYY-MM-DD
  note: string | null
  lunch: string | null
  dinner: string | null
  dinnerActivity: string | null
}

export type WeekData = {
  startDate: string
  endDate: string
  days: DayData[]
}

type Props = {
  week: WeekData
  onDayUpdate: (date: string, field: string, value: string | null) => void
}

type Field = "note" | "lunch" | "dinner" | "dinnerActivity"

const ROWS: { field: Field; label: string; placeholder: string }[] = [
  { field: "note", label: "Note", placeholder: "Add a note…" },
  { field: "lunch", label: "Lunch", placeholder: "Lunch…" },
  { field: "dinner", label: "Dinner", placeholder: "Dinner…" },
  { field: "dinnerActivity", label: "Activity", placeholder: "Activity…" },
]

function formatWeekHeader(startDate: string, endDate: string): string {
  const fmt = (s: string) =>
    new Date(s + "T00:00:00").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    })
  const year = new Date(endDate + "T00:00:00").getFullYear()
  return `${fmt(startDate)} – ${fmt(endDate)}, ${year}`
}

function formatDayHeader(dateStr: string): { weekday: string; day: number } {
  const d = new Date(dateStr + "T00:00:00")
  return {
    weekday: d.toLocaleDateString("en-GB", { weekday: "short" }),
    day: d.getDate(),
  }
}

function isPastWeek(endDate: string): boolean {
  const end = new Date(endDate + "T00:00:00")
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return end < today
}

export function WeekBlock({ week, onDayUpdate }: Props) {
  const past = isPastWeek(week.endDate)

  // Initialise drafts from saved data
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const day of week.days) {
      for (const { field } of ROWS) {
        init[`${day.date}:${field}`] = day[field] ?? ""
      }
    }
    return init
  })

  const [cellErrors, setCellErrors] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<Set<string>>(new Set())

  const getSaved = useCallback(
    (date: string, field: Field): string => {
      const day = week.days.find((d) => d.date === date)
      return day?.[field] ?? ""
    },
    [week]
  )

  const handleChange = (key: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: value }))
  }

  const handleBlur = async (date: string, field: Field) => {
    const key = `${date}:${field}`
    const current = drafts[key] ?? ""
    const saved = getSaved(date, field)
    if (current === saved) return

    setSaving((prev) => new Set(prev).add(key))
    try {
      const res = await fetch(`/api/weeks/days/${date}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: current || null }),
      })
      if (!res.ok) throw new Error()
      onDayUpdate(date, field, current || null)
    } catch {
      // Revert to saved value
      setDrafts((prev) => ({ ...prev, [key]: saved }))
      setCellErrors((prev) => {
        const next = new Set(prev).add(key)
        setTimeout(() => {
          setCellErrors((p) => {
            const n = new Set(p)
            n.delete(key)
            return n
          })
        }, 2000)
        return next
      })
    } finally {
      setSaving((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  return (
    <div className={styles.weekBlock}>
      <h2 className={styles.weekHeader}>
        {formatWeekHeader(week.startDate, week.endDate)}
      </h2>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.cornerCell} />
              {week.days.map((day) => {
                const { weekday, day: dayNum } = formatDayHeader(day.date)
                return (
                  <th key={day.date} className={styles.dayHeader}>
                    <span className={styles.dayName}>{weekday}</span>
                    <span className={styles.dayNum}>{dayNum}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ field, label, placeholder }) => (
              <tr key={field}>
                <td className={styles.rowLabel}>{label}</td>
                {week.days.map((day) => {
                  const key = `${day.date}:${field}`
                  const hasError = cellErrors.has(key)
                  return (
                    <td
                      key={day.date}
                      className={`${styles.cell} ${hasError ? styles.cellError : ""}`}
                    >
                      <textarea
                        className={styles.cellInput}
                        value={drafts[key] ?? ""}
                        placeholder={placeholder}
                        disabled={past || saving.has(key)}
                        rows={2}
                        onChange={(e) => handleChange(key, e.target.value)}
                        onBlur={() => handleBlur(day.date, field)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
