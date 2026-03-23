// src/app/calendar/page.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Cake, Plane, Plus, Baby } from "lucide-react"
import styles from "./calendar.module.css"
import CustodyPopover from "./CustodyPopover"

type ModalType = "NONE" | "BIRTHDAY" | "TRAVEL" | "CUSTODY" | "ADD"
type AddTab = "BIRTHDAY" | "TRAVEL" | "CUSTODY"

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
type BirthdayEntry = { id: string; name: string; month: number; day: number; year?: number | null }
type TravelEntry = { id: string; destination: string; startDate: string; endDate: string; userId: string }

type SpanPos = "single" | "start" | "middle" | "end"

function getTravelSpanPos(date: Date, t: TravelEntry): SpanPos {
  const d = date.getDay()
  const check = new Date(date); check.setHours(0, 0, 0, 0)
  const start = new Date(t.startDate); start.setHours(0, 0, 0, 0)
  const end = new Date(t.endDate); end.setHours(0, 0, 0, 0)
  if (start.getTime() === end.getTime()) return "single"
  const isSpanStart = check.getTime() === start.getTime() || d === 1
  const isSpanEnd = check.getTime() === end.getTime() || d === 0
  if (isSpanStart && isSpanEnd) return "single"
  if (isSpanStart) return "start"
  if (isSpanEnd) return "end"
  return "middle"
}

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
    birthdays: BirthdayEntry[]
    travels: TravelEntry[]
    custodyEntries: CustodyEntry[]
    calendarSyncCount: number
  }>({
    googleEvents: [],
    birthdays: [],
    travels: [],
    custodyEntries: [],
    calendarSyncCount: 0,
  })
  const [loading, setLoading] = useState(false)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalType>("NONE")

  // Birthday form state
  const [bName, setBName] = useState("")
  const [bMonth, setBMonth] = useState(new Date().getMonth() + 1)
  const [bDay, setBDay] = useState(new Date().getDate())
  const [bYear, setBYear] = useState<string>("")

  // Travel form state
  const [tDest, setTDest] = useState("")
  const [tStart, setTStart] = useState(new Date().toISOString().split("T")[0])
  const [tEnd, setTEnd] = useState(new Date().toISOString().split("T")[0])

  // Edit mode state
  const [editingBirthday, setEditingBirthday] = useState<{
    id: string; name: string; month: number; day: number; year?: number | null
  } | null>(null)
  const [editingTravel, setEditingTravel] = useState<{
    id: string; destination: string; startDate: string; endDate: string
  } | null>(null)
  const [deleteConfirming, setDeleteConfirming] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  // Add modal tab state
  const [addTab, setAddTab] = useState<AddTab>("BIRTHDAY")

  // Filter state
  const [showBirthdays, setShowBirthdays] = useState(true)
  const [showTravel, setShowTravel] = useState(true)
  const [showCustody, setShowCustody] = useState(true)
  const [showGoogle, setShowGoogle] = useState(true)

  // Custody popover + modal form state
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
        birthdays: data.birthdays ?? [],
        travels: data.travels ?? [],
        custodyEntries: data.custodyEntries ?? [],
        calendarSyncCount: data.calendarSyncCount ?? 0,
      })
    } catch (err: unknown) {
      console.error(err)
      setCalendarError(err instanceof Error ? err.message : "Failed to load calendar events.")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveBirthday = async (e: React.FormEvent) => {
    e.preventDefault()
    setModalError(null)
    try {
      const url = editingBirthday
        ? `/api/calendar/birthdays/${editingBirthday.id}`
        : "/api/calendar/birthdays"
      const res = await fetch(url, {
        method: editingBirthday ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: bName, month: bMonth, day: bDay, year: bYear ? parseInt(bYear) : null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to save")
      closeModal()
      fetchEvents()
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Failed to save")
    }
  }

  const handleDeleteBirthday = async () => {
    if (!editingBirthday) return
    if (!deleteConfirming) {
      setDeleteConfirming(true)
      return
    }
    setModalError(null)
    try {
      const res = await fetch(`/api/calendar/birthdays/${editingBirthday.id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to delete")
      closeModal()
      fetchEvents()
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Failed to delete")
      setDeleteConfirming(false)
    }
  }

  const handleSaveTravel = async (e: React.FormEvent) => {
    e.preventDefault()
    setModalError(null)
    try {
      const url = editingTravel
        ? `/api/calendar/travel/${editingTravel.id}`
        : "/api/calendar/travel"
      const res = await fetch(url, {
        method: editingTravel ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: tDest, startDate: tStart, endDate: tEnd }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to save")
      closeModal()
      fetchEvents()
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Failed to save")
    }
  }

  const handleDeleteTravel = async () => {
    if (!editingTravel) return
    if (!deleteConfirming) {
      setDeleteConfirming(true)
      return
    }
    setModalError(null)
    try {
      const res = await fetch(`/api/calendar/travel/${editingTravel.id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to delete")
      closeModal()
      fetchEvents()
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Failed to delete")
      setDeleteConfirming(false)
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

    const birthdays = events.birthdays.filter(
      (b) => b.month === date.getMonth() + 1 && b.day === date.getDate()
    )

    const travels = events.travels.filter((t) => {
      const checkDate = new Date(date)
      checkDate.setHours(0, 0, 0, 0)
      const s = new Date(t.startDate)
      s.setHours(0, 0, 0, 0)
      const e = new Date(t.endDate)
      e.setHours(0, 0, 0, 0)
      return checkDate >= s && checkDate <= e
    })

    // Custody: compare as YYYY-MM-DD strings to avoid timezone issues
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    const custody = events.custodyEntries.filter((c) => c.date === dateStr)

    return {
      google: showGoogle ? google : [],
      birthdays: showBirthdays ? birthdays : [],
      travels: showTravel ? travels : [],
      custody: showCustody ? custody : [],
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
              setEditingBirthday(null)
              setBName("")
              setBMonth(new Date().getMonth() + 1)
              setBDay(new Date().getDate())
              setBYear("")
              setEditingTravel(null)
              setTDest("")
              setTStart(new Date().toISOString().split("T")[0])
              setTEnd(new Date().toISOString().split("T")[0])
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
              setAddTab("BIRTHDAY")
              setModal("ADD")
            }}
            className={styles.addBtn}
            aria-label="Add event"
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
          className={`${styles.filterBtn} ${styles.filterBirthday} ${showBirthdays ? styles.filterBtnActive : ""}`}
          onClick={() => setShowBirthdays((v) => !v)}
        >
          <Cake size={12} strokeWidth={2} />
          Birthdays
        </button>
        <button
          className={`${styles.filterBtn} ${styles.filterTravel} ${showTravel ? styles.filterBtnActive : ""}`}
          onClick={() => setShowTravel((v) => !v)}
        >
          <Plane size={12} strokeWidth={2} />
          Travel
        </button>
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
                >
                  <span>{e.summary}</span>
                </div>
              ))}

              {dayEvents.birthdays.map((b, idx) => (
                <div
                  key={idx}
                  className={`${styles.eventItem} ${styles.birthdayEvent}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setEditingBirthday({ id: b.id, name: b.name, month: b.month, day: b.day, year: b.year })
                    setBName(b.name)
                    setBMonth(b.month)
                    setBDay(b.day)
                    setBYear(b.year ? String(b.year) : "")
                    setDeleteConfirming(false)
                    setModalError(null)
                    setModal("BIRTHDAY")
                  }}
                  data-tooltip={b.name}
                >
                  <Cake size={10} strokeWidth={2} />
                  <span>{b.name}</span>
                </div>
              ))}

              {dayEvents.travels.map((t, idx) => {
                const currentUserId = (session?.user as { id?: string })?.id
                const isOwner = t.userId === currentUserId
                const spanPos = getTravelSpanPos(dayObj.date, t)
                const spanClass = spanPos === "single" ? "" : spanPos === "start" ? styles.eventSpanStart : spanPos === "end" ? styles.eventSpanEnd : styles.eventSpanMiddle
                return (
                  <div
                    key={idx}
                    className={`${styles.eventItem} ${styles.travelEvent} ${spanClass}`}
                    style={isOwner ? { cursor: "pointer" } : undefined}
                    onClick={
                      isOwner
                        ? () => {
                            setEditingTravel({
                              id: t.id,
                              destination: t.destination,
                              startDate: new Date(t.startDate).toISOString().split("T")[0],
                              endDate: new Date(t.endDate).toISOString().split("T")[0],
                            })
                            setTDest(t.destination)
                            setTStart(new Date(t.startDate).toISOString().split("T")[0])
                            setTEnd(new Date(t.endDate).toISOString().split("T")[0])
                            setDeleteConfirming(false)
                            setModalError(null)
                            setModal("TRAVEL")
                          }
                        : undefined
                    }
                    data-tooltip={t.destination}
                  >
                    <Plane size={10} strokeWidth={2} />
                    <span>{t.destination}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Add Modal (tabbed) */}
      {modal === "ADD" && (
        <div className={styles.modalBackdrop} onClick={closeModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTabNav}>
              <button
                type="button"
                className={`${styles.modalTab} ${addTab === "BIRTHDAY" ? styles.modalTabActive : ""}`}
                onClick={() => setAddTab("BIRTHDAY")}
              >
                <Cake size={13} strokeWidth={2} /> Birthday
              </button>
              <button
                type="button"
                className={`${styles.modalTab} ${addTab === "TRAVEL" ? styles.modalTabActive : ""}`}
                onClick={() => setAddTab("TRAVEL")}
              >
                <Plane size={13} strokeWidth={2} /> Travel
              </button>
              <button
                type="button"
                className={`${styles.modalTab} ${addTab === "CUSTODY" ? styles.modalTabActive : ""}`}
                onClick={() => setAddTab("CUSTODY")}
              >
                <Baby size={13} strokeWidth={2} /> Custody
              </button>
            </div>

            {addTab === "BIRTHDAY" && (
              <form onSubmit={handleSaveBirthday}>
                <div className={styles.formGroup}>
                  <label htmlFor="add-bName">Name</label>
                  <input id="add-bName" type="text" value={bName} onChange={(e) => setBName(e.target.value)} placeholder="Who's birthday is it?" required />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="add-bDay">Day</label>
                    <input id="add-bDay" type="number" min="1" max="31" value={bDay} onChange={(e) => setBDay(parseInt(e.target.value))} required />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="add-bMonth">Month</label>
                    <select id="add-bMonth" value={bMonth} onChange={(e) => setBMonth(parseInt(e.target.value))} required>
                      {["January","February","March","April","May","June","July","August","September","October","November","December"].map((name, i) => (
                        <option key={i + 1} value={i + 1}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="add-bYear">Year <span style={{ fontWeight: 400, color: "var(--secondary)" }}>(optional)</span></label>
                    <input id="add-bYear" type="number" min="1900" max={new Date().getFullYear()} value={bYear} onChange={(e) => setBYear(e.target.value)} placeholder="e.g. 1990" />
                  </div>
                </div>
                {modalError && <p className={styles.modalError}>{modalError}</p>}
                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancelBtn} onClick={closeModal}>Cancel</button>
                  <button type="submit" className={styles.saveBtn}>Save</button>
                </div>
              </form>
            )}

            {addTab === "TRAVEL" && (
              <form onSubmit={handleSaveTravel}>
                <div className={styles.formGroup}>
                  <label htmlFor="add-tDest">Destination</label>
                  <input id="add-tDest" type="text" value={tDest} onChange={(e) => setTDest(e.target.value)} placeholder="Where are you going?" required />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="add-tStart">Start Date</label>
                    <input id="add-tStart" type="date" value={tStart} onChange={(e) => { const v = e.target.value; setTStart(v); setTEnd(v) }} required />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="add-tEnd">End Date</label>
                    <input id="add-tEnd" type="date" value={tEnd} min={tStart} onChange={(e) => setTEnd(e.target.value)} required />
                  </div>
                </div>
                {modalError && <p className={styles.modalError}>{modalError}</p>}
                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancelBtn} onClick={closeModal}>Cancel</button>
                  <button type="submit" className={styles.saveBtn}>Save</button>
                </div>
              </form>
            )}

            {addTab === "CUSTODY" && (
              <form onSubmit={async (e) => {
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
                  if (res.status === 409 && data.conflict) { setCConflictPending(true); return }
                  if (!res.ok) throw new Error(data.error ?? "Failed to save")
                  closeModal()
                  fetchEvents()
                } catch (err: unknown) {
                  setModalError(err instanceof Error ? err.message : "Failed to save")
                }
              }}>
                <div className={styles.formGroup}>
                  <label htmlFor="add-cStart">First night</label>
                  <input id="add-cStart" type="date" value={cStart} onChange={(e) => { setCStart(e.target.value); setCConflictPending(false) }} required />
                </div>
                <div className={styles.formGroup}>
                  <label>Emilia sleeps at</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button type="button" onClick={() => setCStartsWith("WITH_US")} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: cStartsWith === "WITH_US" ? "2px solid var(--primary)" : "1px solid var(--border)", background: cStartsWith === "WITH_US" ? "var(--accent-soft)" : "transparent", fontWeight: cStartsWith === "WITH_US" ? 700 : 500, cursor: "pointer", fontFamily: "inherit", fontSize: "0.875rem" }}>
                      With us
                    </button>
                    <button type="button" onClick={() => setCStartsWith("WITH_MONA")} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: cStartsWith === "WITH_MONA" ? "2px solid var(--primary)" : "1px solid var(--border)", background: cStartsWith === "WITH_MONA" ? "var(--accent-soft)" : "transparent", fontWeight: cStartsWith === "WITH_MONA" ? 700 : 500, cursor: "pointer", fontFamily: "inherit", fontSize: "0.875rem" }}>
                      Elsewhere
                    </button>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ marginBottom: 0 }}>Recurring</label>
                    <button type="button" onClick={() => setCRecurring(!cRecurring)} style={{ width: "36px", height: "20px", borderRadius: "10px", border: "none", background: cRecurring ? "var(--primary)" : "var(--border)", cursor: "pointer", position: "relative", transition: "background 150ms" }} aria-label="Toggle recurring">
                      <span style={{ position: "absolute", top: "2px", left: cRecurring ? "calc(100% - 18px)" : "2px", width: "16px", height: "16px", borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 150ms" }} />
                    </button>
                  </div>
                  {cRecurring && <p style={{ fontSize: "0.75rem", color: "var(--secondary)", margin: "4px 0 0" }}>Alternating weeks · switches on Sunday</p>}
                </div>
                {cRecurring && (
                  <div className={styles.formGroup}>
                    <label htmlFor="add-cUntil">Until</label>
                    <input id="add-cUntil" type="date" value={cUntil} onChange={(e) => setCUntil(e.target.value)} required />
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
                  <button type="button" className={styles.cancelBtn} onClick={closeModal}>Cancel</button>
                  <button type="submit" className={cConflictPending ? styles.deleteBtnConfirm : styles.saveBtn}>
                    {cConflictPending ? "Overwrite" : "Save Schedule"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Birthday Modal */}
      {modal === "BIRTHDAY" && (
        <div className={styles.modalBackdrop} onClick={closeModal}>
          <form
            className={styles.modalContent}
            onSubmit={handleSaveBirthday}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{editingBirthday ? "Edit Birthday" : "Add Birthday"}</h2>
            <div className={styles.formGroup}>
              <label htmlFor="bName">Name</label>
              <input
                id="bName"
                type="text"
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                placeholder="Who's birthday is it?"
                required
              />
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="bDay">Day</label>
                <input
                  id="bDay"
                  type="number"
                  min="1"
                  max="31"
                  value={bDay}
                  onChange={(e) => setBDay(parseInt(e.target.value))}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="bMonth">Month</label>
                <select
                  id="bMonth"
                  value={bMonth}
                  onChange={(e) => setBMonth(parseInt(e.target.value))}
                  required
                >
                  {["January","February","March","April","May","June","July","August","September","October","November","December"].map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="bYear">Year <span style={{ fontWeight: 400, color: "var(--secondary)" }}>(optional)</span></label>
                <input
                  id="bYear"
                  type="number"
                  min="1900"
                  max={new Date().getFullYear()}
                  value={bYear}
                  onChange={(e) => setBYear(e.target.value)}
                  placeholder="e.g. 1990"
                />
              </div>
            </div>
            {modalError && <p className={styles.modalError}>{modalError}</p>}
            <div className={styles.modalActions}>
              {editingBirthday && (
                <button
                  type="button"
                  className={deleteConfirming ? styles.deleteBtnConfirm : styles.deleteBtn}
                  onClick={handleDeleteBirthday}
                >
                  {deleteConfirming ? "Confirm delete" : "Delete"}
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button type="button" className={styles.cancelBtn} onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className={styles.saveBtn}>
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Travel Modal */}
      {modal === "TRAVEL" && (
        <div className={styles.modalBackdrop} onClick={closeModal}>
          <form
            className={styles.modalContent}
            onSubmit={handleSaveTravel}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{editingTravel ? "Edit Travel" : "Add Travel"}</h2>
            <div className={styles.formGroup}>
              <label htmlFor="tDest">Destination</label>
              <input
                id="tDest"
                type="text"
                value={tDest}
                onChange={(e) => setTDest(e.target.value)}
                placeholder="Where are you going?"
                required
              />
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="tStart">Start Date</label>
                <input
                  id="tStart"
                  type="date"
                  value={tStart}
                  onChange={(e) => { const v = e.target.value; setTStart(v); setTEnd(v) }}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="tEnd">End Date</label>
                <input
                  id="tEnd"
                  type="date"
                  value={tEnd}
                  min={tStart}
                  onChange={(e) => setTEnd(e.target.value)}
                  required
                />
              </div>
            </div>
            {modalError && <p className={styles.modalError}>{modalError}</p>}
            <div className={styles.modalActions}>
              {editingTravel && (
                <button
                  type="button"
                  className={deleteConfirming ? styles.deleteBtnConfirm : styles.deleteBtn}
                  onClick={handleDeleteTravel}
                >
                  {deleteConfirming ? "Confirm delete" : "Delete"}
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button type="button" className={styles.cancelBtn} onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className={styles.saveBtn}>
                Save
              </button>
            </div>
          </form>
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
