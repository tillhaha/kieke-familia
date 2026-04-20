// src/components/Navbar.tsx
"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useRef, useEffect } from "react"
import { Bot, Calendar, CalendarDays, Settings, LogOut, UtensilsCrossed, ChevronDown, ShoppingCart, CheckSquare, X } from "lucide-react"
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

  const avatarLetter = (session?.user?.name || session?.user?.email || "?")[0].toUpperCase()

  return (
    <>
      <header className={styles.navbar}>
        <nav className={styles.inner}>
          <Link href="/" className={styles.logo}>
            <Bot size={17} strokeWidth={2.5} />
            <span>YourKieke</span>
          </Link>

          {session && (
            <div className={styles.navLinks}>
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

          {session && (
            <button
              className={styles.hamburger}
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
          )}
        </nav>
      </header>

      {/* Mobile full-screen menu overlay */}
      {session && menuOpen && (
        <div className={styles.mobileMenu}>
          <div className={styles.mobileMenuHeader}>
            <Link href="/" className={styles.logo} onClick={() => setMenuOpen(false)}>
              <Bot size={17} strokeWidth={2.5} />
              <span>YourKieke</span>
            </Link>
            <button
              className={styles.mobileMenuClose}
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            >
              <X size={22} strokeWidth={2} />
            </button>
          </div>

          <div className={styles.mobileMenuBody}>
            <div className={styles.mobileNavGroup}>
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`${styles.mobileNavItem} ${pathname === href ? styles.mobileNavItemActive : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon size={22} strokeWidth={1.75} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>

            <Link
              href="/settings"
              className={`${styles.mobileSettingsRow} ${pathname === "/settings" ? styles.mobileSettingsRowActive : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              <Settings size={22} strokeWidth={1.75} />
              <span>{t.nav.settings}</span>
            </Link>
          </div>

          <div className={styles.mobileMenuProfile}>
            <div className={styles.mobileProfileAvatar}>{avatarLetter}</div>
            <div className={styles.mobileProfileInfo}>
              <span className={styles.mobileProfileName}>
                {session.user?.name || session.user?.email}
              </span>
              <span className={styles.mobileProfileSignOutLabel}>{t.nav.signOut}</span>
            </div>
            <button
              className={styles.mobileSignOutBtn}
              onClick={() => signOut({ callbackUrl: "/" })}
              aria-label={t.nav.signOut}
            >
              <LogOut size={20} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
