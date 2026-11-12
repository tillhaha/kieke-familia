// src/app/settings/HeatingAutomationSection.tsx
// Settings → Heating → Smart schedule: lower rooms each morning when their people aren't home
// (week planner work location / custody). Logic lives in src/lib/homematic/automation.ts.
"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import { Button } from "@/components/ui/Button"
import type { AutomationRule, AutomationRun, ConditionState } from "@/lib/homematic/automation"
import styles from "./settings.module.css"
import own from "./HeatingAutomationSection.module.css"

type Data =
  | { connected: false }
  | {
      connected: true
      settings: { enabled: boolean; baseTemperature: number; time: string; rules: AutomationRule[] }
      rooms: { id: string; name: string; thermostatCount: number }[]
      roomsError: string | null
      members: { id: string; name: string }[]
      children: string[]
      preview: { roomId: string; today: ConditionState; tomorrow: ConditionState }[]
      today: string
      tomorrow: string
      lastRun: AutomationRun | null
    }

/** "" = no rule, "work:<userId>", "child:<personName>" */
function ruleKey(rule: AutomationRule | undefined): string {
  if (!rule) return ""
  return rule.type === "WORK_AWAY" ? `work:${rule.userId}` : `child:${rule.personName}`
}

function ruleFromKey(roomId: string, key: string): AutomationRule | null {
  if (key.startsWith("work:")) return { roomId, type: "WORK_AWAY", userId: key.slice(5) }
  if (key.startsWith("child:")) return { roomId, type: "CHILD_AWAY", personName: key.slice(6) }
  return null
}

export function HeatingAutomationSection() {
  const { t, lang } = useTranslation()
  const tr = t.heatingAuto
  const fmtTemp = (n: number | null | undefined) => (typeof n === "number" ? `${n.toLocaleString(lang)} °C` : "?")
  const [data, setData] = useState<Data | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [baseTemperature, setBaseTemperature] = useState("18")
  const [time, setTime] = useState("08:00")
  const [ruleKeys, setRuleKeys] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/heating/automation")
      const d = (await res.json()) as Data
      setData(d)
      if (d.connected) {
        setEnabled(d.settings.enabled)
        setBaseTemperature(String(d.settings.baseTemperature))
        setTime(d.settings.time)
        setRuleKeys(Object.fromEntries(d.settings.rules.map((r) => [r.roomId, ruleKey(r)])))
        setDirty(false)
      }
    } catch {
      setData({ connected: false })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!data || !data.connected) return null

  const edit = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setDirty(true)
    setMessage(null)
  }

  const handleSave = async () => {
    const base = Number(baseTemperature.replace(",", "."))
    // Without the room list (cloud unreachable) keep the saved rules untouched
    const rules = data.rooms.length
      ? data.rooms.flatMap((room) => ruleFromKey(room.id, ruleKeys[room.id] ?? "") ?? [])
      : data.settings.rules
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/heating/automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, baseTemperature: base, time, rules }),
      })
      if (!res.ok) throw new Error()
      await load()
      const [h, m] = time.split(":").map(Number)
      const now = new Date()
      const passed = now.getHours() * 60 + now.getMinutes() >= h * 60 + m
      setMessage({ text: enabled && passed ? `${tr.saved}. ${tr.startsTomorrow}` : tr.saved })
    } catch {
      setMessage({ text: tr.saveFailed, error: true })
    } finally {
      setSaving(false)
    }
  }

  const handleRun = async () => {
    setRunning(true)
    setMessage(null)
    try {
      const res = await fetch("/api/heating/automation/run", { method: "POST" })
      if (!res.ok) throw new Error()
      await load()
    } catch {
      setMessage({ text: tr.saveFailed, error: true })
    } finally {
      setRunning(false)
    }
  }

  const savedBase = data.settings.baseTemperature
  const stateLabel = (s: ConditionState) =>
    s === "AWAY" ? tr.stateAway.replace("{t}", fmtTemp(savedBase)) : s === "PRESENT" ? tr.statePresent : tr.stateUnset
  const stateClass = (s: ConditionState) => (s === "AWAY" ? own.chipAway : s === "PRESENT" ? own.chipPresent : own.chipUnset)

  const run = data.lastRun
  const resultText = (r: AutomationRun["results"][number]) =>
    r.outcome === "LOWERED"
      ? tr.outcomeLowered.replace("{from}", fmtTemp(r.from)).replace("{t}", fmtTemp(savedBase))
      : r.outcome === "FAILED"
        ? tr.outcomeFailed.replace("{error}", r.error ?? "?")
        : tr[`reason${r.reason ?? "UNSET"}` as keyof typeof tr]

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{tr.title}</h2>
      <p className={styles.sectionDesc}>{tr.desc}</p>

      <label className={own.toggleRow}>
        <input type="checkbox" className={styles.checkbox} checked={enabled} onChange={(e) => edit(setEnabled)(e.target.checked)} />
        <span>{tr.enabled}</span>
      </label>

      <div className={own.inputsRow}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="hauto-base">{tr.baseTemperature}</label>
          <div className={own.unitInput}>
            <input
              id="hauto-base"
              type="number"
              inputMode="decimal"
              min={5}
              max={30}
              step={0.5}
              className={styles.fieldInput}
              value={baseTemperature}
              onChange={(e) => edit(setBaseTemperature)(e.target.value)}
            />
            <span>°C</span>
          </div>
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="hauto-time">{tr.time}</label>
          <input id="hauto-time" type="time" className={styles.fieldInput} value={time} onChange={(e) => edit(setTime)(e.target.value)} />
        </div>
      </div>

      <h3 className={styles.subTitle}>{tr.rulesTitle}</h3>
      <p className={styles.fieldHint}>{tr.rulesHint}</p>
      {data.roomsError && <p className={styles.saveError}>{tr.roomsUnavailable}</p>}
      {data.rooms.length > 0 && (
        <div className={own.roomList}>
          {data.rooms.map((room) => {
            const key = ruleKeys[room.id] ?? ""
            const preview = !dirty && key ? data.preview.find((p) => p.roomId === room.id) : undefined
            return (
              <div key={room.id} className={own.roomRow}>
                <div className={own.roomHead}>
                  <label className={own.roomName} htmlFor={`hauto-room-${room.id}`}>
                    {room.name}
                    {room.thermostatCount === 0 && <span className={own.muted}> · {tr.noThermostat}</span>}
                  </label>
                  <select
                    id={`hauto-room-${room.id}`}
                    className={own.select}
                    value={key}
                    onChange={(e) => edit((v: string) => setRuleKeys((prev) => ({ ...prev, [room.id]: v })))(e.target.value)}
                  >
                    <option value="">{tr.ruleNone}</option>
                    {data.members.map((m) => (
                      <option key={m.id} value={`work:${m.id}`}>{tr.ruleWorkAway.replace("{name}", m.name)}</option>
                    ))}
                    {data.children.map((name) => (
                      <option key={name} value={`child:${name}`}>{tr.ruleChildAway.replace("{name}", name)}</option>
                    ))}
                  </select>
                </div>
                {preview && (
                  <div className={own.preview}>
                    <span className={`${own.chip} ${stateClass(preview.today)}`}>{tr.today}: {stateLabel(preview.today)}</span>
                    <span className={`${own.chip} ${stateClass(preview.tomorrow)}`}>{tr.tomorrow}: {stateLabel(preview.tomorrow)}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {dirty && <p className={styles.fieldHint}>{tr.unsavedHint}</p>}

      <div className={own.actions}>
        <Button variant="primary" disabled={saving || !dirty} onClick={handleSave}>
          {saving ? tr.saving : tr.save}
        </Button>
        <Button variant="secondary" disabled={running || dirty || data.settings.rules.length === 0} onClick={handleRun}>
          {running ? tr.running : tr.runNow}
        </Button>
      </div>
      {message && <p className={message.error ? styles.saveError : styles.fieldHint}>{message.text}</p>}

      <h3 className={styles.subTitle}>{tr.lastRun}</h3>
      {!run ? (
        <p className={styles.fieldHint}>{tr.never}</p>
      ) : (
        <div className={own.log}>
          <span className={own.muted}>
            {new Date(run.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} ·{" "}
            {run.trigger === "SCHEDULE" ? tr.triggerSchedule : tr.triggerManual}
          </span>
          {run.error ? (
            <span className={own.logError}>{tr.runFailed.replace("{error}", run.error)}</span>
          ) : run.results.length === 0 ? (
            <span>{tr.noRules}</span>
          ) : (
            <ul className={own.logList}>
              {run.results.map((r) => (
                <li key={r.roomId} className={r.outcome === "FAILED" ? own.logError : undefined}>
                  <strong>{r.roomName}</strong>: {resultText(r)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
