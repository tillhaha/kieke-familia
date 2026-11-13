// src/components/assistant/AssistantPanel.tsx
// Slide-in assistant chat. Talks to /api/assistant/chat (NDJSON stream); the conversation is
// kept in this browser only (./storage). Heating changes and deletions come back as a
// confirmation card — the answer is sent as `approvals` with the next request.
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useSession } from "next-auth/react"
import ReactMarkdown from "react-markdown"
import { ArrowLeft, ArrowUp, Check, History, Mic, Plus, Sparkles, Square, X } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import { Button } from "@/components/ui/Button"
import { VoiceInputButton } from "@/components/VoiceInputButton"
import { type ChatMessage, DECLINED_RESULT, type ToolCall, parseArgs, pendingCalls } from "@/lib/assistant/messages"
import { type Conversation, RESUME_WITHIN_MS, loadConversations, newConversation, saveConversation } from "./storage"
import { MAX_RECORDING_MS, type Recording, startRecording } from "./recorder"
import styles from "./AssistantPanel.module.css"

type Config = { enabled: boolean; voice: boolean }
/** What is streaming in right now, in order: text and tool steps */
type Live = ({ kind: "text"; text: string } | { kind: "tool"; name: string; ok: boolean })[]
type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; ok: boolean }
  | { type: "confirm" }
  | { type: "messages"; messages: ChatMessage[] }
  | { type: "error"; code: string; message: string }

export function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? "anon"
  const firstName = (session?.user?.name ?? "").split(" ")[0]
  const { t } = useTranslation()
  const ta = t.assistant

  const [config, setConfig] = useState<Config | null>(null)
  const [conversation, setConversation] = useState<Conversation>(() => newConversation())
  const [history, setHistory] = useState<Conversation[]>([])
  const [view, setView] = useState<"chat" | "history">("chat")
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState<Live | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** The technical reason behind `error`, shown small under the friendly text */
  const [errorDetail, setErrorDetail] = useState("")
  const [voice, setVoice] = useState<"idle" | "recording" | "transcribing">("idle")
  const [voiceError, setVoiceError] = useState("")

  const abortRef = useRef<AbortController | null>(null)
  const liveTextRef = useRef("")
  const recordingRef = useRef<Recording | null>(null)
  const recordTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const wasOpen = useRef(false)

  // On opening: config once; resume a recent chat, otherwise start fresh
  useEffect(() => {
    if (!open || wasOpen.current) {
      wasOpen.current = open
      return
    }
    wasOpen.current = true
    if (!config) {
      fetch("/api/assistant")
        .then((r) => (r.ok ? r.json() : { enabled: false, voice: false }))
        .then(setConfig)
        .catch(() => setConfig({ enabled: false, voice: false }))
    }
    const list = loadConversations(userId)
    setConversation((current) => {
      if (current.messages.length && Date.now() - current.updatedAt < RESUME_WITHIN_MS) return current
      const recent = list[0]
      return recent && Date.now() - recent.updatedAt < RESUME_WITHIN_MS ? recent : newConversation()
    })
    setView("chat")
    setTimeout(() => inputRef.current?.focus(), 250)
  }, [open, config, userId])

  // Esc closes
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Keep the newest message in view
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [conversation.messages.length, live, busy, view])

  // Stop anything running when the panel unmounts
  useEffect(
    () => () => {
      abortRef.current?.abort()
      recordingRef.current?.cancel()
    },
    [],
  )

  const commit = useCallback((messages: ChatMessage[]) => {
    setConversation((c) => {
      const firstUser = messages.find((m) => m.role === "user")
      return { ...c, messages, updatedAt: Date.now(), title: c.title || (firstUser?.content ?? "").slice(0, 80) }
    })
  }, [])

  // Persist every change of the current chat (browser only)
  useEffect(() => {
    if (conversation.messages.length) saveConversation(userId, conversation)
  }, [conversation, userId])

  const showHistory = () => {
    setHistory(loadConversations(userId))
    setView("history")
  }

  const run = useCallback(
    async (base: ChatMessage[], approvals: { id: string; approved: boolean }[]) => {
      const ac = new AbortController()
      abortRef.current = ac
      liveTextRef.current = ""
      setBusy(true)
      setError(null)
      setErrorDetail("")
      setLive([])
      let committed = false
      try {
        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: base, approvals }),
          signal: ac.signal,
        })
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}))
          setError(data.code ?? (res.status === 503 ? "NOT_CONFIGURED" : "UNKNOWN"))
          setErrorDetail(`HTTP ${res.status}${data.error ? `: ${data.error}` : ""}`)
          return
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        const handle = (line: string) => {
          if (!line.trim()) return
          const e = JSON.parse(line) as StreamEvent
          if (e.type === "text") {
            liveTextRef.current += e.delta
            setLive((l) => {
              if (!l) return l
              const last = l[l.length - 1]
              return last?.kind === "text" ? [...l.slice(0, -1), { kind: "text", text: last.text + e.delta }] : [...l, { kind: "text", text: e.delta }]
            })
          } else if (e.type === "tool") {
            setLive((l) => (l ? [...l, { kind: "tool", name: e.name, ok: e.ok }] : l))
          } else if (e.type === "messages") {
            commit([...base, ...e.messages])
            committed = true
          } else if (e.type === "error") {
            setError(e.code)
            setErrorDetail(e.message)
          }
        }
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let nl: number
          while ((nl = buffer.indexOf("\n")) >= 0) {
            handle(buffer.slice(0, nl))
            buffer = buffer.slice(nl + 1)
          }
        }
        handle(buffer)
      } catch (err) {
        if (ac.signal.aborted) {
          // Stopped: keep what was already said
          if (!committed && liveTextRef.current) commit([...base, { role: "assistant", content: `${liveTextRef.current} …` }])
        } else {
          console.error("[assistant]", err)
          setError("UNKNOWN")
          setErrorDetail(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (abortRef.current === ac) abortRef.current = null
        setBusy(false)
        setLive(null)
      }
    },
    [commit],
  )

  const send = useCallback(
    (raw: string) => {
      const content = raw.trim()
      if (!content || busy) return
      let messages = conversation.messages
      // Writing instead of answering a confirmation counts as "no"
      const pending = pendingCalls(messages)
      if (pending.length) messages = [...messages, ...pending.map((c) => ({ role: "tool" as const, tool_call_id: c.id, content: DECLINED_RESULT }))]
      messages = [...messages, { role: "user", content }]
      commit(messages)
      setInput("")
      run(messages, [])
    },
    [busy, conversation.messages, commit, run],
  )

  const answer = (approved: boolean) => {
    const pending = pendingCalls(conversation.messages)
    if (pending.length && !busy) run(conversation.messages, pending.map((c) => ({ id: c.id, approved })))
  }

  const startNew = () => {
    abortRef.current?.abort()
    setConversation(newConversation())
    setError(null)
    setView("chat")
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // --- voice messages (audio model on OpenRouter) ------------------------------
  const stopRecording = async () => {
    const rec = recordingRef.current
    if (!rec) return
    recordingRef.current = null
    if (recordTimer.current) clearTimeout(recordTimer.current)
    setVoice("transcribing")
    try {
      const audio = await rec.stop()
      const res = await fetch("/api/assistant/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio, format: "wav" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.text) throw new Error(data.code ?? "EMPTY")
      send(data.text)
    } catch (err) {
      const code = err instanceof Error ? err.message : ""
      setVoiceError(
        code === "WRONG_MODEL" ? ta.errVoiceModel
        : code === "NO_CREDITS" ? ta.errNoCredits
        : code === "RATE_LIMITED" ? ta.errRateLimited
        : ta.errVoice,
      )
    } finally {
      setVoice("idle")
    }
  }

  const toggleRecording = async () => {
    if (voice === "recording") return stopRecording()
    if (voice !== "idle") return
    setVoiceError("")
    try {
      recordingRef.current = await startRecording()
      setVoice("recording")
      recordTimer.current = setTimeout(stopRecording, MAX_RECORDING_MS)
    } catch {
      setVoiceError(ta.errMic)
    }
  }

  if (typeof document === "undefined") return null

  const messages = conversation.messages
  const pending = busy ? [] : pendingCalls(messages)
  const results = new Map(messages.flatMap((m) => (m.role === "tool" ? [[m.tool_call_id, m.content] as const] : [])))
  const toolLabel = (name: string) => ta.tools[name] ?? name
  const errorText =
    error === "NOT_CONFIGURED" ? ta.errNotConfigured
    : error === "NO_CREDITS" ? ta.errNoCredits
    : error === "RATE_LIMITED" ? ta.errRateLimited
    : ta.errFailed
  const disabled = config?.enabled === false

  const chip = (call: ToolCall) => {
    const result = results.get(call.id)
    if (result === undefined) return null // awaiting confirmation → card below
    const muted = result === DECLINED_RESULT || result.startsWith("Not run")
    return (
      <span key={call.id} className={`${styles.chip} ${muted ? styles.chipMuted : ""}`}>
        {muted ? <X size={12} /> : <Check size={12} />}
        {toolLabel(call.function.name)}
        {result === DECLINED_RESULT && ` · ${ta.declined}`}
      </span>
    )
  }

  return createPortal(
    <>
      <div className={`${styles.backdrop} ${open ? styles.backdropOpen : ""}`} onClick={onClose} aria-hidden />
      <aside className={`${styles.panel} ${open ? styles.panelOpen : ""}`} aria-label={ta.title} inert={!open}>
        <header className={styles.header}>
          {view === "history" ? (
            <Button variant="ghost" size="sm" iconOnly icon={<ArrowLeft size={16} />} aria-label={ta.back} onClick={() => setView("chat")} />
          ) : (
            <Sparkles size={18} className={styles.headerIcon} />
          )}
          <h2 className={styles.title}>{view === "history" ? ta.history : ta.title}</h2>
          {view === "chat" && (
            <>
              <Button variant="ghost" size="sm" iconOnly icon={<History size={16} />} aria-label={ta.history} title={ta.history} onClick={showHistory} />
              <Button variant="ghost" size="sm" iconOnly icon={<Plus size={16} />} aria-label={ta.newChat} title={ta.newChat} onClick={startNew} />
            </>
          )}
          <Button variant="ghost" size="sm" iconOnly icon={<X size={16} />} aria-label={ta.close} title={ta.close} onClick={onClose} />
        </header>

        {view === "history" ? (
          <div className={styles.body}>
            <p className={styles.hint}>{ta.historyHint}</p>
            {history.length === 0 ? (
              <p className={styles.hint}>{ta.noHistory}</p>
            ) : (
              <ul className={styles.historyList}>
                {history.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`${styles.historyItem} ${c.id === conversation.id ? styles.historyItemActive : ""}`}
                      onClick={() => {
                        setConversation(c)
                        setError(null)
                        setView("chat")
                      }}
                    >
                      <span className={styles.historyTitle}>{c.title || "…"}</span>
                      <span className={styles.historyDate}>
                        {new Date(c.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            <div className={styles.body} ref={scrollRef}>
              {disabled ? (
                <p className={styles.error}>{ta.errNotConfigured}</p>
              ) : messages.length === 0 && !busy ? (
                <div className={styles.empty}>
                  <p>{ta.greeting.replace("{name}", firstName)}</p>
                  <div className={styles.suggestions}>
                    {[ta.suggestion1, ta.suggestion2, ta.suggestion3, ta.suggestion4].map((s) => (
                      <button key={s} type="button" className={styles.suggestion} onClick={() => send(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {messages.map((m, i) => {
                if (m.role === "user") {
                  return (
                    <div key={i} className={styles.user}>
                      {m.content}
                    </div>
                  )
                }
                if (m.role !== "assistant") return null
                const chips = m.tool_calls?.map(chip).filter(Boolean)
                return (
                  <div key={i} className={styles.assistantBlock}>
                    {m.content && (
                      <div className={styles.assistant}>
                        <Markdown text={m.content} />
                      </div>
                    )}
                    {chips?.length ? <div className={styles.chips}>{chips}</div> : null}
                  </div>
                )
              })}

              {live && (
                <div className={styles.assistantBlock}>
                  {live.map((seg, i) =>
                    seg.kind === "text" ? (
                      <div key={i} className={styles.assistant}>
                        <Markdown text={seg.text} />
                      </div>
                    ) : (
                      <div key={i} className={styles.chips}>
                        <span className={`${styles.chip} ${seg.ok ? "" : styles.chipMuted}`}>
                          {seg.ok ? <Check size={12} /> : <X size={12} />}
                          {toolLabel(seg.name)}
                        </span>
                      </div>
                    ),
                  )}
                  {live[live.length - 1]?.kind !== "text" && (
                    <div className={styles.thinking}>
                      <span className={styles.dots} aria-hidden />
                      {ta.thinking}
                    </div>
                  )}
                </div>
              )}

              {pending.length > 0 && (
                <div className={styles.confirm} role="group" aria-label={ta.confirmTitle}>
                  <strong>{ta.confirmTitle}</strong>
                  <ul>
                    {pending.map((c) => (
                      <li key={c.id}>
                        {toolLabel(c.function.name)}
                        {summarize(parseArgs(c)) && <span className={styles.confirmArgs}> — {summarize(parseArgs(c))}</span>}
                      </li>
                    ))}
                  </ul>
                  <div className={styles.confirmActions}>
                    <Button variant="secondary" size="sm" onClick={() => answer(false)}>
                      {ta.cancel}
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => answer(true)}>
                      {ta.confirm}
                    </Button>
                  </div>
                </div>
              )}

              {error && !busy && (
                <div className={styles.error}>
                  {errorText}
                  {errorDetail && <code className={styles.errorDetail}>{errorDetail}</code>}
                  {error !== "NOT_CONFIGURED" && (
                    <Button variant="secondary" size="sm" onClick={() => run(conversation.messages, [])}>
                      {ta.retry}
                    </Button>
                  )}
                </div>
              )}
            </div>

            <form
              className={styles.composer}
              onSubmit={(e) => {
                e.preventDefault()
                send(input)
              }}
            >
              {voiceError && <p className={styles.voiceError}>{voiceError}</p>}
              {voice === "transcribing" && <p className={styles.hint}>{ta.transcribing}</p>}
              <div className={styles.inputRow}>
                <textarea
                  ref={inputRef}
                  className={styles.input}
                  value={input}
                  placeholder={ta.placeholder}
                  rows={1}
                  maxLength={4000}
                  disabled={disabled || voice !== "idle"}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      send(input)
                    }
                  }}
                />
                {config?.voice ? (
                  <Button
                    iconOnly
                    variant={voice === "recording" ? "danger" : "secondary"}
                    active={voice === "recording"}
                    icon={<Mic size={16} strokeWidth={2.25} />}
                    aria-label={voice === "recording" ? ta.recordStop : ta.recordStart}
                    title={voice === "recording" ? ta.recordStop : ta.recordStart}
                    disabled={disabled || busy || voice === "transcribing"}
                    onClick={toggleRecording}
                  />
                ) : (
                  <VoiceInputButton value={input} onChange={setInput} onError={setVoiceError} disabled={disabled || busy} maxLength={4000} />
                )}
                {busy ? (
                  <Button iconOnly variant="secondary" icon={<Square size={14} />} aria-label={ta.stop} title={ta.stop} onClick={() => abortRef.current?.abort()} />
                ) : (
                  <Button
                    type="submit"
                    iconOnly
                    variant="primary"
                    icon={<ArrowUp size={16} strokeWidth={2.5} />}
                    aria-label={ta.send}
                    title={ta.send}
                    disabled={disabled || !input.trim() || voice !== "idle"}
                  />
                )}
              </div>
            </form>
          </>
        )}
      </aside>
    </>,
    document.body,
  )
}

function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      components={{
        a: ({ href, children }) => (
          <a href={href} target={href?.startsWith("/") ? undefined : "_blank"} rel="noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

/** Short, readable version of a tool call's arguments for the confirmation card (ids left out) */
function summarize(args: Record<string, unknown>): string {
  return Object.entries(args)
    .filter(([k, v]) => !/id$/i.test(k) && v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ")
}
