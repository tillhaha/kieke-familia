// src/app/heating/page.tsx
// Heating page: Access Point status plus one card per Homematic IP heating room
// with current/target temperature, mode, boost and +/- controls.
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { Minus, Plus, Droplets, AppWindow, BatteryLow, Flame, Thermometer, Settings, Gauge, CalendarClock, ChevronDown } from "lucide-react"
import { useFamilyFeatures } from "@/components/FamilyFeatures"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import { Page } from "@/components/ui/Page"
import { PageHeader } from "@/components/ui/PageHeader"
import { EmptyState } from "@/components/ui/EmptyState"
import { Button } from "@/components/ui/Button"
import { HEATING_STATUS_EVENT } from "@/components/HeatingStatusIcon"
import { WeekSchedule, type Schedule, fmtTemp, nextSwitch } from "./WeekSchedule"
import styles from "./heating.module.css"

type ControlMode = "AUTOMATIC" | "MANUAL" | "ECO"

type Room = {
  id: string
  name: string
  actualTemperature: number | null
  setPointTemperature: number | null
  minTemperature: number
  maxTemperature: number
  humidity: number | null
  valvePosition: number | null
  windowOpen: boolean
  controlMode: ControlMode
  boost: boolean
  lowBattery: boolean
  thermostatCount: number
  activeProfile: { index: string; name: string } | null
}

type State =
  | { status: "loading" }
  | { status: "disconnected" | "pairing" }
  | { status: "connected"; accessPointOnline: boolean | null; rooms: Room[]; error?: string }

type Update = { setPointTemperature?: number; controlMode?: ControlMode; boost?: boolean }

const REFRESH_MS = 60_000
const SCHEDULE_REFRESH_MS = 10 * 60_000
const SEND_DELAY_MS = 700 // batch quick +/+/+ clicks into one request
const STEP = 0.5
const MODES: ControlMode[] = ["AUTOMATIC", "MANUAL", "ECO"]

function fmt(temp: number | null) {
  return temp === null ? "–" : `${temp.toFixed(1)}°`
}

export default function HeatingPage() {
  const { status: sessionStatus } = useSession()
  const { t, lang } = useTranslation()
  const { features } = useFamilyFeatures()
  const [state, setState] = useState<State>({ status: "loading" })
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const queued = useRef<Map<string, Update>>(new Map())
  const [schedules, setSchedules] = useState<Record<string, Schedule | null>>({})
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string>>({})
  const [openSchedules, setOpenSchedules] = useState<Set<string>>(new Set())
  const [now, setNow] = useState(() => new Date())

  const setRooms = useCallback((fn: (rooms: Room[]) => Room[]) => {
    setState((s) => (s.status === "connected" ? { ...s, rooms: fn(s.rooms) } : s))
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/heating")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setState(data.status === "connected" ? data : { status: data.status })
      setError(data.error ? t.heating.loadFailed : null)
    } catch {
      setError(t.heating.loadFailed)
      setState((s) => (s.status === "loading" ? { status: "connected", accessPointOnline: null, rooms: [] } : s))
    } finally {
      // Let the navbar icon pick up the latest status
      window.dispatchEvent(new Event(HEATING_STATUS_EVENT))
    }
  }, [t])

  useEffect(() => {
    if (sessionStatus !== "authenticated") return
    load()
    const id = setInterval(() => {
      // Don't clobber rooms with changes still waiting to be sent
      if (document.visibilityState === "visible" && queued.current.size === 0) load()
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [load, sessionStatus])

  // Schedules change rarely (only when edited in the Homematic IP app)
  const connected = state.status === "connected"
  useEffect(() => {
    if (!connected) return
    const loadSchedules = () =>
      fetch("/api/heating/schedules")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.schedules) return
          setSchedules(d.schedules)
          setScheduleErrors(d.errors ?? {})
        })
        .catch(() => {})
    loadSchedules()
    const id = setInterval(() => {
      setNow(new Date())
      if (document.visibilityState === "visible") loadSchedules()
    }, SCHEDULE_REFRESH_MS)
    const tick = setInterval(() => setNow(new Date()), 60_000)
    return () => {
      clearInterval(id)
      clearInterval(tick)
    }
  }, [connected])

  const toggleSchedule = (roomId: string) =>
    setOpenSchedules((s) => {
      const n = new Set(s)
      if (n.has(roomId)) n.delete(roomId)
      else n.add(roomId)
      return n
    })

  useEffect(() => {
    const pendingTimers = timers.current
    return () => pendingTimers.forEach((tm) => clearTimeout(tm))
  }, [])

  const send = useCallback(async (roomId: string) => {
    const update = queued.current.get(roomId)
    queued.current.delete(roomId)
    timers.current.delete(roomId)
    if (!update) return
    setPending((p) => new Set(p).add(roomId))
    try {
      const res = await fetch(`/api/heating/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      })
      if (!res.ok) throw new Error()
      const { room } = await res.json()
      // Keep the optimistic value if the user clicked again meanwhile
      if (!queued.current.has(roomId)) setRooms((rs) => rs.map((r) => (r.id === roomId ? room : r)))
      setError(null)
    } catch {
      setError(t.heating.errUnknown)
      load()
    } finally {
      setPending((p) => {
        const n = new Set(p)
        n.delete(roomId)
        return n
      })
    }
  }, [load, setRooms, t])

  const change = useCallback((roomId: string, update: Update, immediate = false) => {
    setRooms((rs) => rs.map((r) => (r.id === roomId ? { ...r, ...update } : r)))
    queued.current.set(roomId, { ...queued.current.get(roomId), ...update })
    const existing = timers.current.get(roomId)
    if (existing) clearTimeout(existing)
    timers.current.set(roomId, setTimeout(() => send(roomId), immediate ? 0 : SEND_DELAY_MS))
  }, [send, setRooms])

  if (sessionStatus !== "authenticated" || !features) return null

  // Heating is an optional module (Settings → Family → Features)
  if (!features.heating) {
    return (
      <Page width="narrow">
        <PageHeader title={t.heating.pageTitle} />
        <EmptyState
          icon={<Thermometer size={22} strokeWidth={1.75} />}
          action={
            <Button variant="primary" size="sm" href="/settings?section=family">
              {t.heating.enableInSettings}
            </Button>
          }
        >
          {t.heating.disabled}
        </EmptyState>
      </Page>
    )
  }

  if (state.status === "loading") return null

  const settingsButton = (
    <Button variant="secondary" size="sm" href="/settings?section=heating" icon={<Settings size={14} />}>
      {t.heating.connection}
    </Button>
  )

  if (state.status !== "connected") {
    return (
      <Page width="narrow">
        <PageHeader title={t.heating.pageTitle} />
        <EmptyState
          icon={<Thermometer size={22} strokeWidth={1.75} />}
          action={
            <Button variant="primary" size="sm" href="/settings?section=heating">
              {t.heating.goToSettings}
            </Button>
          }
        >
          {state.status === "pairing" ? t.heating.statusPairing : t.heating.notConnected}
        </EmptyState>
      </Page>
    )
  }

  const dayFmt = new Intl.DateTimeFormat(lang, { weekday: "long" })
  const switchText = (sw: NonNullable<ReturnType<typeof nextSwitch>>) => {
    const when =
      sw.dayOffset === 0 ? t.heating.today
      : sw.dayOffset === 1 ? t.heating.tomorrow
      : dayFmt.format(new Date(now.getFullYear(), now.getMonth(), now.getDate() + sw.dayOffset))
    return t.heating.nextSwitch.replace("{when}", when).replace("{time}", sw.time).replace("{temp}", fmtTemp(sw.temperature))
  }

  const modeLabel = (m: ControlMode) => (m === "MANUAL" ? t.heating.modeManual : m === "ECO" ? t.heating.modeEco : t.heating.modeAuto)
  const online = state.accessPointOnline
  const statusClass = online === true ? styles.badgeOnline : styles.badgeOffline
  const statusText = online === true ? t.heating.statusOnline : online === false ? t.heating.statusOffline : t.heating.statusError

  return (
    <Page width="narrow">
      <PageHeader
        title={t.heating.pageTitle}
        addon={
          <span className={`${styles.badge} ${statusClass}`}>
            <span className={styles.badgeDot} />
            {statusText}
          </span>
        }
        actions={settingsButton}
      />

      {online === false && <p className={styles.notice}>{t.heating.offlineHint}</p>}

      {state.rooms.length === 0 ? (
        <EmptyState icon={<Thermometer size={22} strokeWidth={1.75} />}>{error ?? t.heating.noRooms}</EmptyState>
      ) : (
        <div className={styles.grid}>
          {state.rooms.map((room) => {
            const target = room.setPointTemperature
            const bump = (delta: number) => {
              if (target === null) return
              const next = Math.min(room.maxTemperature, Math.max(room.minTemperature, Math.round((target + delta) * 2) / 2))
              if (next !== target) change(room.id, { setPointTemperature: next })
            }
            return (
              <section key={room.id} className={`${styles.card} ${pending.has(room.id) ? styles.pending : ""}`}>
                <div className={styles.cardHead}>
                  <h2 className={styles.name}>{room.name}</h2>
                  <div className={styles.warnings}>
                    {room.windowOpen && (
                      <span className={styles.warn}>
                        <AppWindow size={13} /> {t.heating.windowOpen}
                      </span>
                    )}
                    {room.lowBattery && (
                      <span className={styles.warn}>
                        <BatteryLow size={13} /> {t.heating.lowBattery}
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.temps}>
                  <div className={styles.actualBlock}>
                    <span className={styles.label}>{t.heating.current}</span>
                    <span className={styles.actual}>{fmt(room.actualTemperature)}</span>
                  </div>
                  <div className={styles.targetBlock}>
                    <span className={styles.label}>{t.heating.target}</span>
                    <div className={styles.stepper}>
                      <button
                        className={styles.stepBtn}
                        onClick={() => bump(-STEP)}
                        aria-label={`${t.heating.target} −${STEP}°`}
                        disabled={target === null || target <= room.minTemperature}
                      >
                        <Minus size={16} />
                      </button>
                      <span className={styles.target}>{fmt(target)}</span>
                      <button
                        className={styles.stepBtn}
                        onClick={() => bump(STEP)}
                        aria-label={`${t.heating.target} +${STEP}°`}
                        disabled={target === null || target >= room.maxTemperature}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className={styles.controls}>
                  <div className={styles.segmented} role="group" aria-label={t.heating.mode}>
                    {MODES.map((m) => (
                      <button
                        key={m}
                        className={`${styles.segment} ${room.controlMode === m ? styles.segmentActive : ""}`}
                        aria-pressed={room.controlMode === m}
                        onClick={() => room.controlMode !== m && change(room.id, { controlMode: m }, true)}
                      >
                        {modeLabel(m)}
                      </button>
                    ))}
                  </div>
                  <button
                    className={`${styles.boost} ${room.boost ? styles.boostActive : ""}`}
                    onClick={() => change(room.id, { boost: !room.boost }, true)}
                    aria-pressed={room.boost}
                  >
                    <Flame size={14} /> {t.heating.boost}
                  </button>
                </div>

                {(() => {
                  const schedule = schedules[room.id]
                  const scheduleError = scheduleErrors[room.id]
                  if (!schedule) {
                    if (!scheduleError) return null
                    return (
                      <div className={styles.scheduleBlock}>
                        <span className={styles.nextSwitch} title={scheduleError}>
                          <CalendarClock size={14} />
                          {t.heating.scheduleFailed}
                        </span>
                      </div>
                    )
                  }
                  const sw = room.controlMode === "AUTOMATIC" ? nextSwitch(schedule, now) : null
                  const open = openSchedules.has(room.id)
                  return (
                    <div className={styles.scheduleBlock}>
                      <div className={styles.scheduleBar}>
                        <span className={styles.nextSwitch}>
                          <CalendarClock size={14} />
                          {room.controlMode !== "AUTOMATIC" ? t.heating.scheduleInactive : sw ? switchText(sw) : t.heating.noSwitch}
                        </span>
                        <button
                          className={styles.scheduleToggle}
                          onClick={() => toggleSchedule(room.id)}
                          aria-expanded={open}
                        >
                          {t.heating.weekPlan}
                          <ChevronDown size={14} className={open ? styles.chevronOpen : ""} />
                        </button>
                      </div>
                      {open && <WeekSchedule schedule={schedule} />}
                    </div>
                  )
                })()}

                <div className={styles.meta}>
                  {room.humidity !== null && (
                    <span className={styles.metaItem}>
                      <Droplets size={13} /> {t.heating.humidity} {room.humidity}%
                    </span>
                  )}
                  {room.valvePosition !== null && (
                    <span className={styles.metaItem}>
                      <Gauge size={13} /> {t.heating.valve} {Math.round(room.valvePosition * 100)}%
                    </span>
                  )}
                  {room.thermostatCount > 0 && (
                    <span className={styles.metaItem}>
                      <Thermometer size={13} /> {room.thermostatCount} {t.heating.thermostats}
                    </span>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {state.rooms.length > 0 && error && <p className={styles.error}>{error}</p>}
      {state.rooms.some((r) => r.controlMode === "AUTOMATIC") && <p className={styles.hint}>{t.heating.autoHint}</p>}
      {Object.values(schedules).some(Boolean) && <p className={styles.hint}>{t.heating.scheduleHint}</p>}
    </Page>
  )
}
