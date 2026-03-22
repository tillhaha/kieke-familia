// src/app/settings/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState } from "react"
import { GoogleSection } from "./GoogleSection"
import { ProfileSection } from "./ProfileSection"
import { LocationSection } from "./LocationSection"
import { UsersSection } from "./UsersSection"
import styles from "./settings.module.css"

type Section = "profile" | "google" | "location" | "users"

export default function SettingsPage() {
  const { status } = useSession()
  const [activeSection, setActiveSection] = useState<Section>("profile")

  if (status === "loading") return null

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <p className={styles.sidebarTitle}>Settings</p>
        <button
          className={`${styles.sectionBtn} ${activeSection === "profile" ? styles.active : ""}`}
          onClick={() => setActiveSection("profile")}
        >
          Profile
        </button>
        <button
          className={`${styles.sectionBtn} ${activeSection === "google" ? styles.active : ""}`}
          onClick={() => setActiveSection("google")}
        >
          Google
        </button>
        <button
          className={`${styles.sectionBtn} ${activeSection === "location" ? styles.active : ""}`}
          onClick={() => setActiveSection("location")}
        >
          Location
        </button>
        <button
          className={`${styles.sectionBtn} ${activeSection === "users" ? styles.active : ""}`}
          onClick={() => setActiveSection("users")}
        >
          Users
        </button>
      </aside>

      <div className={styles.content}>
        {activeSection === "profile" && <ProfileSection />}
        {activeSection === "google" && <GoogleSection />}
        {activeSection === "location" && <LocationSection />}
        {activeSection === "users" && <UsersSection />}
      </div>
    </div>
  )
}
