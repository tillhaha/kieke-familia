// src/app/page.tsx
"use client"

import { useSession, signIn } from "next-auth/react"
import { useState, useEffect, useCallback } from "react"
import { LogIn } from "lucide-react"
import { WeekBlock, WeekData, DayWeather, CustodyEntry } from "./week/WeekBlock"
import styles from "./page.module.css"


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

export default function Home() {
  const { data: session, status } = useSession()

  const [week, setWeek] = useState<WeekData | null>(null)
  const [weather, setWeather] = useState<Record<string, DayWeather> | null>(null)
  const [custodyEntries, setCustodyEntries] = useState<CustodyEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status !== "authenticated") return

    Promise.all([
      fetch("/api/weeks").then((r) => r.json()),
      fetch("/api/weather").then((r) => r.json()),
    ])
      .then(([weeksData, weatherData]) => {
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
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [status])

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
        <p className={styles.subtitle}>Here&apos;s what&apos;s going on this week.</p>
      </div>

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
