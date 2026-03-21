// src/app/page.tsx
"use client"

import { useSession, signIn } from "next-auth/react"
import Link from "next/link"
import { Calendar, CalendarDays, Briefcase, LogIn } from "lucide-react"
import styles from "./page.module.css"

const features = [
  {
    icon: Calendar,
    title: "Calendar",
    description: "Family events, birthdays, and travel in one view.",
    href: "/calendar",
    enabled: true,
  },
  {
    icon: CalendarDays,
    title: "Week planning",
    description: "Plan the week ahead together.",
    href: "/week",
    enabled: true,
  },
  {
    icon: Briefcase,
    title: "Work Locations",
    description: "Track who's working from where.",
    href: "#",
    enabled: false,
  },
]

export default function Home() {
  const { data: session } = useSession()

  if (!session) {
    return (
      <div className={styles.signInPage}>
        <div className={styles.signInCard}>
          <h1 className={styles.signInTitle}>Welcome to Familia</h1>
          <p className={styles.signInSubtitle}>Your shared family management hub.</p>
          <button onClick={() => signIn("google")} className={styles.signInBtn}>
            <LogIn size={16} />
            Sign in with Google
          </button>
        </div>
      </div>
    )
  }

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
        <p className={styles.subtitle}>Here's what's going on for the family.</p>
      </div>

      <div className={styles.grid}>
        {features.map(({ icon: Icon, title, description, href, enabled }) => {
          const card = (
            <div className={`${styles.card} ${!enabled ? styles.cardDisabled : ""}`}>
              <div className={styles.cardIcon}>
                <Icon size={20} strokeWidth={1.75} />
              </div>
              <h2 className={styles.cardTitle}>{title}</h2>
              <p className={styles.cardDesc}>{description}</p>
              {!enabled && <span className={styles.comingSoon}>Coming soon</span>}
            </div>
          )

          return enabled ? (
            <Link key={title} href={href} className={styles.cardLink}>
              {card}
            </Link>
          ) : (
            <div key={title}>{card}</div>
          )
        })}
      </div>
    </main>
  )
}
