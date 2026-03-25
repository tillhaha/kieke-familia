// src/app/tasks/TaskModal.tsx
"use client"

import { useState, useEffect } from "react"
import styles from "./tasks.module.css"

type Member = { id: string; name: string | null }

export type TaskData = {
  id: string
  name: string
  description: string | null
  dueDate: string // YYYY-MM-DD
  done: boolean
  assignees: { userId: string; user: { id: string; name: string | null } }[]
}

type Props = {
  task?: TaskData | null  // null = create mode, TaskData = edit mode
  members: Member[]
  onSave: (data: { name: string; description: string; dueDate: string; assigneeIds: string[] }) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

export function TaskModal({ task, members, onSave, onDelete, onClose }: Props) {
  const isEdit = !!task
  const [name, setName] = useState(task?.name ?? "")
  const [description, setDescription] = useState(task?.description ?? "")
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "")
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    task?.assignees.map((a) => a.userId) ?? []
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return }
    if (!dueDate) { setError("Due date is required"); return }
    setSaving(true)
    setError("")
    try {
      await onSave({ name: name.trim(), description: description.trim(), dueDate, assigneeIds })
    } catch (e: any) {
      setError(e?.message ?? "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDelete || !confirm("Delete this task?")) return
    setDeleting(true)
    try {
      await onDelete()
    } catch {
      setError("Failed to delete")
      setDeleting(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <h2 className={styles.modalTitle}>{isEdit ? "Edit task" : "New task"}</h2>

        <div className={styles.field}>
          <label className={styles.label}>Name *</label>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Task name"
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Description</label>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details…"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Due date *</label>
          <input
            type="date"
            className={styles.input}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Assignees</label>
          <div className={styles.assigneeList}>
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`${styles.assigneeChip} ${assigneeIds.includes(m.id) ? styles.selected : ""}`}
                onClick={() => toggleAssignee(m.id)}
              >
                {m.name ?? m.id}
              </button>
            ))}
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.modalFooter}>
          {isEdit && onDelete && (
            <button className={styles.deleteBtn} onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}
