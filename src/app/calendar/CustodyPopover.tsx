// src/app/calendar/CustodyPopover.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import ReactDOM from "react-dom"
import styles from "./calendar.module.css"

type CustodyEntry = {
  id: string
  date: string
  personName: string
  location: "WITH_US" | "WITH_MONA"
}

type Props = {
  entry: CustodyEntry
  anchorRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
  onSave: () => void
}

export default function CustodyPopover({ entry, anchorRef, onClose, onSave }: Props) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Position popover below the anchor pill
  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom + 4,
        left: rect.left,
      })
    }
  }, [anchorRef])

  // Click-outside dismissal
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose, anchorRef])

  const handlePatch = async (location: "WITH_US" | "WITH_MONA") => {
    if (location === entry.location) {
      onClose()
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/calendar/custody/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to update")
      await onSave()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update")
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/calendar/custody/${entry.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to delete")
      await onSave()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete")
      setLoading(false)
    }
  }

  // Format date label: "22 March · Emilia"
  const [year, month, day] = entry.date.split("-").map(Number)
  const dateLabel = new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
  })

  const popover = (
    <div
      ref={popoverRef}
      className={styles.custodyPopover}
      style={{ top: pos.top, left: pos.left }}
    >
      <div className={styles.custodyPopoverLabel}>{dateLabel} · {entry.personName}</div>

      <button
        className={`${styles.custodyPopoverBtn} ${entry.location === "WITH_US" ? `${styles.custodyPopoverBtnActive} ${styles.custodyHomeEvent}` : ""}`}
        onClick={(e) => { e.stopPropagation(); handlePatch("WITH_US") }}
        disabled={loading}
      >
        🏠 With us
      </button>

      <button
        className={`${styles.custodyPopoverBtn} ${entry.location === "WITH_MONA" ? `${styles.custodyPopoverBtnActive} ${styles.custodyMonaEvent}` : ""}`}
        onClick={(e) => { e.stopPropagation(); handlePatch("WITH_MONA") }}
        disabled={loading}
      >
        👤 With Mona
      </button>

      <button
        className={styles.custodyPopoverBtn}
        onClick={(e) => { e.stopPropagation(); handleDelete() }}
        disabled={loading}
        style={{ color: "var(--secondary)", fontSize: "11px" }}
      >
        ✕ Clear this day
      </button>

      {error && <p className={styles.custodyPopoverError}>{error}</p>}
    </div>
  )

  if (!mounted) return null
  return ReactDOM.createPortal(popover, document.body)
}
