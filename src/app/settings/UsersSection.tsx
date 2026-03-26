"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect, useCallback } from "react"
import { Copy, Check } from "lucide-react"
import styles from "./settings.module.css"

type Member = {
  id: string
  name: string | null
  email: string | null
  username: string | null
  role: "ADMIN" | "PARENT" | "MEMBER"
  active: boolean
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  PARENT: "Parent",
  MEMBER: "Member",
}

export function UsersSection() {
  const { data: session } = useSession()
  const sessionUser = session?.user as Record<string, unknown> | undefined
  const sessionRole = sessionUser?.role as string | undefined
  const sessionId = sessionUser?.id as string | undefined
  const isAdmin = sessionRole === "ADMIN"
  const canManage = sessionRole === "PARENT" || sessionRole === "ADMIN"

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  // Family name + join code
  const [familyName, setFamilyName] = useState("")
  const [initialFamilyName, setInitialFamilyName] = useState("")
  const [joinCode, setJoinCode] = useState<string | null>(null)
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [generatingCode, setGeneratingCode] = useState(false)

  // Per-member patch state
  const [pendingRole, setPendingRole] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  // Reset password state
  const [resetId, setResetId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState("")
  const [resetError, setResetError] = useState("")
  const [resetting, setResetting] = useState(false)

  // Create form
  const [showAddModal, setShowAddModal] = useState(false)
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const [membersRes, familyRes] = await Promise.all([
        fetch("/api/family/members"),
        fetch("/api/family"),
      ])
      const membersData = await membersRes.json()
      const familyData = await familyRes.json()
      setMembers(membersData.members ?? [])
      const n = familyData.family?.name ?? ""
      setFamilyName(n)
      setInitialFamilyName(n)
      setJoinCode(familyData.family?.joinCode ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  async function handleSaveName() {
    setSavingName(true)
    try {
      const res = await fetch("/api/family", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: familyName }),
      })
      if (res.ok) {
        setInitialFamilyName(familyName)
        setNameSaved(true)
        setTimeout(() => setNameSaved(false), 2000)
      }
    } finally {
      setSavingName(false)
    }
  }

  function copyCode() {
    if (!joinCode) return
    navigator.clipboard.writeText(joinCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleGenerateCode() {
    setGeneratingCode(true)
    try {
      const res = await fetch("/api/family", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generateJoinCode: true }),
      })
      const data = await res.json()
      if (res.ok) setJoinCode(data.family?.joinCode ?? null)
    } finally {
      setGeneratingCode(false)
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setSavingId(id)
    try {
      const res = await fetch(`/api/family/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) await fetchMembers()
    } finally {
      setSavingId(null)
    }
  }

  async function handleRoleChange(id: string) {
    const role = pendingRole[id]
    if (!role) return
    await patch(id, { role })
    setPendingRole((p) => { const n = { ...p }; delete n[id]; return n })
  }

  async function handleToggleActive(member: Member) {
    await patch(member.id, { active: !member.active })
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
      if (!res.ok) { setResetError(data.error ?? "Failed"); return }
      setResetId(null)
      setResetPassword("")
    } finally {
      setResetting(false)
    }
  }

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
      if (!res.ok) { setCreateError(data.error ?? "Failed to create account"); return }
      setName(""); setUsername(""); setPassword(""); setShowAddModal(false)
      await fetchMembers()
    } finally {
      setCreating(false)
    }
  }

  function closeAddModal() {
    setShowAddModal(false)
    setName(""); setUsername(""); setPassword(""); setCreateError("")
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Family</h2>

      <div className={styles.memberList}>
        <div className={styles.memberRow}>
          <div className={styles.memberInfo}>
            <span className={styles.memberName}>Family name</span>
          </div>
          <div className={styles.memberActions}>
            <input
              type="text"
              className={styles.fieldInput}
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="My Family"
            />
            <button
              className={styles.saveBtn}
              onClick={handleSaveName}
              disabled={savingName || !familyName.trim() || familyName.trim() === initialFamilyName.trim()}
            >
              {savingName ? "…" : nameSaved ? "Saved!" : "Save"}
            </button>
          </div>
        </div>

        <div className={styles.memberRow}>
          <div className={styles.memberInfo}>
            <span className={styles.memberName}>Join code</span>
            <span className={styles.memberUsername}>Share with family members to invite them.</span>
          </div>
          <div className={styles.memberActions}>
            {joinCode ? (
              <>
                <span className={styles.joinCode}>{joinCode}</span>
                <button className={styles.copyBtn} onClick={copyCode} title="Copy code">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </>
            ) : (
              <button className={styles.saveBtn} onClick={handleGenerateCode} disabled={generatingCode}>
                {generatingCode ? "Generating…" : "Generate"}
              </button>
            )}
          </div>
        </div>
      </div>

      <h3 className={styles.subTitle}>Members</h3>
      <p className={styles.sectionDesc}>
        Admins can change roles and activate or deactivate accounts.
      </p>

      {loading ? (
        <p className={styles.spinner}>Loading…</p>
      ) : (
        <div className={styles.memberList}>
          {members.map((m) => {
            const isSelf = m.id === sessionId
            const rolePending = pendingRole[m.id]
            return (
              <div key={m.id} className={`${styles.memberRow} ${!m.active ? styles.memberInactive : ""}`}>
                <div className={styles.memberInfo}>
                  <span className={styles.memberName}>
                    {m.name ?? m.username ?? "—"}
                    {isSelf && <span className={styles.memberSelf}> (you)</span>}
                  </span>
                  <span className={styles.memberUsername}>
                    {m.email ?? (m.username ? `@${m.username}` : null)}
                  </span>
                </div>

                <div className={styles.memberActions}>
                  {/* Role badge / dropdown */}
                  {isAdmin && !isSelf ? (
                    <div className={styles.roleRow}>
                      <select
                        className={styles.roleSelect}
                        value={rolePending ?? m.role}
                        onChange={(e) => setPendingRole((p) => ({ ...p, [m.id]: e.target.value }))}
                      >
                        <option value="MEMBER">Member</option>
                        <option value="PARENT">Parent</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      {rolePending && rolePending !== m.role && (
                        <button
                          className={styles.saveBtn}
                          onClick={() => handleRoleChange(m.id)}
                          disabled={savingId === m.id}
                        >
                          {savingId === m.id ? "…" : "Save"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className={styles.roleBadge}>{ROLE_LABELS[m.role]}</span>
                  )}

                  {/* Activate / Deactivate */}
                  {isAdmin && !isSelf && (
                    <button
                      className={m.active ? styles.cancelBtn : styles.activateBtn}
                      onClick={() => handleToggleActive(m)}
                      disabled={savingId === m.id}
                    >
                      {m.active ? "Deactivate" : "Activate"}
                    </button>
                  )}

                  {/* Password reset — credential users only */}
                  {canManage && m.username && !isSelf && (
                    resetId === m.id ? (
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
                          className={styles.saveBtn}
                          onClick={() => handleResetPassword(m.id)}
                          disabled={resetting || resetPassword.length < 8}
                        >
                          {resetting ? "…" : "Save"}
                        </button>
                        <button
                          className={styles.cancelBtn}
                          onClick={() => { setResetId(null); setResetPassword(""); setResetError("") }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className={styles.cancelBtn}
                        onClick={() => { setResetId(m.id); setResetPassword(""); setResetError("") }}
                      >
                        Reset password
                      </button>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {canManage && (
        <button className={styles.saveBtn} style={{ width: "fit-content" }} onClick={() => setShowAddModal(true)}>
          + Add Member
        </button>
      )}

      {showAddModal && (
        <div className={styles.modalOverlay} onClick={closeAddModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Add Member</h2>
            <form onSubmit={handleCreate}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Name</label>
                <input type="text" placeholder="Emma" value={name}
                  onChange={(e) => setName(e.target.value)} className={styles.fieldInput} required autoFocus />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Username</label>
                <input type="text" placeholder="emma-smith" value={username}
                  onChange={(e) => setUsername(e.target.value)} className={styles.fieldInput} required />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Password</label>
                <input type="password" placeholder="Min. 8 characters" value={password}
                  onChange={(e) => setPassword(e.target.value)} className={styles.fieldInput}
                  required minLength={8} />
              </div>
              {createError && <p className={styles.saveError}>{createError}</p>}
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={closeAddModal}>Cancel</button>
                <button type="submit" disabled={creating} className={styles.saveBtn}>
                  {creating ? "Creating…" : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
