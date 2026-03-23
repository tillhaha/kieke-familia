// src/app/settings/ProfileSection.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState } from "react"
import styles from "./settings.module.css"

export function ProfileSection() {
  const { data: session, update } = useSession()
  const currentName = session?.user?.name ?? ""

  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to save."); return }
      await update({ name: data.user.name })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError("Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Profile</h2>
      <p className={styles.sectionDesc}>Your display name shown in the app.</p>

      <div className={styles.fieldGroup}>
        <label htmlFor="profile-name" className={styles.fieldLabel}>Name</label>
        <input
          id="profile-name"
          className={styles.fieldInput}
          value={name}
          onChange={(e) => { setName(e.target.value); setSaved(false) }}
          placeholder="Your name"
          onKeyDown={(e) => { if (e.key === "Enter") handleSave() }}
        />
      </div>

      {error && <p className={styles.saveError}>{error}</p>}

      <button
        className={styles.saveBtn}
        onClick={handleSave}
        disabled={saving || name.trim() === currentName}
      >
        {saving ? "Saving…" : saved ? "Saved!" : "Save"}
      </button>
    </div>
  )
}
