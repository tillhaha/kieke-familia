// src/app/settings/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState } from "react"
import { User, CalendarDays, MapPin, Home, ShoppingCart, Globe } from "lucide-react"
import { GoogleSection } from "./GoogleSection"
import { ProfileSection } from "./ProfileSection"
import { LocationSection } from "./LocationSection"
import { UsersSection } from "./UsersSection"
import { ShoppingSection } from "./ShoppingSection"
import { LanguageSection } from "./LanguageSection"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./settings.module.css"

type Section = "profile" | "google" | "location" | "family" | "shopping" | "language"

export default function SettingsPage() {
  const { status } = useSession()
  const [activeSection, setActiveSection] = useState<Section>("profile")
  const { t } = useTranslation()

  if (status === "loading") return null

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <p className={styles.sidebarTitle}>{t.settings.title}</p>
        <button
          className={`${styles.sectionBtn} ${activeSection === "profile" ? styles.active : ""}`}
          onClick={() => setActiveSection("profile")}
        >
          <User size={15} />
          {t.settings.profile}
        </button>
        <button
          className={`${styles.sectionBtn} ${activeSection === "google" ? styles.active : ""}`}
          onClick={() => setActiveSection("google")}
        >
          <CalendarDays size={15} />
          {t.settings.googleCalendar}
        </button>
        <button
          className={`${styles.sectionBtn} ${activeSection === "location" ? styles.active : ""}`}
          onClick={() => setActiveSection("location")}
        >
          <MapPin size={15} />
          {t.settings.location}
        </button>
        <button
          className={`${styles.sectionBtn} ${activeSection === "family" ? styles.active : ""}`}
          onClick={() => setActiveSection("family")}
        >
          <Home size={15} />
          {t.settings.family}
        </button>
        <button
          className={`${styles.sectionBtn} ${activeSection === "shopping" ? styles.active : ""}`}
          onClick={() => setActiveSection("shopping")}
        >
          <ShoppingCart size={15} />
          {t.settings.shopping}
        </button>
        <button
          className={`${styles.sectionBtn} ${activeSection === "language" ? styles.active : ""}`}
          onClick={() => setActiveSection("language")}
        >
          <Globe size={15} />
          {t.settings.language}
        </button>
      </aside>

      <div className={styles.content}>
        {activeSection === "profile" && <ProfileSection />}
        {activeSection === "google" && <GoogleSection />}
        {activeSection === "location" && <LocationSection />}
        {activeSection === "family" && <UsersSection />}
        {activeSection === "shopping" && <ShoppingSection />}
        {activeSection === "language" && <LanguageSection />}
      </div>
    </div>
  )
}
