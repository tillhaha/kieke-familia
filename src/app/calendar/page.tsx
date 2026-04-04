// src/app/calendar/page.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Plus, Baby, Link2 } from "lucide-react"
import styles from "./calendar.module.css"
import CustodyPopover from "./CustodyPopover"

type ModalType = "NONE" | "CUSTODY"

type EventDetail = {
  summary: string
  timeLabel: string
  calendarName?: string
  color?: string
}

type CustodyEntry = { id: string; date: string; location: "WITH_US" | "WITH_MONA"; personName: string }
type GoogleEvent = { id: string; summary?: string; start?: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string }; calendarId?: string; calendarName?: string }

function googleEventTooltip(e: GoogleEvent): string {
  const parts: string[] = []
  if (e.start?.dateTime) {
    const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const start = new Date(e.start.dateTime)
    const end = e.end?.dateTime ? new Date(e.end.dateTime) : null
    parts.push(end ? `${fmt(start)} – ${fmt(end)}` : fmt(start))
  } else {
    parts.push("All day")
  }
  if (e.calendarName) parts.push(e.calendarName)
  return parts.join(" · ")
}
type ImportedEvent = { id: string; summary: string; start: string; end: string; allDay: boolean; calendarId: string; calendarName: string; calendarColor: string }

type SpanPos = "single" | "start" | "middle" | "end"

function getCustodySpanPos(date: Date, entry: CustodyEntry, allEntries: CustodyEntry[]): SpanPos {
  const d = date.getDay()
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`
  const prev = new Date(date); prev.setDate(prev.getDate() - 1)
  const next = new Date(date); next.setDate(next.getDate() + 1)
  const hasPrev = d !== 1 && allEntries.some(
    (c) => c.date === fmt(prev) && c.location === entry.location && c.personName === entry.personName
  )
  const hasNext = d !== 0 && allEntries.some(
    (c) => c.date === fmt(next) && c.location === entry.location && c.personName === entry.personName
  )
  if (!hasPrev && !hasNext) return "single"
  if (!hasPrev) return "start"
  if (!hasNext) return "end"
  return "middle"
}

function CustodyPill({
  entry,
  isOpen,
  onToggle,
  onClose,
  onSave,
  spanClass = "",
}: {
  entry: CustodyEntry
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onSave: () => Promise<void>
  spanClass?: string
}) {
  const anchorRef = useRef<HTMLDivElement>(null)
  return (
    <div ref={anchorRef}>
      <div
        className={`${styles.eventItem} ${entry.location === "WITH_US" ? styles.custodyHomeEvent : styles.custodyMonaEvent} ${spanClass}`}
        style={{ cursor: "pointer", paddingTop: "0.3rem", paddingBottom: "0.3rem" }}
        data-tooltip={entry.location === "WITH_US" ? "Emilia @ Us" : "Emilia @ Mona"}
        onClick={(e) => { e.stopPropagation(); onToggle() }}
      >
        <Baby size={10} strokeWidth={2} />
      </div>
      {isOpen && (
        <CustodyPopover
          entry={entry}
          anchorRef={anchorRef}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </div>
  )
}

export default function CalendarPage() {
  const { data: session, status } = useSession()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<{
    googleEvents: GoogleEvent[]
    custodyEntries: CustodyEntry[]
    calendarSyncCount: number
    importedEvents: ImportedEvent[]
  }>({
    googleEvents: [],
    custodyEntries: [],
    calendarSyncCount: 0,
    importedEvents: [],
  })
  const [loading, setLoading] = useState(false)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalType>("NONE")

  const [deleteConfirming, setDeleteConfirming] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  // Filter state
  const [showCustody, setShowCustody] = useState(true)
  const [showGoogle, setShowGoogle] = useState(true)
  const [showImported, setShowImported] = useState(true)

  // Custody popover + modal form state
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null)
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    setIsDark(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const [openCustodyId, setOpenCustodyId] = useState<string | null>(null)
  const [cStart, setCStart] = useState("")
  const [cStartsWith, setCStartsWith] = useState<"WITH_US" | "WITH_MONA">("WITH_US")
  const [cRecurring, setCRecurring] = useState(true)
  const [cUntil, setCUntil] = useState("")
  const [cConflictPending, setCConflictPending] = useState(false)

  const closeModal = () => {
    setModal("NONE")
    setDeleteConfirming(false)
    setModalError(null)
    setOpenCustodyId(null)
    setCConflictPending(false)
  }

  useEffect(() => {
    if (status === "authenticated") {
      fetchEvents()
    }
  }, [currentDate, status])

  const fetchEvents = async () => {
    setLoading(true)
    setCalendarError(null)
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const timeMin = new Date(year, month - 1, 20).toISOString()
    const timeMax = new Date(year, month + 1, 10).toISOString()

    try {
      const res = await fetch(`/api/calendar/events?timeMin=${timeMin}&timeMax=${timeMax}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setEvents({
        googleEvents: data.googleEvents ?? [],
        custodyEntries: data.custodyEntries ?? [],
        calendarSyncCount: data.calendarSyncCount ?? 0,
        importedEvents: data.importedEvents ?? [],
      })
    } catch (err: unknown) {
      console.error(err)
      setCalendarError(err instanceof Error ? err.message : "Failed to load calendar events.")
    } finally {
      setLoading(false)
    }
  }

  const daysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate()
  // Returns 0=Mon … 6=Sun offset so the grid starts on Monday
  const firstDayOfMonth = (year: number, month: number) =>
    (new Date(year, month, 1).getDay() + 6) % 7

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const todayStr = new Date().toDateString()

  const prevMonthDays = Array.from({ length: firstDayOfMonth(year, month) }, (_, i) => {
    const d = new Date(year, month, 0)
    d.setDate(d.getDate() - (firstDayOfMonth(year, month) - 1 - i))
    return { date: d, isCurrentMonth: false }
  })

  const currentMonthDays = Array.from({ length: daysInMonth(year, month) }, (_, i) => ({
    date: new Date(year, month, i + 1),
    isCurrentMonth: true,
  }))

  const totalDays = [...prevMonthDays, ...currentMonthDays]
  const remainingDays = 42 - totalDays.length
  const nextMonthDays = Array.from({ length: remainingDays }, (_, i) => ({
    date: new Date(year, month + 1, i + 1),
    isCurrentMonth: false,
  }))

  const allDays = [...totalDays, ...nextMonthDays]

  const nextMonth = () => { setOpenCustodyId(null); setCurrentDate(new Date(year, month + 1, 1)) }
  const prevMonth = () => { setOpenCustodyId(null); setCurrentDate(new Date(year, month - 1, 1)) }

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  const getEventsForDay = (date: Date) => {
    const dStr = date.toDateString()

    const google = events.googleEvents.filter((e) => {
      const start = e.start?.dateTime || e.start?.date
      return start ? new Date(start).toDateString() === dStr : false
    })

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    const custody = events.custodyEntries.filter((c) => c.date === dateStr)

    const imported = events.importedEvents.filter((e) => {
      if (e.allDay) return e.start <= dateStr && e.end > dateStr
      return new Date(e.start).toDateString() === dStr
    })

    return {
      google: showGoogle ? google : [],
      custody: showCustody ? custody : [],
      imported: showImported ? imported : [],
    }
  }

  if (status === "loading") return null
  if (status === "unauthenticated") return <div style={{ padding: "2rem" }}>Please sign in to view the calendar.</div>

  return (
    <div className={styles.calendarContainer}>
      {/* Header */}
      <header className={styles.calendarHeader}>
        <div className={styles.headerLeft}>
          <h1 className={styles.monthTitle}>
            {currentDate.toLocaleString("default", { month: "long", year: "numeric" })}
          </h1>
          <button
            onClick={() => {
              const today = new Date().toISOString().split("T")[0]
              const sixMonths = new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString().split("T")[0]
              setCStart(today)
              setCStartsWith("WITH_US")
              setCRecurring(true)
              setCUntil(sixMonths)
              setCConflictPending(false)
              setOpenCustodyId(null)
              setDeleteConfirming(false)
              setModalError(null)
              setModal("CUSTODY")
            }}
            className={styles.addBtn}
            aria-label="Add custody schedule"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className={styles.headerControls}>
          <button onClick={prevMonth} className={styles.navBtn} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className={styles.todayBtn}>
            Today
          </button>
          <button onClick={nextMonth} className={styles.navBtn} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
          {loading && <span className={styles.loadingIndicator}>Updating…</span>}
        </div>
      </header>

      {/* Filters */}
      <div className={styles.filterBar}>
        <span className={styles.filterLabel}>Show:</span>
        <button
          className={`${styles.filterBtn} ${styles.filterCustody} ${showCustody ? styles.filterBtnActive : ""}`}
          onClick={() => setShowCustody((v) => !v)}
        >
          <Baby size={12} strokeWidth={2} />
          Custody
        </button>
        <button
          className={`${styles.filterBtn} ${styles.filterGoogle} ${showGoogle ? styles.filterBtnActive : ""}`}
          onClick={() => setShowGoogle((v) => !v)}
        >
          Google Calendars
        </button>
        {events.importedEvents.length > 0 && (
          <button
            className={`${styles.filterBtn} ${styles.filterImported} ${showImported ? styles.filterBtnActive : ""}`}
            onClick={() => setShowImported((v) => !v)}
          >
            <Link2 size={12} strokeWidth={2} />
            Imported
          </button>
        )}
      </div>

      {/* No Calendars Prompt */}
      {events.calendarSyncCount === 0 && !loading && (
        <div className={styles.noCalendarsPrompt}>
          No Google calendars selected.{" "}
          <Link href="/settings" className={styles.noCalendarsLink}>
            Go to Settings →
          </Link>{" "}
          to choose which calendars to sync.
        </div>
      )}

      {/* Error banner */}
      {calendarError && (
        <div className={styles.errorBanner}>
          <span>Could not load Google Calendar events: {calendarError}</span>
          <button onClick={fetchEvents} className={styles.retryBtn}>Retry</button>
        </div>
      )}

      {/* Calendar Grid */}
      <div className={styles.calendarScrollWrapper}>
      <div className={styles.calendarGrid}>
        {weekdays.map((day) => (
          <div key={day} className={styles.weekdayHeader}>
            {day}
          </div>
        ))}

        {allDays.map((dayObj, i) => {
          const dayEvents = getEventsForDay(dayObj.date)
          const isToday = dayObj.isCurrentMonth && dayObj.date.toDateString() === todayStr

          return (
            <div
              key={i}
              className={[
                styles.dayCell,
                !dayObj.isCurrentMonth ? styles.notCurrentMonth : "",
                isToday ? styles.today : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className={styles.dayNumber}>
                {isToday ? (
                  <span className={styles.todayBadge}>{dayObj.date.getDate()}</span>
                ) : (
                  dayObj.date.getDate()
                )}
              </span>

              {dayEvents.custody.map((c) => {
                const spanPos = getCustodySpanPos(dayObj.date, c, events.custodyEntries)
                const spanClass = spanPos === "single" ? "" : spanPos === "start" ? styles.eventSpanStart : spanPos === "end" ? styles.eventSpanEnd : styles.eventSpanMiddle
                return (
                  <CustodyPill
                    key={c.id}
                    entry={c}
                    isOpen={openCustodyId === c.id}
                    onToggle={() => setOpenCustodyId(openCustodyId === c.id ? null : c.id)}
                    onClose={() => setOpenCustodyId(null)}
                    onSave={fetchEvents}
                    spanClass={spanClass}
                  />
                )
              })}

              {dayEvents.google.map((e, idx) => (
                <div
                  key={idx}
                  className={`${styles.eventItem} ${styles.googleEvent}`}
                  data-tooltip={googleEventTooltip(e)}
                  onClick={() => setEventDetail({ summary: e.summary ?? "", timeLabel: googleEventTooltip(e), calendarName: e.calendarName ?? undefined })}
                >
                  <span>{e.summary}</span>
                </div>
              ))}

              {dayEvents.imported.map((e, idx) => (
                <div
                  key={idx}
                  className={`${styles.eventItem} ${styles.importedEvent}`}
                  style={isDark ? { borderLeft: `3px solid ${e.calendarColor}` } : { backgroundColor: e.calendarColor }}
                  data-tooltip={`${e.allDay ? "All day" : new Date(e.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${e.calendarName ? " · " + e.calendarName : ""}`}
                  onClick={() => setEventDetail({ summary: e.summary, timeLabel: e.allDay ? "All day" : new Date(e.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), calendarName: e.calendarName, color: e.calendarColor })}
                >
                  <Link2 size={10} strokeWidth={2} />
                  <span>{e.summary}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
      </div>

      {/* Event detail modal */}
      {eventDetail && (
        <div className={styles.eventModalBackdrop} onClick={() => setEventDetail(null)}>
          <div className={styles.eventModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.eventModalHeader}>
              {eventDetail.color && <span className={styles.eventModalDot} style={{ background: eventDetail.color }} />}
              <span className={styles.eventModalTitle}>{eventDetail.summary}</span>
            </div>
            <div className={styles.eventModalMeta}>{eventDetail.timeLabel}</div>
            {eventDetail.calendarName && (
              <div className={styles.eventModalMeta}>{eventDetail.calendarName}</div>
            )}
            <button className={styles.eventModalClose} onClick={() => setEventDetail(null)}>Close</button>
          </div>
        </div>
      )}

      {/* Custody Modal */}
      {modal === "CUSTODY" && (
        <div className={styles.modalBackdrop} onClick={closeModal}>
          <form
            className={styles.modalContent}
            onSubmit={async (e) => {
              e.preventDefault()
              setModalError(null)
              try {
                const res = await fetch("/api/calendar/custody", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    startDate: cStart,
                    startsWith: cStartsWith,
                    recurring: cRecurring,
                    until: cRecurring ? cUntil : cStart,
                    force: cConflictPending,
                  }),
                })
                const data = await res.json()
                if (res.status === 409 && data.conflict) {
                  setCConflictPending(true)
                  return
                }
                if (!res.ok) throw new Error(data.error ?? "Failed to save")
                closeModal()
                fetchEvents()
              } catch (err: unknown) {
                setModalError(err instanceof Error ? err.message : "Failed to save")
              }
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Add Custody Schedule</h2>

            <div className={styles.formGroup}>
              <label htmlFor="cStart">First night</label>
              <input
                id="cStart"
                type="date"
                value={cStart}
                onChange={(e) => { setCStart(e.target.value); setCConflictPending(false) }}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Emilia sleeps at</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setCStartsWith("WITH_US")}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "6px",
                    border: cStartsWith === "WITH_US" ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: cStartsWith === "WITH_US" ? "var(--accent-soft)" : "transparent",
                    fontWeight: cStartsWith === "WITH_US" ? 700 : 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "0.875rem",
                  }}
                >
                  With us
                </button>
                <button
                  type="button"
                  onClick={() => setCStartsWith("WITH_MONA")}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "6px",
                    border: cStartsWith === "WITH_MONA" ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: cStartsWith === "WITH_MONA" ? "var(--accent-soft)" : "transparent",
                    fontWeight: cStartsWith === "WITH_MONA" ? 700 : 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "0.875rem",
                  }}
                >
                  Elsewhere
                </button>
              </div>
            </div>

            <div className={styles.formGroup}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ marginBottom: 0 }}>Recurring</label>
                <button
                  type="button"
                  onClick={() => setCRecurring(!cRecurring)}
                  style={{
                    width: "36px",
                    height: "20px",
                    borderRadius: "10px",
                    border: "none",
                    background: cRecurring ? "var(--primary)" : "var(--border)",
                    cursor: "pointer",
                    position: "relative",
                    transition: "background 150ms",
                  }}
                  aria-label="Toggle recurring"
                >
                  <span style={{
                    position: "absolute",
                    top: "2px",
                    left: cRecurring ? "calc(100% - 18px)" : "2px",
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    background: "white",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    transition: "left 150ms",
                  }} />
                </button>
              </div>
              {cRecurring && (
                <p style={{ fontSize: "0.75rem", color: "var(--secondary)", margin: "4px 0 0" }}>
                  Alternating weeks · switches on Sunday
                </p>
              )}
            </div>

            {cRecurring && (
              <div className={styles.formGroup}>
                <label htmlFor="cUntil">Until</label>
                <input
                  id="cUntil"
                  type="date"
                  value={cUntil}
                  onChange={(e) => setCUntil(e.target.value)}
                  required
                />
                {cStart && cUntil && (
                  <p style={{ fontSize: "0.75rem", color: "var(--secondary)", margin: "4px 0 0" }}>
                    Creates ~{Math.round((new Date(cUntil).getTime() - new Date(cStart).getTime()) / (7 * 24 * 60 * 60 * 1000))} weeks of schedule entries
                  </p>
                )}
              </div>
            )}

            {cConflictPending && (
              <p className={styles.modalError} style={{ background: "var(--warning-soft, #fff8e1)", borderColor: "var(--warning, #f59e0b)", color: "var(--warning-text, #92400e)" }}>
                There are already entries for these dates. Submit again to overwrite them.
              </p>
            )}
            {modalError && <p className={styles.modalError}>{modalError}</p>}

            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelBtn} onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className={cConflictPending ? styles.deleteBtnConfirm : styles.saveBtn}>
                {cConflictPending ? "Overwrite" : "Save Schedule"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
