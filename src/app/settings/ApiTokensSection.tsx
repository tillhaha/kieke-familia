// src/app/settings/ApiTokensSection.tsx
"use client"

import { useState, useEffect } from "react"
import { Copy, Check } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./settings.module.css"

type ApiToken = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null }

function CopyButton({ value, title }: { value: string; title: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button type="button" className={styles.copyBtn} onClick={copy} title={title}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}

export function ApiTokensSection() {
  const { t, lang } = useTranslation()
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    setOrigin(window.location.origin)
    fetch("/api/user/tokens")
      .then((r) => r.json())
      .then((data) => setTokens(data.tokens ?? []))
      .finally(() => setLoading(false))
  }, [])

  const endpoint = `${origin}/api/mcp`

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/user/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Server error (${res.status})`)
      const { token, ...rest } = data as ApiToken & { token: string }
      setTokens((prev) => [rest, ...prev])
      setCreatedToken(token)
      setNewName("")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.settings.failedSave)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    setConfirmDeleteId(null)
    setDeletingId(id)
    try {
      const res = await fetch(`/api/user/tokens/${id}`, { method: "DELETE" })
      if (res.ok) setTokens((prev) => prev.filter((tk) => tk.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (iso: string) => new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(new Date(iso))

  if (loading) return <p className={styles.spinner}>{t.settings.loading}</p>

  const setupCommand = createdToken
    ? `claude mcp add --scope user --transport http familia ${endpoint} --header "Authorization: Bearer ${createdToken}"`
    : null
  const connectorUrl = createdToken ? `${endpoint}/${createdToken}` : null

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.settings.apiTokensTitle}</h2>
      <p className={styles.sectionDesc}>{t.settings.apiTokensDesc}</p>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>{t.settings.mcpEndpointLabel}</span>
        <div className={styles.tokenRow}>
          <code className={styles.tokenValue}>{endpoint}</code>
          <CopyButton value={endpoint} title={t.settings.copy} />
        </div>
      </div>

      {createdToken && setupCommand && connectorUrl && (
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>{t.settings.apiTokenCreated}</span>
          <div className={styles.tokenRow}>
            <code className={styles.tokenValue}>{createdToken}</code>
            <CopyButton value={createdToken} title={t.settings.copy} />
          </div>
          <span className={styles.fieldHint}>{t.settings.mcpSetupLabel}</span>
          <div className={styles.tokenRow}>
            <code className={styles.tokenValue}>{setupCommand}</code>
            <CopyButton value={setupCommand} title={t.settings.copy} />
          </div>
          <span className={styles.fieldHint}>{t.settings.connectorSetupLabel}</span>
          <div className={styles.tokenRow}>
            <code className={styles.tokenValue}>{connectorUrl}</code>
            <CopyButton value={connectorUrl} title={t.settings.copy} />
          </div>
        </div>
      )}

      {tokens.length > 0 ? (
        <div className={styles.calendarList}>
          {tokens.map((tk) => (
            <div key={tk.id} className={styles.calendarRow}>
              <span className={styles.calendarName}>{tk.name}</span>
              <span className={styles.importedUrlText}>
                {tk.prefix}… · {tk.lastUsedAt ? `${t.settings.lastUsed} ${formatDate(tk.lastUsedAt)}` : t.settings.neverUsed}
              </span>
              <button
                className={confirmDeleteId === tk.id ? styles.confirmDeleteBtn : styles.deleteBtn}
                disabled={deletingId === tk.id}
                onClick={() => handleDelete(tk.id)}
              >
                {confirmDeleteId === tk.id ? t.settings.confirmQuestion : deletingId === tk.id ? "…" : t.settings.revoke}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.emptyMsg}>{t.settings.noApiTokens}</p>
      )}

      <form onSubmit={handleCreate} className={styles.importedForm}>
        <div className={styles.importedFormRow}>
          <input
            type="text"
            className={styles.fieldInput}
            placeholder={t.settings.apiTokenNamePlaceholder}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <button type="submit" className={styles.saveBtn} disabled={creating || !newName.trim()}>
            {creating ? t.settings.creating : t.settings.createToken}
          </button>
        </div>
        {error && <p className={styles.saveError}>{error}</p>}
      </form>
    </div>
  )
}
