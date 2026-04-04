// src/app/week/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Plus } from "lucide-react"
import { WeekBlock, WeekData, CalendarEvent } from "./WeekBlock"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./week.module.css"

export default function WeekPage() {
  const { status } = useSession()
  const router = useRouter()
  const { t } = useTranslation()
  const [weeks, setWeeks] = useState<WeekData[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
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
      .then((data) => {
        const loaded: WeekData[] = data.weeks ?? []
        setWeeks(loaded)
        if (loaded.length === 0) return
        const timeMin = `${loaded[loaded.length - 1].startDate}T00:00:00Z`
        const timeMax = `${loaded[0].endDate}T23:59:59Z`
        fetch(`/api/calendar/events?timeMin=${timeMin}&timeMax=${timeMax}`)
          .then((r) => r.json())
          .then((d) => {
            const events: CalendarEvent[] = []
            const nextDay = (d: string) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10) }
            for (const e of (d.googleEvents ?? [])) {
              if (!e.summary) continue
              if (e.start?.date) {
                let cur = e.start.date; const end = e.end?.date ?? nextDay(cur)
                while (cur < end) { const nd = nextDay(cur); events.push({ id: `${e.id ?? Math.random()}_${cur}`, summary: e.summary, date: cur, endDate: nd, allDay: true, startTime: null, calendarName: e.calendarName ?? null, color: null }); cur = nd }
              } else if (e.start?.dateTime) {
                const date = e.start.dateTime.slice(0, 10)
                events.push({ id: e.id ?? `g-${Math.random()}`, summary: e.summary, date, endDate: nextDay(date), allDay: false, startTime: new Date(e.start.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }), calendarName: e.calendarName ?? null, color: null })
              }
            }
            for (const e of (d.importedEvents ?? [])) {
              if (e.allDay) {
                let cur = e.start.slice(0, 10); const end = e.end.slice(0, 10)
                while (cur < end) { const nd = nextDay(cur); events.push({ id: `${e.id}_${cur}`, summary: e.summary, date: cur, endDate: nd, allDay: true, startTime: null, calendarName: e.calendarName ?? null, color: e.calendarColor ?? null }); cur = nd }
              } else {
                const date = e.start.slice(0, 10)
                events.push({ id: e.id, summary: e.summary, date, endDate: nextDay(date), allDay: false, startTime: new Date(e.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }), calendarName: e.calendarName ?? null, color: e.calendarColor ?? null })
              }
            }
            setCalendarEvents(events)
          })
          .catch(() => {})
      })
      .catch(() => setError("Failed to load weeks."))
      .finally(() => setLoading(false))
  }, [status])

  useEffect(() => {
    if (loading) return
    const hash = window.location.hash
    if (!hash) return
    const el = document.getElementById(hash.slice(1))
    if (el) el.scrollIntoView({ behavior: "smooth" })
  }, [loading])

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

  const handleGenerateShopping = async (weekStartDate: string) => {
    const res = await fetch("/api/shopping/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStartDate }),
    })
    if (res.ok) {
      router.push("/shopping")
    } else {
      setError("Failed to generate shopping list.")
    }
  }

  if (status === "loading" || loading) return null

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t.week.title}</h1>
        <button
          className={styles.planBtn}
          onClick={handlePlanNextWeek}
          disabled={planning}
        >
          <Plus size={14} strokeWidth={2.5} />
          {planning ? t.week.planning : t.week.planNextWeek}
        </button>
      </div>

      {error && <p style={{ color: "var(--primary)", fontSize: "0.875rem" }}>{error}</p>}

      {weeks.length === 0 ? (
        <p className={styles.emptyState}>
          {t.week.noWeeksYet}
        </p>
      ) : (
        <div className={styles.weeksList}>
          {weeks.map((week) => (
            <WeekBlock
              key={week.startDate}
              id={`week-${week.startDate}`}
              week={week}
              onDayUpdate={(date, field, value) =>
                handleDayUpdate(week.startDate, date, field, value)
              }
              onGenerateShopping={handleGenerateShopping}
              calendarEvents={calendarEvents.filter(
                (e) => e.date <= week.endDate && e.endDate > week.startDate
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
