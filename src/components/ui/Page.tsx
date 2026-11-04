// src/components/ui/Page.tsx
// Standard page container. Two widths only:
//   narrow (720px) — lists, forms, recipes, text pages
//   wide (1200px)  — dashboards, week planner, calendar, settings; aligns with navbar/footer
// Same padding and vertical rhythm on every page; children are spaced with `gap`.
import type { ReactNode } from "react"
import styles from "./Page.module.css"

export function Page({ width = "narrow", className, children }: { width?: "narrow" | "wide"; className?: string; children: ReactNode }) {
  return <div className={[styles.page, styles[width], className ?? ""].filter(Boolean).join(" ")}>{children}</div>
}
