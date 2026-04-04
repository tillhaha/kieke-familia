// src/components/Navbar.tsx
"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useRef, useEffect } from "react"
import { Bot, Calendar, CalendarDays, Settings, LogOut, UtensilsCrossed, ChevronDown, ShoppingCart, CheckSquare } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./navbar.module.css"

export function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  const navLinks = [
    { href: "/calendar", label: t.nav.calendar, icon: Calendar },
    { href: "/week", label: t.nav.weekPlanner, icon: CalendarDays },
    { href: "/meals", label: t.nav.recipes, icon: UtensilsCrossed },
    { href: "/shopping", label: t.nav.shopping, icon: ShoppingCart },
    { href: "/tasks", label: t.nav.tasks, icon: CheckSquare },
  ]

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false)
  }, [pathname])

  return (
    <header className={styles.navbar}>
      <nav className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <Bot size={17} strokeWidth={2.5} />
          <span>YourKieke</span>
        </Link>

        {session && (
          <button
            className={styles.hamburger}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        )}

        {session && (
          <div className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ""}`}>
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`${styles.navLink} ${pathname === href ? styles.active : ""}`}
              >
                <Icon size={14} />
                {label}
              </Link>
            ))}
          </div>
        )}

        {session && (
          <div className={styles.userSection} ref={ref}>
            <button
              className={styles.userBtn}
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={open}
            >
              <span className={styles.userName}>
                {session.user?.name || session.user?.email}
              </span>
              <ChevronDown size={13} strokeWidth={2} className={open ? styles.chevronOpen : ""} />
            </button>

            {open && (
              <div className={styles.dropdown}>
                <Link
                  href="/settings"
                  className={styles.dropdownItem}
                  onClick={() => setOpen(false)}
                >
                  <Settings size={13} strokeWidth={2} />
                  {t.nav.settings}
                </Link>
                <button
                  className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  <LogOut size={13} strokeWidth={2} />
                  {t.nav.signOut}
                </button>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Backdrop — only rendered on mobile when drawer is open */}
      {menuOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </header>
  )
}
