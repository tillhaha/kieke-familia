// src/app/HeatingWidget.tsx
// Homepage widget: one row per Homematic IP heating room with current/target
// temperature and +/- controls. Renders nothing unless heating is connected.
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Minus, Plus, Droplets, AppWindow, BatteryLow, Flame } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
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
  windowOpen: boolean
  controlMode: ControlMode
  boost: boolean
  lowBattery: boolean
}

type Update = { setPointTemperature?: number; controlMode?: ControlMode; boost?: boolean }

const REFRESH_MS = 60_000
const SEND_DELAY_MS = 700 // batch quick +/+/+ clicks into one request
const STEP = 0.5

function fmt(temp: number | null) {
  return temp === null ? "–" : `${temp.toFixed(1)}°`
}

export function HeatingWidget() {
  const { t } = useTranslation()
  const [rooms, setRooms] = useState<Room[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const queued = useRef<Map<string, Update>>(new Map())

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/heating")
      if (!res.ok) return
      const data = await res.json()
      if (data.status !== "connected") {
        setRooms(null)
        return
      }
      setRooms(data.rooms ?? [])
      setError(data.error ? t.heating.loadFailed : null)
    } catch {
      setError(t.heating.loadFailed)
    }
  }, [t])

  useEffect(() => {
    load()
    const id = setInterval(() => {
      // Don't clobber rooms with changes still waiting to be sent
      if (document.visibilityState === "visible" && queued.current.size === 0) load()
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

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
      if (!queued.current.has(roomId)) setRooms((rs) => rs?.map((r) => (r.id === roomId ? room : r)) ?? rs)
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
  }, [load, t])

  const change = useCallback((roomId: string, update: Update, immediate = false) => {
    setRooms((rs) => rs?.map((r) => (r.id === roomId ? { ...r, ...update } : r)) ?? rs)
    queued.current.set(roomId, { ...queued.current.get(roomId), ...update })
    const existing = timers.current.get(roomId)
    if (existing) clearTimeout(existing)
    timers.current.set(roomId, setTimeout(() => send(roomId), immediate ? 0 : SEND_DELAY_MS))
  }, [send])

  if (!rooms) return null

  const modeLabel = (m: ControlMode) => (m === "MANUAL" ? t.heating.modeManual : m === "ECO" ? t.heating.modeEco : t.heating.modeAuto)

  return (
    <div className={styles.widget}>
      <div className={styles.title}>{t.heating.widgetTitle}</div>
      {rooms.length === 0 ? (
        <p className={styles.empty}>{error ?? t.heating.noRooms}</p>
      ) : (
        <div className={styles.list}>
          {rooms.map((room) => {
            const target = room.setPointTemperature
            const bump = (delta: number) => {
              if (target === null) return
              const next = Math.min(room.maxTemperature, Math.max(room.minTemperature, Math.round((target + delta) * 2) / 2))
              if (next !== target) change(room.id, { setPointTemperature: next })
            }
            return (
              <div key={room.id} className={`${styles.row} ${pending.has(room.id) ? styles.pending : ""}`}>
                <div className={styles.info}>
                  <span className={styles.name}>{room.name}</span>
                  <span className={styles.meta}>
                    <span className={styles.actual}>{fmt(room.actualTemperature)}</span>
                    {room.humidity !== null && (
                      <span className={styles.metaItem} title={t.heating.humidity}>
                        <Droplets size={12} /> {room.humidity}%
                      </span>
                    )}
                    {room.windowOpen && (
                      <span className={`${styles.metaItem} ${styles.warn}`} title={t.heating.windowOpen}>
                        <AppWindow size={12} /> {t.heating.windowOpen}
                      </span>
                    )}
                    {room.lowBattery && (
                      <span className={`${styles.metaItem} ${styles.warn}`} title={t.heating.lowBattery}>
                        <BatteryLow size={12} /> {t.heating.lowBattery}
                      </span>
                    )}
                  </span>
                </div>
                <div className={styles.controls}>
                  <button
                    className={`${styles.chip} ${room.controlMode !== "AUTOMATIC" ? styles.chipActive : ""}`}
                    onClick={() => change(room.id, { controlMode: room.controlMode === "AUTOMATIC" ? "MANUAL" : "AUTOMATIC" }, true)}
                    title={modeLabel(room.controlMode)}
                  >
                    {modeLabel(room.controlMode)}
                  </button>
                  <button
                    className={`${styles.chip} ${room.boost ? styles.chipBoost : ""}`}
                    onClick={() => change(room.id, { boost: !room.boost }, true)}
                    title={t.heating.boost}
                    aria-pressed={room.boost}
                  >
                    <Flame size={12} />
                  </button>
                  <button className={styles.stepBtn} onClick={() => bump(-STEP)} aria-label="−" disabled={target === null || target <= room.minTemperature}>
                    <Minus size={14} />
                  </button>
                  <span className={styles.target} title={t.heating.target}>{fmt(target)}</span>
                  <button className={styles.stepBtn} onClick={() => bump(STEP)} aria-label="+" disabled={target === null || target >= room.maxTemperature}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {rooms.length > 0 && error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
