// src/app/settings/ChildrenSection.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect, useCallback } from "react"
import styles from "./settings.module.css"

type Member = { id: string; name: string; username: string }

export function ChildrenSection() {
  const { data: session } = useSession()
  const role = (session?.user as Record<string, unknown>)?.role as string | undefined
  const canManage = role === "PARENT" || role === "ADMIN"

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  // Create form
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")

  // Reset password state per member
  const [resetId, setResetId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState("")
  const [resetError, setResetError] = useState("")
  const [resetting, setResetting] = useState(false)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/family/members")
      const data = await res.json()
      setMembers(data.members ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError("")
    setCreating(true)
    try {
      const res = await fetch("/api/family/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create account")
        return
      }
      setName("")
      setUsername("")
      setPassword("")
      await fetchMembers()
    } finally {
      setCreating(false)
    }
  }

  async function handleResetPassword(id: string) {
    setResetError("")
    setResetting(true)
    try {
      const res = await fetch(`/api/family/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResetError(data.error ?? "Failed to reset password")
        return
      }
      setResetId(null)
      setResetPassword("")
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Children</h2>
      <p className={styles.sectionDesc}>
        Child accounts use a username and password to sign in — no Google account needed.
        {!canManage && " Only parents can create or manage child accounts."}
      </p>

      {loading ? (
        <p className={styles.spinner}>Loading…</p>
      ) : members.length === 0 ? (
        <p className={styles.emptyMsg}>No child accounts yet.</p>
      ) : (
        <div className={styles.memberList}>
          {members.map((m) => (
            <div key={m.id} className={styles.memberRow}>
              <div className={styles.memberInfo}>
                <span className={styles.memberName}>{m.name}</span>
                <span className={styles.memberUsername}>@{m.username}</span>
              </div>
              {canManage && (
                <div className={styles.memberActions}>
                  {resetId === m.id ? (
                    <>
                      <input
                        type="password"
                        placeholder="New password (min 8)"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        className={styles.fieldInput}
                      />
                      {resetError && <p className={styles.saveError}>{resetError}</p>}
                      <button
                        onClick={() => handleResetPassword(m.id)}
                        disabled={resetting || resetPassword.length < 8}
                        className={styles.saveBtn}
                      >
                        {resetting ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => { setResetId(null); setResetPassword(""); setResetError("") }}
                        className={styles.cancelBtn}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setResetId(m.id); setResetPassword(""); setResetError("") }}
                      className={styles.cancelBtn}
                    >
                      Reset password
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <>
          <h3 className={styles.subTitle}>Add child account</h3>
          <form onSubmit={handleCreate}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Display name</label>
              <input
                type="text"
                placeholder="Emma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.fieldInput}
                required
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Username</label>
              <input
                type="text"
                placeholder="emma-smith"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={styles.fieldInput}
                required
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Password</label>
              <input
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.fieldInput}
                required
                minLength={8}
              />
            </div>
            {createError && <p className={styles.saveError}>{createError}</p>}
            <button
              type="submit"
              disabled={creating}
              className={styles.saveBtn}
            >
              {creating ? "Creating…" : "Create account"}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
