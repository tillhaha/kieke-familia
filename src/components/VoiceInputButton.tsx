// src/components/VoiceInputButton.tsx
// Mic button that dictates into a text field via the browser's Web Speech API
// (Chrome/Edge/Safari; Chrome sends audio to Google, Safari to Apple for
// recognition). Renders nothing where the API is missing (e.g. Firefox).
// Recognised text is appended to the value the field had when dictation began.
"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Mic } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./VoiceInputButton.module.css"

// Minimal typings — SpeechRecognition is not part of TypeScript's DOM lib.
type RecognitionResultList = ArrayLike<{ 0: { transcript: string } }>
type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { results: RecognitionResultList }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const noopSubscribe = () => () => {}

const SPEECH_LANG = { de: "de-DE", en: "en-US", es: "es-ES" } as const

type Props = {
  value: string
  onChange: (value: string) => void
  onError?: (message: string) => void
  disabled?: boolean
  maxLength?: number
}

export function VoiceInputButton({ value, onChange, onError, disabled, maxLength }: Props) {
  const { t, lang } = useTranslation()
  const tt = t.thoughts
  const supported = useSyncExternalStore(noopSubscribe, () => getCtor() !== null, () => false)
  const [listening, setListening] = useState(false)
  const recRef = useRef<Recognition | null>(null)
  // Latest props for the recognition callbacks, which outlive a render
  const latest = useRef({ value, onChange, onError, maxLength, tt })
  useEffect(() => {
    latest.current = { value, onChange, onError, maxLength, tt }
  })

  // Stop when the field gets disabled (e.g. while sending) and on unmount
  useEffect(() => {
    if (disabled) recRef.current?.abort()
  }, [disabled])
  useEffect(() => () => recRef.current?.abort(), [])

  if (!supported) return null

  function start() {
    const Ctor = getCtor()
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = SPEECH_LANG[lang as keyof typeof SPEECH_LANG] ?? "en-US"
    // Android Chrome repeats earlier phrases in continuous mode, so there one
    // tap = one utterance; elsewhere keep listening until tapped again.
    rec.continuous = !/Android/i.test(navigator.userAgent)
    rec.interimResults = true

    const base = latest.current.value
    const prefix = base && !/\s$/.test(base) ? base + " " : base

    rec.onresult = (e) => {
      let spoken = ""
      for (let i = 0; i < e.results.length; i++) spoken += e.results[i][0].transcript
      let next = prefix + spoken.trimStart()
      const max = latest.current.maxLength
      if (max) next = next.slice(0, max)
      latest.current.onChange(next)
    }
    rec.onerror = (e) => {
      // "aborted" = we stopped it, "no-speech" = silence; neither is worth a message
      if (e.error === "aborted" || e.error === "no-speech") return
      const msg = e.error === "not-allowed" || e.error === "service-not-allowed"
        ? latest.current.tt.voiceDenied
        : latest.current.tt.voiceFailed
      latest.current.onError?.(msg)
    }
    rec.onend = () => {
      if (recRef.current === rec) recRef.current = null
      setListening(false)
    }

    recRef.current = rec
    try {
      rec.start()
      setListening(true)
      latest.current.onError?.("")
    } catch {
      recRef.current = null
      latest.current.onError?.(tt.voiceFailed)
    }
  }

  function toggle() {
    if (listening) recRef.current?.stop()
    else start()
  }

  const label = listening ? tt.voiceStop : tt.voiceStart
  return (
    <Button
      iconOnly
      variant={listening ? "danger" : "secondary"}
      active={listening}
      className={listening ? styles.listening : undefined}
      icon={<Mic size={16} strokeWidth={2.25} />}
      onClick={toggle}
      disabled={disabled}
      aria-label={label}
      aria-pressed={listening}
      title={label}
    />
  )
}
