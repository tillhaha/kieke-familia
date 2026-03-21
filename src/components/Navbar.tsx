// src/components/Navbar.tsx
"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Calendar, CalendarDays, Briefcase, Settings, LogOut, UtensilsCrossed } from "lucide-react"
import styles from "./navbar.module.css"

const navLinks = [
  { href: "/calendar", label: "Calendar", icon: Calendar, enabled: true },
  { href: "/week", label: "Week planning", icon: CalendarDays, enabled: true },
  { href: "/meals", label: "Meals", icon: UtensilsCrossed, enabled: true },
  { href: "/work", label: "Work", icon: Briefcase, enabled: false },
  { href: "/settings", label: "Settings", icon: Settings, enabled: true },
]

export function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()

  return (
    <header className={styles.navbar}>
      <nav className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <Home size={17} strokeWidth={2.5} />
          <span>Familia</span>
        </Link>

        {session && (
          <div className={styles.navLinks}>
            {navLinks.map(({ href, label, icon: Icon, enabled }) =>
              enabled ? (
                <Link
                  key={href}
                  href={href}
                  className={`${styles.navLink} ${pathname === href ? styles.active : ""}`}
                >
                  <Icon size={14} />
                  {label}
                </Link>
              ) : (
                <span key={href} className={styles.navLinkDisabled}>
                  <Icon size={14} />
                  {label}
                </span>
              )
            )}
          </div>
        )}

        {session && (
          <div className={styles.userSection}>
            <span className={styles.userEmail}>{session.user?.email}</span>
            <button
              onClick={() => signOut()}
              className={styles.signOutBtn}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </nav>
    </header>
  )
}
