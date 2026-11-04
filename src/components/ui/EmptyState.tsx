// src/components/ui/EmptyState.tsx
// Friendly placeholder for empty lists: icon, message, optional action.
import type { ReactNode } from "react"
import styles from "./EmptyState.module.css"

export function EmptyState({ icon, children, action }: { icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.empty}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <p className={styles.text}>{children}</p>
      {action}
    </div>
  )
}
