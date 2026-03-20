// src/app/settings/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState } from "react"
import { GoogleSection } from "./GoogleSection"
import styles from "./settings.module.css"

type Section = "google"

export default function SettingsPage() {
  const { status } = useSession()
  const [activeSection, setActiveSection] = useState<Section>("google")

  // Middleware handles the actual redirect; this prevents a flash while the
  // session cookie is being validated client-side.
  if (status === "loading") return null

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <p className={styles.sidebarTitle}>Settings</p>
        <button
          className={`${styles.sectionBtn} ${activeSection === "google" ? styles.active : ""}`}
          onClick={() => setActiveSection("google")}
        >
          Google
        </button>
      </aside>

      <div className={styles.content}>
        {activeSection === "google" && <GoogleSection />}
      </div>
    </div>
  )
}
