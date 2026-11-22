// src/components/ShareLinkButton.tsx
// Copies an absolute link to a page of the app (e.g. a recipe) for pasting into other tools.
// On touch devices with a share sheet it opens that instead; falls back to the clipboard.
"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Link2 } from "lucide-react"
import { Button } from "@/components/ui/Button"

type Props = {
  /** App path, e.g. "/meals/abc" */
  path: string
  /** Title for the share sheet */
  title?: string
  label: string
  copiedLabel: string
}

export function ShareLinkButton({ path, title, label, copiedLabel }: Props) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const share = async () => {
    const url = `${window.location.origin}${path}`
    const touch = window.matchMedia("(pointer: coarse)").matches
    if (touch && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url })
        return
      } catch (err) {
        // Closed the share sheet: done. Anything else: fall back to copying.
        if (err instanceof DOMException && err.name === "AbortError") return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard blocked (e.g. insecure context): let the user copy it by hand
      window.prompt(label, url)
      return
    }
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      icon={copied ? <Check size={16} /> : <Link2 size={16} />}
      onClick={share}
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : label}
    />
  )
}
