// src/app/tasks/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect, useCallback } from "react"
import { Plus } from "lucide-react"
import { TaskModal, TaskData } from "./TaskModal"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./tasks.module.css"

type Member = { id: string; name: string | null }

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function endOfWeekStr() {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  // Week is Sun–Sat (matches the week planner). Target the coming Saturday.
  // getUTCDay(): Sun=0, Mon=1, ..., Sat=6
  const daysUntilSaturday = (6 - d.getUTCDay() + 7) % 7
  d.setUTCDate(d.getUTCDate() + daysUntilSaturday)
  return d.toISOString().slice(0, 10)
}

function toDateStr(iso: string) {
  return iso.slice(0, 10)
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

type TaskRowProps = {
  task: TaskData
  today: string
  setModalTask: (task: TaskData) => void
  toggleDone: (task: TaskData) => void
}

function TaskRow({ task, today, setModalTask, toggleDone }: TaskRowProps) {
  const dateStr = task.dueDate.slice(0, 10)
  const isOverdue = dateStr < today
  const names = task.assignees.map((a) => a.user.name ?? "?").join(", ")
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

type SectionProps = {
  label: string
  tasks: TaskData[]
  isOverdue?: boolean
  today: string
  setModalTask: (task: TaskData) => void
  toggleDone: (task: TaskData) => void
}

function Section({ label, tasks, isOverdue, today, setModalTask, toggleDone }: SectionProps) {
  if (tasks.length === 0) return null
  return (
    <div className={styles.section}>
      <div className={`${styles.sectionLabel} ${isOverdue ? styles.overdue : ""}`}>{label}</div>
      <div className={styles.taskList}>
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} today={today} setModalTask={setModalTask} toggleDone={toggleDone} />
        ))}
      </div>
    </div>
  )
}

export default function TasksPage() {
  const { status } = useSession()
  const { t } = useTranslation()
  const [tasks, setTasks] = useState<TaskData[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showDone, setShowDone] = useState(false)
  const [filterAssigneeId, setFilterAssigneeId] = useState("")
  const [modalTask, setModalTask] = useState<TaskData | null | undefined>(undefined) // undefined = closed, null = new

  const fetchTasks = useCallback(async (includeDone: boolean) => {
    try {
      const r = await fetch(`/api/tasks${includeDone ? "?includeDone=true" : ""}`)
      if (!r.ok) return
      const data = await r.json()
      setTasks(
        (data.tasks ?? []).map((t: any) => ({
          ...t,
          dueDate: toDateStr(t.dueDate),
        }))
      )
    } catch {
      // silently ignore — UI keeps previous state
    }
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
    const newDone = !task.done
    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: newDone } : t)))
    const r = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: newDone }),
    })
    if (!r.ok) {
      // Roll back
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)))
      return
    }
    // Remove from list if hiding done tasks and we just marked as done
    if (!showDone && newDone) {
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

  const filtered = filterAssigneeId
    ? tasks.filter((t) => t.assignees.some((a) => a.userId === filterAssigneeId))
    : tasks

  const openTasks = filtered.filter((t) => !t.done)
  const doneTasks = filtered.filter((t) => t.done)

  const overdue = openTasks.filter((t) => t.dueDate < today)
  const thisWeek = openTasks.filter((t) => t.dueDate >= today && t.dueDate <= endOfWeek)
  const later = openTasks.filter((t) => t.dueDate > endOfWeek)

  const hasAnyOpen = overdue.length > 0 || thisWeek.length > 0 || later.length > 0

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t.tasks.title}</h1>
        <button className={styles.newBtn} onClick={() => setModalTask(null)}>
          <Plus size={14} strokeWidth={2.5} />
          {t.tasks.newTask}
        </button>
      </div>

      <div className={styles.filterBar}>
        <select
          className={styles.filterSelect}
          value={filterAssigneeId}
          onChange={(e) => setFilterAssigneeId(e.target.value)}
        >
          <option value="">{t.tasks.allMembers}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name ?? m.id}</option>
          ))}
        </select>
        <button
          className={`${styles.filterToggle} ${showDone ? styles.filterToggleActive : ""}`}
          onClick={handleShowDoneToggle}
        >
          {t.tasks.showCompleted}
        </button>
      </div>

      {!hasAnyOpen && !showDone && (
        <p className={styles.empty}>{t.tasks.noOpenTasks}</p>
      )}
      {!hasAnyOpen && showDone && doneTasks.length === 0 && (
        <p className={styles.empty}>{t.tasks.noTasksYet}</p>
      )}

      <Section label={t.tasks.overdue} tasks={overdue} isOverdue today={today} setModalTask={setModalTask} toggleDone={toggleDone} />
      <Section label={t.tasks.thisWeek} tasks={thisWeek} today={today} setModalTask={setModalTask} toggleDone={toggleDone} />
      <Section label={t.tasks.later} tasks={later} today={today} setModalTask={setModalTask} toggleDone={toggleDone} />

      {showDone && doneTasks.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t.tasks.done}</div>
          <div className={styles.taskList}>
            {doneTasks.map((t) => (
              <TaskRow key={t.id} task={t} today={today} setModalTask={setModalTask} toggleDone={toggleDone} />
            ))}
          </div>
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
