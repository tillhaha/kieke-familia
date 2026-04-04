// src/app/page.tsx
"use client"

import { useSession, signIn } from "next-auth/react"
import { useState, useEffect, useCallback } from "react"
import { LogIn } from "lucide-react"
import { WeekBlock, WeekData, DayWeather, CustodyEntry } from "./week/WeekBlock"
import { TaskModal, TaskData } from "./tasks/TaskModal"
import styles from "./page.module.css"

type FamilyTask = TaskData

function todayUTCString(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().split("T")[0]
}

function findCurrentWeek(weeks: WeekData[]): WeekData | null {
  const today = todayUTCString()
  // First: find a week that contains today
  const exact = weeks.find((w) => w.startDate <= today && w.endDate >= today)
  if (exact) return exact
  // Fallback: nearest upcoming week
  const upcoming = weeks
    .filter((w) => w.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  return upcoming[0] ?? null
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default function Home() {
  const { data: session, status } = useSession()

  const [week, setWeek] = useState<WeekData | null>(null)
  const [weather, setWeather] = useState<Record<string, DayWeather> | null>(null)
  const [custodyEntries, setCustodyEntries] = useState<CustodyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<FamilyTask[]>([])
  const [members, setMembers] = useState<{ id: string; name: string | null }[]>([])
  const [openTask, setOpenTask] = useState<FamilyTask | null>(null)

  useEffect(() => {
    if (status !== "authenticated") return

    Promise.all([
      fetch("/api/weeks").then((r) => r.json()),
      fetch("/api/weather").then((r) => r.json()),
      fetch("/api/tasks").then((r) => r.ok ? r.json() : { tasks: [] }).catch(() => ({ tasks: [] })),
      fetch("/api/family/members").then((r) => r.ok ? r.json() : { members: [] }).catch(() => ({ members: [] })),
    ])
      .then(([weeksData, weatherData, taskData, memberData]) => {
        const weeks: WeekData[] = weeksData.weeks ?? []
        const currentWeek = findCurrentWeek(weeks)
        setWeek(currentWeek)
        setWeather(weatherData.weather ?? null)

        if (currentWeek) {
          const timeMin = `${currentWeek.startDate}T00:00:00Z`
          const timeMax = `${currentWeek.endDate}T23:59:59Z`
          fetch(`/api/calendar/events?timeMin=${timeMin}&timeMax=${timeMax}`)
            .then((r) => r.json())
            .then((d) => setCustodyEntries(d.custodyEntries ?? []))
            .catch(() => {})
        }

        setTasks(
          (taskData.tasks ?? []).map((t: any) => ({
            ...t,
            dueDate: (t.dueDate as string).slice(0, 10),
          }))
        )
        setMembers(memberData.members ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [status])

  const handleToggleDone = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: true }),
    }).catch(() => {})
  }, [])

  const handleTaskSave = useCallback(async (data: { name: string; description: string; dueDate: string; assigneeIds: string[] }) => {
    if (!openTask) return
    const r = await fetch(`/api/tasks/${openTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!r.ok) {
      const err = await r.json()
      throw new Error(err.error ?? "Failed to update")
    }
    const { task } = await r.json()
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...task, dueDate: task.dueDate.slice(0, 10) } : t))
    setOpenTask(null)
  }, [openTask])

  const handleTaskDelete = useCallback(async () => {
    if (!openTask) return
    const r = await fetch(`/api/tasks/${openTask.id}`, { method: "DELETE" })
    if (!r.ok) throw new Error("Failed to delete")
    setTasks((prev) => prev.filter((t) => t.id !== openTask.id))
    setOpenTask(null)
  }, [openTask])

  const handleDayUpdate = useCallback(
    (date: string, field: string, value: string | null) => {
      setWeek((prev) =>
        prev
          ? {
              ...prev,
              days: prev.days.map((d) => (d.date === date ? { ...d, [field]: value } : d)),
            }
          : prev
      )
    },
    []
  )

  if (status === "loading") return null

  if (!session) {
    return (
      <div className={styles.signInPage}>
        <div className={styles.signInCard}>
          <h1 className={styles.signInTitle}>Welcome to YourKieke</h1>
          <p className={styles.signInSubtitle}>Your shared family management hub.</p>

          <button onClick={() => signIn("google", { callbackUrl: "/" })} className={styles.signInBtn}>
            <LogIn size={16} />
            Sign in with Google
          </button>

          <div className={styles.divider}>
            <span className={styles.dividerText}>or</span>
          </div>

          <CredentialsForm />
        </div>
      </div>
    )
  }

  if (loading) return null

  const firstName = session.user?.name?.split(" ")[0] ?? "there"
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <h1 className={styles.greeting}>
          {greeting}, {firstName}
        </h1>
      </div>

      <TasksWidget tasks={tasks} onToggleDone={handleToggleDone} onOpenTask={setOpenTask} />

      {openTask && (
        <TaskModal
          task={openTask}
          members={members}
          onSave={handleTaskSave}
          onDelete={handleTaskDelete}
          onClose={() => setOpenTask(null)}
        />
      )}

      {week ? (
        <WeekBlock
          week={week}
          onDayUpdate={handleDayUpdate}
          weather={weather ?? undefined}
          custodyEntries={custodyEntries}
          readOnly
          editHref={`/week#week-${week.startDate}`}
        />
      ) : (
        <p className={styles.noWeek}>
          No plan for this week yet.{" "}
          <a href="/week" className={styles.noWeekLink}>Go to week planning →</a>
        </p>
      )}
    </main>
  )
}

function TasksWidget({ tasks, onToggleDone, onOpenTask }: { tasks: FamilyTask[]; onToggleDone: (id: string) => void; onOpenTask: (task: FamilyTask) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  const daysUntilSaturday = (6 - d.getUTCDay() + 7) % 7
  d.setUTCDate(d.getUTCDate() + daysUntilSaturday)
  const endOfWeek = d.toISOString().slice(0, 10)

  const visible = tasks.filter(
    (t) => !t.done && (t.dueDate < today || (t.dueDate >= today && t.dueDate <= endOfWeek))
  )
  if (visible.length === 0) return null

  return (
    <div className={styles.tasksWidget}>
      <div className={styles.tasksWidgetTitle}>Tasks this week</div>
      <div className={styles.tasksWidgetList}>
        {visible.map((t) => {
          const isOverdue = t.dueDate < today
          const names = t.assignees.map((a) => a.user.name ?? "?").join(", ")
          return (
            <div key={t.id} className={styles.tasksWidgetRow}>
              <input
                type="checkbox"
                className={styles.tasksWidgetCheckbox}
                checked={false}
                onChange={() => onToggleDone(t.id)}
              />
              <div className={styles.tasksWidgetContent}>
                <button className={styles.tasksWidgetName} onClick={() => onOpenTask(t)}>{t.name}</button>
                <span className={`${styles.tasksWidgetMeta}${isOverdue ? ` ${styles.overdue}` : ""}`}>
                  {formatDate(t.dueDate)}{names ? ` · ${names}` : ""}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <a href="/tasks" className={styles.tasksWidgetLink}>→ All tasks</a>
    </div>
  )
}

function CredentialsForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const result = await signIn("credentials", {
      username,
      password,
      callbackUrl: "/",
      redirect: false,
    })
    setLoading(false)
    if (result?.error) {
      setError("Invalid username or password")
    } else if (result?.url) {
      window.location.href = result.url
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.credentialsForm}>
      <div className={styles.credentialField}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={styles.credentialInput}
          autoComplete="username"
          required
        />
      </div>
      <div className={styles.credentialField}>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={styles.credentialInput}
          autoComplete="current-password"
          required
        />
      </div>
      {error && <p className={styles.credentialError}>{error}</p>}
      <button type="submit" disabled={loading} className={styles.signInBtn}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  )
}
