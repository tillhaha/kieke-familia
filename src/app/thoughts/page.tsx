// src/app/thoughts/page.tsx
// Private "brain dump" inbox: free text in, Claude splits it into categorised
// items on the user's own todo list. Only the signed-in user sees these.
"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Lock, Send, X } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./thoughts.module.css"
import { AboutMe } from "./AboutMe"

type Todo = {
  id: string
  title: string
  note: string | null
  category: string
  dueDate: string | null // YYYY-MM-DD
  done: boolean
  createdAt: string
}

function normalize(t: Todo): Todo {
  return { ...t, dueDate: t.dueDate ? t.dueDate.slice(0, 10) : null }
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatDate(dateStr: string, locale: string) {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(locale, { month: "short", day: "numeric" })
}

// Open items with a date first (soonest first), then newest first
function compareTodos(a: Todo, b: Todo) {
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate)
  if (a.dueDate && !b.dueDate) return -1
  if (!a.dueDate && b.dueDate) return 1
  return b.createdAt.localeCompare(a.createdAt)
}

export default function ThoughtsPage() {
  const { status } = useSession()
  const { t, lang } = useTranslation()
  const tt = t.thoughts
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [lastAdded, setLastAdded] = useState<Todo[]>([])
  const [filter, setFilter] = useState("")
  const [showDone, setShowDone] = useState(false)
  const [editing, setEditing] = useState<Todo | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fetchTodos = useCallback(async (includeDone: boolean) => {
    try {
      const r = await fetch(`/api/personal-todos${includeDone ? "?includeDone=true" : ""}`)
      if (!r.ok) return
      const data = await r.json()
      setTodos((data.todos ?? []).map(normalize))
    } catch {
      // keep previous state
    }
  }, [])

  useEffect(() => {
    if (status !== "authenticated") return
    fetchTodos(false).finally(() => setLoading(false))
  }, [status, fetchTodos])

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
      const added: Todo[] = (data.todos ?? []).map(normalize)
      setTodos((prev) => [...added, ...prev])
      setLastAdded(added)
      setText("")
      textareaRef.current?.focus()
    } catch {
      setError(tt.failed)
    } finally {
      setSending(false)
    }
  }

  async function patch(id: string, data: Partial<Todo>): Promise<Todo | null> {
    const r = await fetch(`/api/personal-todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!r.ok) return null
    const { todo } = await r.json()
    return normalize(todo)
  }

  async function toggleDone(todo: Todo) {
    const done = !todo.done
    setTodos((prev) => prev.map((x) => (x.id === todo.id ? { ...x, done } : x)))
    const updated = await patch(todo.id, { done })
    if (!updated) {
      setTodos((prev) => prev.map((x) => (x.id === todo.id ? { ...x, done: todo.done } : x)))
      return
    }
    if (done && !showDone) {
      // Leave it visibly ticked for a moment before it disappears
      setTimeout(() => setTodos((prev) => prev.filter((x) => x.id !== todo.id || !x.done)), 600)
    }
  }

  async function saveEdit(data: { title: string; note: string; category: string; dueDate: string }) {
    if (!editing) return
    const updated = await patch(editing.id, {
      title: data.title,
      note: data.note,
      category: data.category,
      dueDate: data.dueDate || null,
    })
    if (!updated) throw new Error()
    setTodos((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
    setLastAdded((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
    setEditing(null)
  }

  async function deleteTodo() {
    if (!editing) return
    const r = await fetch(`/api/personal-todos/${editing.id}`, { method: "DELETE" })
    if (!r.ok) throw new Error()
    setTodos((prev) => prev.filter((x) => x.id !== editing.id))
    setLastAdded((prev) => prev.filter((x) => x.id !== editing.id))
    setEditing(null)
  }

  async function handleShowDoneToggle() {
    const next = !showDone
    setShowDone(next)
    await fetchTodos(next)
  }

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const todo of todos) if (!todo.done) counts.set(todo.category, (counts.get(todo.category) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [todos])

  const allCategories = useMemo(() => [...new Set(todos.map((x) => x.category))].sort(), [todos])

  const groups = useMemo(() => {
    const open = todos.filter((x) => !x.done && (!filter || x.category === filter))
    const map = new Map<string, Todo[]>()
    for (const [name] of categories) map.set(name, [])
    for (const todo of open) map.get(todo.category)?.push(todo)
    return [...map.entries()].filter(([, items]) => items.length > 0).map(([name, items]) => [name, items.sort(compareTodos)] as const)
  }, [todos, filter, categories])

  const doneTodos = todos
    .filter((x) => x.done && (!filter || x.category === filter))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  if (status === "loading" || loading) return null

  const today = todayStr()
  const locale = lang === "de" ? "de-DE" : lang === "es" ? "es-ES" : "en-US"

  function renderRow(todo: Todo) {
    const overdue = !todo.done && todo.dueDate !== null && todo.dueDate < today
    return (
      <div key={todo.id} className={`${styles.row} ${todo.done ? styles.rowDone : ""}`} onClick={() => setEditing(todo)}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={todo.done}
          onChange={() => toggleDone(todo)}
          onClick={(e) => e.stopPropagation()}
        />
        <div className={styles.rowBody}>
          <span className={styles.rowTitle}>{todo.title}</span>
          {todo.note && <span className={styles.rowNote}>{todo.note}</span>}
        </div>
        {todo.dueDate && (
          <span className={`${styles.rowDue} ${overdue ? styles.overdue : ""}`}>
            {overdue ? `${tt.overdue} · ` : ""}{formatDate(todo.dueDate, locale)}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{tt.title}</h1>
        <span className={styles.privateHint}>
          <Lock size={12} strokeWidth={2.25} />
          {tt.privateHint}
        </span>
      </div>

      <AboutMe />

      <div className={styles.composer}>
        <p className={styles.subtitle}>{tt.subtitle}</p>
        <textarea
          ref={textareaRef}
          className={styles.composerInput}
          value={text}
          placeholder={tt.placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              send()
            }
          }}
          rows={3}
          maxLength={5000}
          disabled={sending}
        />
        <div className={styles.composerFooter}>
          <span className={styles.composerHint}>{tt.sendHint}</span>
          <button className={styles.sendBtn} onClick={send} disabled={sending || !text.trim()}>
            <Send size={14} strokeWidth={2.25} />
            {sending ? tt.sending : tt.send}
          </button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        {lastAdded.length > 0 && (
          <div className={styles.added}>
            <div className={styles.addedHeader}>
              <span>{tt.added.replace("{n}", String(lastAdded.length))}</span>
              <button className={styles.iconBtn} onClick={() => setLastAdded([])} aria-label={tt.cancel}>
                <X size={14} />
              </button>
            </div>
            <ul className={styles.addedList}>
              {lastAdded.map((a) => (
                <li key={a.id}>
                  <span className={styles.addedTitle}>{a.title}</span>
                  <span className={styles.chip}>{a.category}</span>
                  {a.dueDate && <span className={styles.addedDue}>{formatDate(a.dueDate, locale)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className={styles.filterBar}>
        <button className={`${styles.pill} ${filter === "" ? styles.pillActive : ""}`} onClick={() => setFilter("")}>
          {tt.all}
        </button>
        {categories.map(([name, count]) => (
          <button
            key={name}
            className={`${styles.pill} ${filter === name ? styles.pillActive : ""}`}
            onClick={() => setFilter(filter === name ? "" : name)}
          >
            {name} <span className={styles.pillCount}>{count}</span>
          </button>
        ))}
        <button
          className={`${styles.pill} ${styles.pillToggle} ${showDone ? styles.pillActive : ""}`}
          onClick={handleShowDoneToggle}
        >
          {tt.showCompleted}
        </button>
      </div>

      {groups.length === 0 && <p className={styles.empty}>{tt.empty}</p>}

      {groups.map(([name, items]) => (
        <section key={name} className={styles.section}>
          <div className={styles.sectionLabel}>{name}</div>
          <div className={styles.list}>
            {items.map(renderRow)}
          </div>
        </section>
      ))}

      {showDone && (
        <section className={styles.section}>
          <div className={styles.sectionLabel}>{tt.done}</div>
          {doneTodos.length === 0 ? (
            <p className={styles.emptySmall}>{tt.emptyDone}</p>
          ) : (
            <div className={styles.list}>
              {doneTodos.map(renderRow)}
            </div>
          )}
        </section>
      )}

      {editing && (
        <EditModal
          todo={editing}
          categories={allCategories}
          onSave={saveEdit}
          onDelete={deleteTodo}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

type EditModalProps = {
  todo: Todo
  categories: string[]
  onSave: (data: { title: string; note: string; category: string; dueDate: string }) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}

function EditModal({ todo, categories, onSave, onDelete, onClose }: EditModalProps) {
  const { t } = useTranslation()
  const tt = t.thoughts
  const [title, setTitle] = useState(todo.title)
  const [note, setNote] = useState(todo.note ?? "")
  const [category, setCategory] = useState(todo.category)
  const [dueDate, setDueDate] = useState(todo.dueDate ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError("")
    try {
      await action()
    } catch {
      setError(tt.failed)
      setBusy(false)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError(tt.titleRequired)
    run(() => onSave({ title, note, category: category.trim() || todo.category, dueDate }))
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className={styles.modalTitle}>{tt.editTitle}</h2>
        <label className={styles.field}>
          <span className={styles.label}>{tt.titleLabel}</span>
          <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{tt.noteLabel}</span>
          <textarea className={styles.textarea} value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </label>
        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span className={styles.label}>{tt.categoryLabel}</span>
            <input
              className={styles.input}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="thought-categories"
              maxLength={40}
            />
            <datalist id="thought-categories">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{tt.dueDateLabel}</span>
            <input type="date" className={styles.input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.modalFooter}>
          <button type="button" className={styles.deleteBtn} onClick={() => run(onDelete)} disabled={busy}>
            {tt.delete}
          </button>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>{tt.cancel}</button>
          <button type="submit" className={styles.saveBtn} disabled={busy}>{tt.save}</button>
        </div>
      </form>
    </div>
  )
}
