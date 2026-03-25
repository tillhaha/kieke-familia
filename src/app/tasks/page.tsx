// src/app/tasks/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect, useCallback } from "react"
import { Plus } from "lucide-react"
import { TaskModal, TaskData } from "./TaskModal"
import styles from "./tasks.module.css"

type Member = { id: string; name: string | null }

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function endOfWeekStr() {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  const daysUntilSunday = (7 - d.getUTCDay()) % 7
  d.setUTCDate(d.getUTCDate() + daysUntilSunday)
  return d.toISOString().slice(0, 10)
}

function toDateStr(iso: string) {
  return iso.slice(0, 10)
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function assigneeNames(task: TaskData) {
  return task.assignees.map((a) => a.user.name ?? "?").join(", ")
}

export default function TasksPage() {
  const { status } = useSession()
  const [tasks, setTasks] = useState<TaskData[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showDone, setShowDone] = useState(false)
  const [modalTask, setModalTask] = useState<TaskData | null | undefined>(undefined) // undefined = closed, null = new

  const fetchTasks = useCallback(async (includeDone: boolean) => {
    const r = await fetch(`/api/tasks${includeDone ? "?includeDone=true" : ""}`)
    const data = await r.json()
    setTasks(
      (data.tasks ?? []).map((t: any) => ({
        ...t,
        dueDate: toDateStr(t.dueDate),
      }))
    )
  }, [])

  useEffect(() => {
    if (status !== "authenticated") return
    Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/family/members").then((r) => r.json()),
    ]).then(([taskData, memberData]) => {
      setTasks(
        (taskData.tasks ?? []).map((t: any) => ({
          ...t,
          dueDate: toDateStr(t.dueDate),
        }))
      )
      setMembers(memberData.members ?? [])
    }).finally(() => setLoading(false))
  }, [status])

  async function toggleDone(task: TaskData) {
    const updated = { ...task, done: !task.done }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done }),
    })
    if (!showDone && !task.done) {
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
    }
  }

  async function handleSave(data: { name: string; description: string; dueDate: string; assigneeIds: string[] }) {
    if (modalTask === null) {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error ?? "Failed to create")
      }
      const { task } = await r.json()
      setTasks((prev) => [...prev, { ...task, dueDate: toDateStr(task.dueDate) }].sort((a, b) => a.dueDate.localeCompare(b.dueDate)))
    } else if (modalTask) {
      const r = await fetch(`/api/tasks/${modalTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error ?? "Failed to update")
      }
      const { task } = await r.json()
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...task, dueDate: toDateStr(task.dueDate) } : t))
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      )
    }
    setModalTask(undefined)
  }

  async function handleDelete() {
    if (!modalTask) return
    const r = await fetch(`/api/tasks/${modalTask.id}`, { method: "DELETE" })
    if (!r.ok) throw new Error("Failed to delete")
    setTasks((prev) => prev.filter((t) => t.id !== modalTask.id))
    setModalTask(undefined)
  }

  async function handleShowDoneToggle() {
    const next = !showDone
    setShowDone(next)
    await fetchTasks(next)
  }

  if (status === "loading" || loading) return null

  const today = todayStr()
  const endOfWeek = endOfWeekStr()

  const openTasks = tasks.filter((t) => !t.done)
  const doneTasks = tasks.filter((t) => t.done)

  const overdue = openTasks.filter((t) => t.dueDate < today)
  const thisWeek = openTasks.filter((t) => t.dueDate >= today && t.dueDate <= endOfWeek)
  const later = openTasks.filter((t) => t.dueDate > endOfWeek)

  function TaskRow({ task }: { task: TaskData }) {
    const dateStr = toDateStr(task.dueDate)
    const isOverdue = dateStr < today
    const names = assigneeNames(task)
    return (
      <div
        className={`${styles.taskRow} ${task.done ? styles.taskDone : ""}`}
        onClick={() => setModalTask(task)}
      >
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={task.done}
          onChange={(e) => { e.stopPropagation(); toggleDone(task) }}
          onClick={(e) => e.stopPropagation()}
        />
        <div className={styles.taskInfo}>
          <span className={styles.taskName}>{task.name}</span>
          <span className={`${styles.taskMeta} ${isOverdue && !task.done ? styles.overdue : ""}`}>
            {formatDate(dateStr)}{names ? ` · ${names}` : ""}
          </span>
        </div>
      </div>
    )
  }

  function Section({ label, tasks, isOverdue }: { label: string; tasks: TaskData[]; isOverdue?: boolean }) {
    if (tasks.length === 0) return null
    return (
      <div className={styles.section}>
        <div className={`${styles.sectionLabel} ${isOverdue ? styles.overdue : ""}`}>{label}</div>
        {tasks.map((t) => <TaskRow key={t.id} task={t} />)}
      </div>
    )
  }

  const hasAnyOpen = overdue.length > 0 || thisWeek.length > 0 || later.length > 0

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Tasks</h1>
        <div className={styles.headerActions}>
          <button className={styles.showDoneToggle} onClick={handleShowDoneToggle}>
            {showDone ? "Hide done" : "Show done"}
          </button>
          <button className={styles.newBtn} onClick={() => setModalTask(null)}>
            <Plus size={14} strokeWidth={2.5} />
            New task
          </button>
        </div>
      </div>

      {!hasAnyOpen && !showDone && (
        <p className={styles.empty}>No open tasks.</p>
      )}
      {!hasAnyOpen && showDone && doneTasks.length === 0 && (
        <p className={styles.empty}>No tasks yet. Create one to get started.</p>
      )}

      <Section label="Overdue" tasks={overdue} isOverdue />
      <Section label="This week" tasks={thisWeek} />
      <Section label="Later" tasks={later} />

      {showDone && doneTasks.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Done</div>
          {doneTasks.map((t) => <TaskRow key={t.id} task={t} />)}
        </div>
      )}

      {modalTask !== undefined && (
        <TaskModal
          task={modalTask}
          members={members}
          onSave={handleSave}
          onDelete={modalTask ? handleDelete : undefined}
          onClose={() => setModalTask(undefined)}
        />
      )}
    </div>
  )
}
