// src/components/ui/PageHeader.tsx
// Consistent page header: title on the left (optionally followed by a small
// addon like an icon), actions always aligned top right.
import type { ReactNode } from "react"
import styles from "./PageHeader.module.css"

export function PageHeader({ title, addon, actions }: { title: ReactNode; addon?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={styles.header}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{title}</h1>
        {addon}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
