// src/components/ui/FilterPill.tsx
// Toggle chip for filter bars (All / category / tag …), with optional count.
import type { ButtonHTMLAttributes, ReactNode } from "react"
import styles from "./FilterPill.module.css"

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
  count?: number
  icon?: ReactNode
  highlight?: boolean // e.g. drop target while dragging
}

export function FilterPill({ active, count, icon, highlight, className, children, type = "button", ...rest }: Props) {
  const cls = [styles.pill, active ? styles.active : "", highlight ? styles.highlight : "", className ?? ""].filter(Boolean).join(" ")
  return (
    <button type={type} className={cls} {...rest}>
      {icon}
      {children}
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </button>
  )
}
