// src/lib/mcp/tools/calendar.ts
// Calendar: the user's own selected Google calendars, the family's imported iCal feeds,
// birthdays, travel and custody — the same sources as the /calendar page.
import { prisma } from "@/lib/prisma"
import { listEventsFromCalendars } from "@/lib/google/calendar"
import { fetchAndParseIcal } from "@/lib/ical"
import { DEFAULT_TIME_ZONE, addDays, dateStr, dbDate, weekday } from "@/lib/localDate"
import { type McpAuth, type McpTool, type ToolResult, text } from "../types"
import { dateRangeArgs } from "./family"

const MAX_DAYS = 62

/** "2026-11-13T09:30:00+01:00" → "09:30" in the family's time zone */
function time(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: DEFAULT_TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
}
function localDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIME_ZONE }).format(new Date(iso))
}

type Entry = { date: string; sort: string; text: string }

async function getCalendar(auth: McpAuth, args: unknown): Promise<ToolResult> {
  const r = dateRangeArgs(args, 14, MAX_DAYS)
  if ("content" in r) return r
  // Generous UTC window around the local days; entries are filtered by local date below
  const timeMin = new Date(dbDate(r.from).getTime() - 86_400_000)
  const timeMax = new Date(dbDate(addDays(r.to, 1)).getTime() + 86_400_000)

  const [syncs, imported, birthdays, travels, custody, members] = await Promise.all([
    prisma.calendarSync.findMany({ where: { userId: auth.userId }, select: { calendarId: true, name: true } }),
    prisma.importedCalendar.findMany({ where: { familyId: auth.familyId }, select: { id: true, url: true, name: true, color: true } }),
    prisma.birthday.findMany({ where: { familyId: auth.familyId } }),
    prisma.travel.findMany({ where: { user: { familyId: auth.familyId }, startDate: { lte: timeMax }, endDate: { gte: timeMin } } }),
    prisma.custodySchedule.findMany({ where: { familyId: auth.familyId, date: { gte: dbDate(r.from), lte: dbDate(r.to) } } }),
    prisma.user.findMany({ where: { familyId: auth.familyId }, select: { id: true, name: true } }),
  ])

  const entries: Entry[] = []
  const warnings: string[] = []
  const add = (start: string, end: string | null, allDay: boolean, title: string, source: string) => {
    if (allDay) {
      // All-day end dates are exclusive
      const last = end ? addDays(end.slice(0, 10), -1) : start.slice(0, 10)
      for (let d = start.slice(0, 10); d <= last && d <= r.to; d = addDays(d, 1)) {
        if (d >= r.from) entries.push({ date: d, sort: "00:00", text: `all day: ${title} (${source})` })
      }
    } else {
      const d = localDay(start)
      if (d >= r.from && d <= r.to) entries.push({ date: d, sort: time(start), text: `${time(start)}${end ? `–${time(end)}` : ""} ${title} (${source})` })
    }
  }

  // The user's own Google calendars
  if (syncs.length) {
    try {
      const names = Object.fromEntries(syncs.map((s) => [s.calendarId, s.name]))
      const events = await listEventsFromCalendars(auth.userId, syncs.map((s) => s.calendarId), timeMin, timeMax)
      for (const e of events) {
        const start = e.start?.dateTime ?? e.start?.date
        if (!start) continue
        const title = `${e.summary ?? "(no title)"}${e.location ? ` @ ${e.location}` : ""}`
        add(start, e.end?.dateTime ?? e.end?.date ?? null, !e.start?.dateTime, title, names[e.calendarId] ?? "Google")
      }
    } catch (err) {
      console.error("[assistant] google calendar", err)
      warnings.push("Google Calendar could not be read right now.")
    }
  }

  // Family iCal feeds
  const feeds = await Promise.all(
    imported.map((c) =>
      fetchAndParseIcal(c.url, c.id, c.name, c.color, timeMin, timeMax).catch(() => {
        warnings.push(`Calendar "${c.name}" could not be read right now.`)
        return []
      }),
    ),
  )
  for (const e of feeds.flat()) add(e.start, e.end, e.allDay, e.summary, e.calendarName)

  // Birthdays (yearly)
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) {
    const [y, m, day] = d.split("-").map(Number)
    for (const b of birthdays.filter((b) => b.month === m && b.day === day)) {
      entries.push({ date: d, sort: "00:00", text: `Birthday: ${b.name}${b.year ? ` (turns ${y - b.year})` : ""}` })
    }
  }

  // Travel
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "?"
  for (const t of travels) {
    for (let d = dateStr(t.startDate); d <= dateStr(t.endDate); d = addDays(d, 1)) {
      if (d >= r.from && d <= r.to) entries.push({ date: d, sort: "00:01", text: `Travel: ${name(t.userId)} in ${t.destination}` })
    }
  }

  // Custody
  for (const c of custody) {
    entries.push({ date: dateStr(c.date), sort: "00:02", text: `${c.personName} ${c.location === "WITH_US" ? "with us" : "not with us"}` })
  }

  entries.sort((a, b) => a.date.localeCompare(b.date) || a.sort.localeCompare(b.sort))
  const lines: string[] = []
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) {
    const today = entries.filter((e) => e.date === d)
    if (today.length) lines.push(`${d} (${weekday(d)}):`, ...today.map((e) => `  - ${e.text}`))
  }
  if (!syncs.length) warnings.push("The user hasn't selected any Google calendars (Settings), so only family calendars are included.")
  return text([lines.length ? lines.join("\n") : `No entries between ${r.from} and ${r.to}.`, ...warnings].join("\n\n"))
}

export const calendarTools: McpTool[] = [
  {
    name: "get_calendar",
    description:
      "Read calendar entries for a date range (default: the next 14 days, max 62): the user's own selected Google calendars, the family's imported calendars, birthdays (with age), travel and custody. Times are local (Europe/Berlin).",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "First day, YYYY-MM-DD (default: today)" },
        to: { type: "string", description: "Last day, YYYY-MM-DD, inclusive" },
      },
    },
    handler: (auth, args) => getCalendar(auth, args),
  },
]
