// src/app/settings/HeatingSection.tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import { Button } from "@/components/ui/Button"
import styles from "./settings.module.css"

type Status =
  | { status: "disconnected"; code?: string }
  | { status: "pairing"; accessPointId: string; expiresAt: string }
  | { status: "connected"; accessPointId: string }

const POLL_INTERVAL_MS = 2500

/** 3014F711A0000000000000AB → 3014-F711-A000-0000-0000-00AB */
function formatSgtin(id: string) {
  return id.match(/.{1,4}/g)?.join("-") ?? id
}

export function HeatingSection() {
  const { t } = useTranslation()
  const [state, setState] = useState<Status | null>(null)
  const [sgtin, setSgtin] = useState("")
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const errorText = useCallback((code: string | undefined) => {
    switch (code) {
      case "INVALID_SGTIN": return t.heating.errInvalidSgtin
      case "INVALID_PIN": return t.heating.errInvalidPin
      case "ASSIGNMENT_LOCKED": return t.heating.errLocked
      case "UNREACHABLE": return t.heating.errUnreachable
      case "THROTTLED": return t.heating.errThrottled
      case "NOT_AUTHORIZED": return t.heating.errNotAuthorized
      case "PAIRING_EXPIRED": return t.heating.errExpired
      default: return t.heating.errUnknown
    }
  }, [t])

  useEffect(() => {
    fetch("/api/heating/connect")
      .then((r) => r.json())
      .then((d: Status) => setState(d))
      .catch(() => setState({ status: "disconnected" }))
  }, [])

  // While pairing: poll until the blue button is pressed or the window runs out
  useEffect(() => {
    if (state?.status !== "pairing") return
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch("/api/heating/connect")
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(errorText(data.code))
          setState({ status: "disconnected" })
          return
        }
        if (data.status === "pairing") {
          pollRef.current = setTimeout(poll, POLL_INTERVAL_MS)
        } else {
          if (data.code) setError(errorText(data.code))
          setState(data)
        }
      } catch {
        if (!cancelled) pollRef.current = setTimeout(poll, POLL_INTERVAL_MS)
      }
    }
    pollRef.current = setTimeout(poll, POLL_INTERVAL_MS)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      cancelled = true
      if (pollRef.current) clearTimeout(pollRef.current)
      clearInterval(tick)
    }
  }, [state?.status, errorText])

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/heating/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sgtin, pin: pin || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(errorText(data.code))
        return
      }
      setNow(Date.now())
      setState(data)
    } catch {
      setError(t.heating.errUnreachable)
    } finally {
      setBusy(false)
    }
  }

  // Disconnecting asks for confirmation; cancelling a pending pairing doesn't
  const handleDisconnect = async (confirmed = false) => {
    if (!confirmed && !confirmDisconnect) {
      setConfirmDisconnect(true)
      return
    }
    setConfirmDisconnect(false)
    setBusy(true)
    try {
      await fetch("/api/heating/connect", { method: "DELETE" })
      setState({ status: "disconnected" })
      setPin("")
    } finally {
      setBusy(false)
    }
  }

  if (!state) return <p className={styles.spinner}>{t.settings.loading}</p>

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.heating.title}</h2>
      <p className={styles.sectionDesc}>{t.heating.desc}</p>

      {state.status === "connected" && (
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>{t.heating.connectedTo}</span>
          <div className={styles.calendarRow}>
            <code className={styles.tokenValue}>{formatSgtin(state.accessPointId)}</code>
            <button
              className={confirmDisconnect ? styles.confirmDeleteBtn : styles.deleteBtn}
              disabled={busy}
              onClick={() => handleDisconnect()}
            >
              {confirmDisconnect ? t.heating.confirmDisconnect : t.heating.disconnect}
            </button>
          </div>
          <span className={styles.fieldHint}>{t.heating.disconnectHint}</span>
        </div>
      )}

      {state.status === "pairing" && (
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>{t.heating.pressButtonTitle}</span>
          <span className={styles.fieldHint}>{t.heating.pressButtonHint}</span>
          <span className={styles.fieldHint}>
            {t.heating.timeLeft}: {formatRemaining(new Date(state.expiresAt).getTime() - now)}
          </span>
          <div>
            <Button variant="secondary" disabled={busy} onClick={() => handleDisconnect(true)}>
              {t.heating.cancel}
            </Button>
          </div>
        </div>
      )}

      {state.status === "disconnected" && (
        <form onSubmit={handleConnect} className={styles.importedForm}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="hmip-sgtin">{t.heating.sgtinLabel}</label>
            <span className={styles.fieldHint}>{t.heating.sgtinHint}</span>
            <input
              id="hmip-sgtin"
              type="text"
              className={styles.fieldInput}
              placeholder="3014-F711-A000-…"
              value={sgtin}
              onChange={(e) => setSgtin(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              required
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="hmip-pin">{t.heating.pinLabel}</label>
            <span className={styles.fieldHint}>{t.heating.pinHint}</span>
            <input
              id="hmip-pin"
              type="password"
              inputMode="numeric"
              className={styles.fieldInput}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <Button variant="primary" type="submit" disabled={busy || !sgtin.trim()}>
              {busy ? t.heating.connecting : t.heating.connect}
            </Button>
          </div>
        </form>
      )}

      {error && <p className={styles.saveError}>{error}</p>}
    </div>
  )
}

function formatRemaining(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}
