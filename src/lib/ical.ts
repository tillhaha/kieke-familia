// src/lib/ical.ts
import ical from "node-ical"

export type ImportedEvent = {
  id: string
  summary: string
  start: string   // "YYYY-MM-DD" for all-day, ISO dateTime string for timed
  end: string
  allDay: boolean
  calendarId: string
  calendarName: string
  calendarColor: string
}

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function normalizeIcalUrl(url: string): string {
  return url.replace(/^webcal:\/\//i, "https://")
}

export async function fetchAndParseIcal(
  url: string,
  calendarId: string,
  calendarName: string,
  calendarColor: string,
  timeMin: Date,
  timeMax: Date
): Promise<ImportedEvent[]> {
  try {
    const normalized = normalizeIcalUrl(url)
    const data = await ical.async.fromURL(normalized)
    const events: ImportedEvent[] = []

    for (const e of Object.values(data)) {
      if (!e || e.type !== "VEVENT") continue

      const start = e.start as Date & { datetype?: string }
      const end = (e.end ?? e.start) as Date & { datetype?: string }

      if (!start) continue

      const allDay = start.datetype === "date"

      // Filter to the requested window
      const startMs = start.getTime()
      const endMs = end.getTime()
      if (endMs < timeMin.getTime() || startMs > timeMax.getTime()) continue

      events.push({
        id: `${calendarId}::${e.uid ?? Math.random()}`,
        summary: (e.summary as string) || "(No title)",
        start: allDay ? toDateString(start) : start.toISOString(),
        end: allDay ? toDateString(end) : end.toISOString(),
        allDay,
        calendarId,
        calendarName,
        calendarColor,
      })

      if (events.length >= 500) break
    }

    return events
  } catch (err) {
    console.error(`[ical] Failed to fetch/parse ${url}:`, err)
    return []
  }
}
