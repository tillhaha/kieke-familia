// src/components/ui/Button.tsx
// The app's one button. Variants: primary (main action, max one per area),
// secondary (outlined), ghost (quiet), danger (destructive). Pass `href` to
// render a link that looks like a button.
import Link from "next/link"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import styles from "./Button.module.css"

type Variant = "primary" | "secondary" | "ghost" | "danger"
type Size = "sm" | "md"

type Common = {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  active?: boolean // toggled state, e.g. "Select" mode
  fullWidth?: boolean
  iconOnly?: boolean // round button with just an icon — pass aria-label
  className?: string
  children?: ReactNode
}

type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined }
type LinkProps = Common & { href: string; onClick?: () => void; title?: string }

export function buttonClass({ variant = "secondary", size = "md", active, fullWidth, iconOnly, className }: Common = {}) {
  return [
    styles.btn,
    styles[variant],
    styles[size],
    active ? styles.active : "",
    fullWidth ? styles.fullWidth : "",
    iconOnly ? styles.iconOnly : "",
    className ?? "",
  ].filter(Boolean).join(" ")
}

export function Button(props: ButtonProps | LinkProps) {
  const { variant, size, icon, active, fullWidth, iconOnly, className, children, ...rest } = props
  const cls = buttonClass({ variant, size, active, fullWidth, iconOnly, className })
  if (typeof rest.href === "string") {
    const { href, onClick, title } = rest as LinkProps
    return (
      <Link href={href} className={cls} onClick={onClick} title={title}>
        {icon}
        {children}
      </Link>
    )
  }
  const { type = "button", ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement>
  return (
    <button type={type} className={cls} {...buttonRest}>
      {icon}
      {children}
    </button>
  )
}
