// src/app/settings/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState } from "react"
import { User, CalendarDays, Download, Home, ShoppingCart, Globe, Palette, ChevronRight, ArrowLeft } from "lucide-react"
import { GoogleCalendarSync } from "./GoogleCalendarSync"
import { ImportedCalendarsSection } from "./ImportedCalendarsSection"
import { ProfileSection } from "./ProfileSection"
import { LocationSection } from "./LocationSection"
import { UsersSection } from "./UsersSection"
import { ShoppingSection } from "./ShoppingSection"
import { LanguageSection } from "./LanguageSection"
import { AppearanceSection } from "./AppearanceSection"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import { useTheme } from "@/lib/theme/ThemeContext"
import styles from "./settings.module.css"

type Section = "profile" | "import" | "family" | "shopping" | "language" | "appearance"

const SECTION_COLORS: Record<Section, string> = {
  profile:    "#3EC6C6",
  import:     "#7C6FE0",
  family:     "#F4A261",
  shopping:   "#45B88A",
  language:   "#5BA4F5",
  appearance: "#A29BFE",
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const [activeSection, setActiveSection] = useState<Section>("profile")
  const [mobileView, setMobileView] = useState<"index" | "detail">("index")
  const { t, lang } = useTranslation()
  const { theme } = useTheme()

  if (status === "loading") return null

  const themeLabel = theme === "light" ? t.settings.themeLight
    : theme === "dark" ? t.settings.themeDark
    : t.settings.themeSystem

  const langLabel = lang === "de" ? "Deutsch" : lang === "es" ? "Español" : "English"

  const sections: { id: Section; icon: React.ReactNode; label: string; status?: string }[] = [
    { id: "profile",    icon: <User size={18} strokeWidth={1.75} />,     label: t.settings.profile,       status: session?.user?.name ?? undefined },
    { id: "import",     icon: <Download size={18} strokeWidth={1.75} />, label: t.settings.calendarImport },
    { id: "family",     icon: <Home size={18} strokeWidth={1.75} />,     label: t.settings.family },
    { id: "shopping",   icon: <ShoppingCart size={18} strokeWidth={1.75} />, label: t.settings.shopping },
    { id: "language",   icon: <Globe size={18} strokeWidth={1.75} />,    label: t.settings.language,      status: langLabel },
    { id: "appearance", icon: <Palette size={18} strokeWidth={1.75} />,  label: t.settings.appearance,    status: themeLabel },
  ]

  const handleMobileSelect = (section: Section) => {
    setActiveSection(section)
    setMobileView("detail")
  }

  return (
    <div className={styles.container}>
      {/* Desktop sidebar */}
      <aside className={styles.sidebar}>
        <p className={styles.sidebarTitle}>{t.settings.title}</p>
        {sections.map(({ id, icon, label }) => (
          <button
            key={id}
            className={`${styles.sectionBtn} ${activeSection === id ? styles.active : ""}`}
            onClick={() => setActiveSection(id)}
          >
            {icon}
            {label}
          </button>
        ))}
      </aside>

      <div className={styles.content}>
        {/* Mobile: index list */}
        <div className={`${styles.mobileIndex} ${mobileView === "detail" ? styles.mobileIndexHidden : ""}`}>
          <h1 className={styles.mobileIndexTitle}>{t.settings.title}</h1>
          <div className={styles.mobileIndexList}>
            {sections.map(({ id, icon, label, status }) => (
              <button key={id} className={styles.mobileIndexRow} onClick={() => handleMobileSelect(id)}>
                <span className={styles.mobileAvatar} style={{ background: SECTION_COLORS[id] }}>
                  {icon}
                </span>
                <span className={styles.mobileIndexLabel}>{label}</span>
                {status && <span className={styles.mobileIndexStatus}>{status}</span>}
                <ChevronRight size={16} className={styles.mobileChevron} />
              </button>
            ))}
          </div>
        </div>

        {/* Mobile: back button in detail view */}
        {mobileView === "detail" && (
          <button className={styles.mobileBackBtn} onClick={() => setMobileView("index")}>
            <ArrowLeft size={16} />
            {t.settings.title}
          </button>
        )}

        {/* Section content (hidden on mobile when showing index) */}
        <div className={mobileView === "index" ? styles.mobileContentHidden : ""}>
          {activeSection === "profile" && (
            <>
              <ProfileSection />
              <GoogleCalendarSync />
            </>
          )}
          {activeSection === "import"     && <ImportedCalendarsSection />}
          {activeSection === "family" && (
            <>
              <UsersSection />
              <LocationSection />
            </>
          )}
          {activeSection === "shopping"   && <ShoppingSection />}
          {activeSection === "language"   && <LanguageSection />}
          {activeSection === "appearance" && <AppearanceSection />}
        </div>
      </div>
    </div>
  )
}
