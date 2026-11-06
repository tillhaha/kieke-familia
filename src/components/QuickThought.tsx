// src/components/QuickThought.tsx
// Floating "new thought" button + capture sheet. Posts to the same endpoint as
// the /thoughts composer (Claude splits/categorises into the user's private list).
"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Brain, Check, Lock, Send, X } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./QuickThought.module.css"
import { Button } from "@/components/ui/Button"
import { VoiceInputButton } from "@/components/VoiceInputButton"

type Added = { id: string; title: string; category: string }

export function QuickThought() {
  const { t } = useTranslation()
  const tt = t.thoughts
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [added, setAdded] = useState<Added[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    textareaRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  function openSheet() {
    setAdded([])
    setError("")
    setOpen(true)
  }

  async function send() {
    if (!text.trim() || sending) return
    setSending(true)
    setError("")
    try {
      const r = await fetch("/api/personal-todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      if (!r.ok) throw new Error()
      const data = await r.json()
      setAdded(data.todos ?? [])
      setText("")
      textareaRef.current?.focus()
    } catch {
      setError(tt.failed)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {!open && (
        <button className={styles.fab} data-fab onClick={openSheet} aria-label={tt.quickAdd} title={tt.quickAdd}>
          <Brain size={22} strokeWidth={2} />
          <span className={styles.fabLabel}>{tt.quickAdd}</span>
        </button>
      )}

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={tt.quickTitle}>
            <div className={styles.header}>
              <h2 className={styles.title}>{tt.quickTitle}</h2>
              <button className={styles.iconBtn} onClick={() => setOpen(false)} aria-label={tt.cancel}>
                <X size={18} />
              </button>
            </div>
            <span className={styles.privateHint}>
              <Lock size={12} strokeWidth={2.25} />
              {tt.privateHint}
            </span>
            <textarea
              ref={textareaRef}
              className={styles.input}
              value={text}
              placeholder={tt.placeholder}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={4}
              maxLength={5000}
              disabled={sending}
            />
            {error && <p className={styles.error}>{error}</p>}
            {added.length > 0 && (
              <div className={styles.added}>
                <span className={styles.addedHeader}>
                  <Check size={14} strokeWidth={2.5} />
                  {tt.added.replace("{n}", String(added.length))}
                </span>
                <ul className={styles.addedList}>
                  {added.map((a) => (
                    <li key={a.id}>
                      <span className={styles.addedTitle}>{a.title}</span>
                      <span className={styles.chip}>{a.category}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className={styles.footer}>
              <Link href="/thoughts" className={styles.viewAll}>{tt.viewAll}</Link>
              <div className={styles.footerActions}>
                <VoiceInputButton value={text} onChange={setText} onError={setError} disabled={sending} maxLength={5000} />
                <Button variant="primary" icon={<Send size={14} strokeWidth={2.25} />} onClick={send} disabled={sending || !text.trim()}>
                  {sending ? tt.sending : tt.send}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
