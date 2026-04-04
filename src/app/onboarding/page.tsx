// src/app/onboarding/page.tsx
"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Copy, Check } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./page.module.css"

type Step = "choose" | "create" | "join" | "created"

export default function OnboardingPage() {
  const { update } = useSession()
  const router = useRouter()
  const { t } = useTranslation()

  const [step, setStep] = useState<Step>("choose")
  const [familyName, setFamilyName] = useState("")
  const [city, setCity] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [generatedCode, setGeneratedCode] = useState("")
  const [createdFamilyName, setCreatedFamilyName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/family/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: familyName, city }),
      })
      let data: Record<string, unknown>
      try {
        data = await res.json()
      } catch {
        setError(`Server error (${res.status} ${res.statusText})`)
        return
      }
      if (!res.ok) {
        setError((data.error as string) ?? `Error ${res.status}`)
        return
      }
      setGeneratedCode(data.family ? (data.family as Record<string, unknown>).joinCode as string : "")
      setCreatedFamilyName(data.family ? (data.family as Record<string, unknown>).name as string : "")
      await update({ familyId: data.family ? (data.family as Record<string, unknown>).id : undefined, role: "ADMIN" })
      setStep("created")
    } catch (err) {
      setError(err instanceof Error ? err.message : t.onboarding.errorGeneric)
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/family/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error === "Invalid join code" ? t.onboarding.errorInvalidCode : (data.error ?? t.onboarding.errorGeneric))
        return
      }
      await update({ familyId: data.family.id, role: "MEMBER" })
      router.push("/")
    } catch {
      setError(t.onboarding.errorGeneric)
    } finally {
      setLoading(false)
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(generatedCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {step === "choose" && (
          <>
            <h1 className={styles.title}>{t.onboarding.welcomeTitle}</h1>
            <p className={styles.subtitle}>{t.onboarding.welcomeSubtitle}</p>
            <div className={styles.choices}>
              <button className={styles.choiceBtn} onClick={() => setStep("create")}>
                <span className={styles.choiceLabel}>{t.onboarding.createFamilyLabel}</span>
                <span className={styles.choiceDesc}>{t.onboarding.createFamilyDesc}</span>
              </button>
              <button className={styles.choiceBtn} onClick={() => setStep("join")}>
                <span className={styles.choiceLabel}>{t.onboarding.joinFamilyLabel}</span>
                <span className={styles.choiceDesc}>{t.onboarding.joinFamilyDesc}</span>
              </button>
            </div>
          </>
        )}

        {step === "create" && (
          <>
            <button className={styles.back} onClick={() => { setStep("choose"); setError("") }}>{t.onboarding.back}</button>
            <h1 className={styles.title}>{t.onboarding.createTitle}</h1>
            <p className={styles.subtitle}>{t.onboarding.createSubtitle}</p>
            <form onSubmit={handleCreate} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>{t.onboarding.familyNameLabel} <span className={styles.optional}>{t.onboarding.optional}</span></label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder={t.onboarding.familyNamePlaceholder}
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t.onboarding.homeCityLabel} <span className={styles.optional}>{t.onboarding.optional}</span></label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder={t.onboarding.cityPlaceholder}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <p className={styles.hint}>{t.onboarding.cityHint}</p>
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button type="submit" disabled={loading} className={styles.primaryBtn}>
                {loading ? t.onboarding.creating : t.onboarding.createButton}
              </button>
            </form>
          </>
        )}

        {step === "join" && (
          <>
            <button className={styles.back} onClick={() => { setStep("choose"); setError("") }}>{t.onboarding.back}</button>
            <h1 className={styles.title}>{t.onboarding.joinTitle}</h1>
            <p className={styles.subtitle}>{t.onboarding.joinSubtitle}</p>
            <form onSubmit={handleJoin} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>{t.onboarding.joinCodeLabel}</label>
                <input
                  type="text"
                  className={`${styles.input} ${styles.codeInput}`}
                  placeholder="0000000000"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  maxLength={10}
                  inputMode="numeric"
                  autoFocus
                />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button type="submit" disabled={loading || joinCode.length !== 10} className={styles.primaryBtn}>
                {loading ? t.onboarding.joining : t.onboarding.joinButton}
              </button>
            </form>
          </>
        )}

        {step === "created" && (
          <>
            <div className={styles.successIcon}>✓</div>
            <h1 className={styles.title}>{createdFamilyName} {t.onboarding.isReady}</h1>
            <p className={styles.subtitle}>{t.onboarding.shareCodeSubtitle}</p>
            <div className={styles.codeBlock}>
              <span className={styles.generatedCode}>{generatedCode}</span>
              <button className={styles.copyBtn} onClick={copyCode} title={t.settings.copyCode}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <p className={styles.codeHint}>{t.onboarding.codeHint}</p>
            <button className={styles.primaryBtn} onClick={() => router.push("/")}>
              {t.onboarding.goHome}
            </button>
          </>
        )}

      </div>
    </div>
  )
}
