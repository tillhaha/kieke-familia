// src/app/settings/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState } from "react"
import { User, CalendarDays, MapPin, Home, ShoppingCart } from "lucide-react"
import { GoogleSection } from "./GoogleSection"
import { ProfileSection } from "./ProfileSection"
import { LocationSection } from "./LocationSection"
import { UsersSection } from "./UsersSection"
import { ShoppingSection } from "./ShoppingSection"
import styles from "./settings.module.css"

type Section = "profile" | "google" | "location" | "family" | "shopping"

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
          <User size={15} />
          Profile
        </button>
        <button
          className={`${styles.sectionBtn} ${activeSection === "google" ? styles.active : ""}`}
          onClick={() => setActiveSection("google")}
        >
          <CalendarDays size={15} />
          Google Calendar
        </button>
        <button
          className={`${styles.sectionBtn} ${activeSection === "location" ? styles.active : ""}`}
          onClick={() => setActiveSection("location")}
        >
          <MapPin size={15} />
          Location
        </button>
        <button
          className={`${styles.sectionBtn} ${activeSection === "family" ? styles.active : ""}`}
          onClick={() => setActiveSection("family")}
        >
          <Home size={15} />
          Family
        </button>
        <button
          className={`${styles.sectionBtn} ${activeSection === "shopping" ? styles.active : ""}`}
          onClick={() => setActiveSection("shopping")}
        >
          <ShoppingCart size={15} />
          Shopping
        </button>
      </aside>

      <div className={styles.content}>
        {activeSection === "profile" && <ProfileSection />}
        {activeSection === "google" && <GoogleSection />}
        {activeSection === "location" && <LocationSection />}
        {activeSection === "family" && <UsersSection />}
        {activeSection === "shopping" && <ShoppingSection />}
      </div>
    </div>
  )
}
