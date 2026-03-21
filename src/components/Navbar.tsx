// src/components/Navbar.tsx
"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useRef, useEffect } from "react"
import { Home, Calendar, CalendarDays, Settings, LogOut, UtensilsCrossed, ChevronDown, ShoppingCart } from "lucide-react"
import styles from "./navbar.module.css"

const navLinks = [
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/week", label: "Week Planner", icon: CalendarDays },
  { href: "/meals", label: "Recipes", icon: UtensilsCrossed },
  { href: "/shopping", label: "Shopping", icon: ShoppingCart },
]

export function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  return (
    <header className={styles.navbar}>
      <nav className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <Home size={17} strokeWidth={2.5} />
          <span>Familia</span>
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
                  Settings
                </Link>
                <button
                  className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                  onClick={() => signOut()}
                >
                  <LogOut size={13} strokeWidth={2} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  )
}
