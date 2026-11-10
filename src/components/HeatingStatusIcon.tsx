// src/components/HeatingStatusIcon.tsx
// Navbar icon showing whether the Homematic IP Access Point is connected; links to /heating.
// Refreshes on mount, when the tab regains focus, every few minutes, and whenever
// some page dispatches HEATING_STATUS_EVENT (after connecting, disconnecting or loading rooms).
"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Thermometer } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./navbar.module.css"

export const HEATING_STATUS_EVENT = "heating-status-changed"

const REFRESH_MS = 5 * 60_000

type Status = "online" | "offline" | "error" | "pairing" | "disconnected"

export function HeatingStatusIcon({ active, className }: { active?: boolean; className?: string }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<Status | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/heating/status")
      if (!res.ok) return
      const d = (await res.json()) as { status: string; online?: boolean | null }
      setStatus(
        d.status === "connected"
          ? d.online === true ? "online" : d.online === false ? "offline" : "error"
          : d.status === "pairing" ? "pairing" : "disconnected"
      )
    } catch {
      // Keep the last known status when offline
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    const onFocus = () => document.visibilityState === "visible" && load()
    const id = setInterval(onFocus, REFRESH_MS)
    window.addEventListener(HEATING_STATUS_EVENT, load)
    document.addEventListener("visibilitychange", onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener(HEATING_STATUS_EVENT, load)
      document.removeEventListener("visibilitychange", onFocus)
    }
  }, [load])

  if (!status) return null

  const label =
    status === "online" ? t.heating.statusOnline
    : status === "offline" ? t.heating.statusOffline
    : status === "error" ? t.heating.statusError
    : status === "pairing" ? t.heating.statusPairing
    : t.heating.statusDisconnected
  return (
    <Link
      href="/heating"
      className={`${styles.heatingIcon} ${styles[`heating_${status}`]} ${active ? styles.heatingIconActive : ""} ${className ?? ""}`}
      title={label}
      aria-label={`${t.nav.heating}: ${label}`}
    >
      <Thermometer size={17} strokeWidth={2} />
      <span className={styles.heatingDot} />
    </Link>
  )
}
