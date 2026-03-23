// src/components/Footer.tsx

import Link from "next/link"
import styles from "./footer.module.css"

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.copy}>© {new Date().getFullYear()} YourKieke</span>
        <div className={styles.links}>
          <Link href="/imprint" className={styles.link}>Impressum</Link>
          <Link href="/privacy" className={styles.link}>Datenschutz</Link>
        </div>
      </div>
    </footer>
  )
}
