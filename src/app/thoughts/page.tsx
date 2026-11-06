// src/app/thoughts/page.tsx
// Private "brain dump" inbox: free text in, Claude splits it into categorised
// items on the user's own todo list. Only the signed-in user sees these.
"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Lock, Send, Tags, X, Brain } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./thoughts.module.css"
import { EmptyState } from "@/components/ui/EmptyState"
import { Page } from "@/components/ui/Page"
import { Button } from "@/components/ui/Button"
import { PageHeader } from "@/components/ui/PageHeader"
import { FilterPill } from "@/components/ui/FilterPill"
import { CategoriesModal, type CategoryDef } from "./CategoriesModal"

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
  const [catDefs, setCatDefs] = useState<CategoryDef[]>([])
  const [managing, setManaging] = useState(false)
  // Drag & drop between categories (desktop)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
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

  const fetchCategories = useCallback(async () => {
    try {
      const r = await fetch("/api/personal-categories")
      if (!r.ok) return
      const data = await r.json()
      setCatDefs(data.categories ?? [])
    } catch {
      // keep previous state
    }
  }, [])

  useEffect(() => {
    if (status !== "authenticated") return
    Promise.all([fetchTodos(false), fetchCategories()]).finally(() => setLoading(false))
  }, [status, fetchTodos, fetchCategories])

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
      fetchCategories()
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
    if (updated.category !== editing.category) fetchCategories()
  }

  async function moveTodo(id: string, category: string) {
    const todo = todos.find((x) => x.id === id)
    if (!todo || todo.category === category) return
    setError("")
    setTodos((prev) => prev.map((x) => (x.id === id ? { ...x, category } : x)))
    const updated = await patch(id, { category })
    if (!updated) {
      setTodos((prev) => prev.map((x) => (x.id === id ? { ...x, category: todo.category } : x)))
      setError(tt.failed)
      return
    }
    setTodos((prev) => prev.map((x) => (x.id === id ? updated : x)))
    setLastAdded((prev) => prev.map((x) => (x.id === id ? updated : x)))
  }

  // Props that make an element a drop target for dragged rows
  function dropProps(category: string) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!dragId) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        if (dropTarget !== category) setDropTarget(category)
      },
      onDragLeave: (e: React.DragEvent) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setDropTarget((cur) => (cur === category ? null : cur))
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        const id = dragId ?? e.dataTransfer.getData("text/plain")
        setDragId(null)
        setDropTarget(null)
        if (id) moveTodo(id, category)
      },
    }
  }

  async function handleCategoriesChanged() {
    await Promise.all([fetchCategories(), fetchTodos(showDone)])
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

  // Own categories (also empty ones) plus any name still only used by a todo
  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const def of catDefs) counts.set(def.name, 0)
    for (const todo of todos) if (!todo.done) counts.set(todo.category, (counts.get(todo.category) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [todos, catDefs])

  const allCategories = useMemo(
    () => [...new Set([...catDefs.map((c) => c.name), ...todos.map((x) => x.category)])].sort((a, b) => a.localeCompare(b)),
    [todos, catDefs]
  )

  // One flat list: next due first, then undated (newest first)
  const openTodos = useMemo(
    () => todos.filter((x) => !x.done && (!filter || x.category === filter)).sort(compareTodos),
    [todos, filter]
  )

  const doneTodos = todos
    .filter((x) => x.done && (!filter || x.category === filter))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  if (status === "loading" || loading) return null

  const today = todayStr()
  const locale = lang === "de" ? "de-DE" : lang === "es" ? "es-ES" : "en-US"

  function renderRow(todo: Todo) {
    const overdue = !todo.done && todo.dueDate !== null && todo.dueDate < today
    return (
      <div
        key={todo.id}
        className={`${styles.row} ${todo.done ? styles.rowDone : ""} ${dragId === todo.id ? styles.rowDragging : ""}`}
        onClick={() => setEditing(todo)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) setEditing(todo) }}
        draggable={!todo.done}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", todo.id)
          e.dataTransfer.effectAllowed = "move"
          setDragId(todo.id)
        }}
        onDragEnd={() => {
          setDragId(null)
          setDropTarget(null)
        }}
      >
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={todo.done}
          onChange={() => toggleDone(todo)}
          onClick={(e) => e.stopPropagation()}
        />
        <div className={styles.rowBody}>
          <span className={styles.rowTitle}>{todo.title}</span>
          <div className={styles.rowMeta}>
            <span className={styles.chip}>{todo.category}</span>
            {todo.dueDate && (
              <span className={`${styles.rowDue} ${overdue ? styles.overdue : ""}`}>
                {overdue ? `${tt.overdue} · ` : ""}{formatDate(todo.dueDate, locale)}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Page width="narrow">
      <PageHeader
        title={tt.title}
        addon={
          <span className={styles.titleLock} title={tt.privateHint} aria-label={tt.privateHint} role="img">
            <Lock size={16} strokeWidth={2.25} />
          </span>
        }
      />

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
          <Button variant="primary" icon={<Send size={14} strokeWidth={2.25} />} onClick={send} disabled={sending || !text.trim()}>
            {sending ? tt.sending : tt.send}
          </Button>
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
        <FilterPill active={filter === ""} onClick={() => setFilter("")}>
          {tt.all}
        </FilterPill>
        {categories.map(([name, count]) => (
          <FilterPill
            key={name}
            active={filter === name}
            highlight={dropTarget === name}
            count={count}
            onClick={() => setFilter(filter === name ? "" : name)}
            {...dropProps(name)}
          >
            {name}
          </FilterPill>
        ))}
        <Button variant="ghost" size="sm" icon={<Tags size={13} strokeWidth={2} />} onClick={() => setManaging(true)} title={tt.categoriesTitle}>
          {tt.manageCategories}
        </Button>
        <FilterPill className={styles.pushRight} active={showDone} onClick={handleShowDoneToggle}>
          {tt.showCompleted}
        </FilterPill>
      </div>

      {openTodos.length === 0 ? (
        <EmptyState icon={<Brain size={22} strokeWidth={1.75} />}>{filter ? tt.emptyCategory : tt.empty}</EmptyState>
      ) : (
        <div className={styles.list}>
          {openTodos.map(renderRow)}
        </div>
      )}

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

      {managing && (
        <CategoriesModal
          categories={categories.map(([name, count]) => {
            const def = catDefs.find((c) => c.name === name)
            return { id: def?.id ?? "", name, description: def?.description ?? null, count }
          }).filter((c) => c.id)}
          onChanged={handleCategoriesChanged}
          onClose={() => setManaging(false)}
        />
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
    </Page>
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
          <Button variant="danger" className={styles.pushLeft} onClick={() => run(onDelete)} disabled={busy}>
            {tt.delete}
          </Button>
          <Button variant="secondary" onClick={onClose}>{tt.cancel}</Button>
          <Button type="submit" variant="primary" disabled={busy}>{tt.save}</Button>
        </div>
      </form>
    </div>
  )
}
