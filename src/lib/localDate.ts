// src/lib/localDate.ts
// Calendar dates in the family's time zone. Week planner, tasks and custody store dates
// as UTC midnight of the local day ("YYYY-MM-DD" ↔ Date.UTC(y, m - 1, d)).

export const DEFAULT_TIME_ZONE = "Europe/Berlin"

/** Local calendar date ("YYYY-MM-DD") and minutes since midnight in a time zone */
export function localClock(timeZone: string = DEFAULT_TIME_ZONE, at: Date = new Date()): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** "YYYY-MM-DD" → Date at UTC midnight, as the week planner stores it */
export function dbDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Date stored at UTC midnight → "YYYY-MM-DD" */
export function dateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
export function weekday(date: string): string {
  return WEEKDAYS[dbDate(date).getUTCDay()]
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
