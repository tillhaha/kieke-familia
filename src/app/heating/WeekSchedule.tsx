// src/app/heating/WeekSchedule.tsx
// Read-only week view of a room's heating schedule: one row per weekday with a
// 0–24h timeline bar and the day's periods as text. Plus `nextSwitch`, which finds
// the next temperature change from the schedule.
"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./heating.module.css"

export type SchedulePeriod = { start: string; end: string; temperature: number }
export type ScheduleDay = { baseTemperature: number; periods: SchedulePeriod[] }
/** days[0] = Monday … days[6] = Sunday */
export type Schedule = { profileIndex: string; profileName: string; days: ScheduleDay[] }

type Segment = { from: number; to: number; temperature: number; base: boolean } // minutes of the day

const DAY_MINUTES = 24 * 60

function minutes(time: string) {
  const [h, m] = time.split(":").map(Number)
  return Math.min(DAY_MINUTES, h * 60 + m)
}

function hhmm(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`
}

function fmtTemp(t: number) {
  return `${Number.isInteger(t) ? t.toFixed(0) : t.toFixed(1)}°`
}

/** Periods plus the base temperature filling the gaps, covering 00:00–24:00 */
function segmentsOf(day: ScheduleDay): Segment[] {
  const out: Segment[] = []
  let cursor = 0
  for (const p of day.periods) {
    const from = Math.max(cursor, minutes(p.start))
    const to = minutes(p.end)
    if (to <= from) continue
    if (from > cursor) out.push({ from: cursor, to: from, temperature: day.baseTemperature, base: true })
    out.push({ from, to, temperature: p.temperature, base: false })
    cursor = to
  }
  if (cursor < DAY_MINUTES) out.push({ from: cursor, to: DAY_MINUTES, temperature: day.baseTemperature, base: true })
  return out
}

/** Monday-based weekday index (0 = Monday) */
function mondayIndex(d: Date) {
  return (d.getDay() + 6) % 7
}

/** The next point where the schedule changes the temperature, looking up to a week ahead. */
export function nextSwitch(schedule: Schedule, now: Date): { dayOffset: number; time: string; temperature: number } | null {
  const today = mondayIndex(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  let current: number | null = null
  for (let offset = 0; offset <= 7; offset++) {
    const segs = segmentsOf(schedule.days[(today + offset) % 7])
    for (const s of segs) {
      if (offset === 0 && s.to <= nowMin) continue
      if (current === null) {
        current = s.temperature
        continue
      }
      if (s.temperature !== current) return { dayOffset: offset, time: hhmm(s.from), temperature: s.temperature }
    }
  }
  return null
}

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function WeekSchedule({ schedule }: { schedule: Schedule }) {
  const { t, lang } = useTranslation()
  const now = useNow()
  const today = mondayIndex(now)
  const nowPct = ((now.getHours() * 60 + now.getMinutes()) / DAY_MINUTES) * 100

  // 1 Jan 2024 was a Monday
  const dayFmt = new Intl.DateTimeFormat(lang, { weekday: "short" })
  const dayNames = Array.from({ length: 7 }, (_, i) => dayFmt.format(new Date(2024, 0, 1 + i)))

  // Shade segments by temperature relative to the week's range
  const temps = schedule.days.flatMap((d) => [d.baseTemperature, ...d.periods.map((p) => p.temperature)])
  const lo = Math.min(...temps)
  const hi = Math.max(...temps)
  const shade = (temp: number) => {
    const ratio = hi === lo ? 1 : (temp - lo) / (hi - lo)
    return `color-mix(in srgb, var(--primary) ${Math.round(20 + ratio * 80)}%, var(--surface-hover))`
  }

  return (
    <div className={styles.week}>
      <div className={styles.weekHead}>
        <span className={styles.label}>
          {t.heating.schedule}: {schedule.profileName || t.heating.profileFallback.replace("{n}", schedule.profileIndex.replace(/\D/g, ""))}
        </span>
        <span className={styles.weekNote}>{t.heating.scheduleReadOnly}</span>
      </div>

      <div className={styles.axis} aria-hidden>
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h} style={{ left: `${(h / 24) * 100}%` }}>{h}</span>
        ))}
      </div>

      {schedule.days.map((day, i) => {
        const segs = segmentsOf(day)
        const isToday = i === today
        return (
          <div key={i} className={`${styles.dayRow} ${isToday ? styles.dayToday : ""}`}>
            <span className={styles.dayLabel}>{dayNames[i]}</span>
            <div className={styles.dayBody}>
              <div className={styles.bar} role="img" aria-label={`${dayNames[i]}: ${describeDay(day, t.heating.otherwise)}`}>
                {segs.map((s) => {
                  const width = ((s.to - s.from) / DAY_MINUTES) * 100
                  return (
                    <span
                      key={s.from}
                      className={`${styles.slot} ${s.base ? styles.slotBase : ""}`}
                      style={{ left: `${(s.from / DAY_MINUTES) * 100}%`, width: `${width}%`, background: shade(s.temperature) }}
                      title={`${hhmm(s.from)}–${hhmm(s.to)} · ${fmtTemp(s.temperature)}`}
                    >
                      {width >= 12 && fmtTemp(s.temperature)}
                    </span>
                  )
                })}
                {isToday && <span className={styles.nowMarker} style={{ left: `${nowPct}%` }} />}
              </div>
              <div className={styles.periods}>
                {day.periods.length === 0 ? (
                  <span>{t.heating.allDay} {fmtTemp(day.baseTemperature)}</span>
                ) : (
                  <>
                    {day.periods.map((p) => (
                      <span key={p.start} className={styles.period}>
                        {p.start}–{p.end} <strong>{fmtTemp(p.temperature)}</strong>
                      </span>
                    ))}
                    <span className={styles.periodBase}>
                      {t.heating.otherwise} {fmtTemp(day.baseTemperature)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function describeDay(day: ScheduleDay, otherwise: string) {
  const periods = day.periods.map((p) => `${p.start}–${p.end} ${fmtTemp(p.temperature)}`).join(", ")
  return periods ? `${periods}; ${otherwise} ${fmtTemp(day.baseTemperature)}` : fmtTemp(day.baseTemperature)
}

export { fmtTemp }
