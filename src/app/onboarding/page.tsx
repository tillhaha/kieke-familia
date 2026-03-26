// src/app/onboarding/page.tsx
"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Copy, Check } from "lucide-react"
import styles from "./page.module.css"

type Step = "choose" | "create" | "join" | "created"

export default function OnboardingPage() {
  const { update } = useSession()
  const router = useRouter()

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
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
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
        setError(data.error === "Invalid join code" ? "That code doesn't match any family. Check for typos." : (data.error ?? "Something went wrong"))
        return
      }
      await update({ familyId: data.family.id, role: "MEMBER" })
      router.push("/")
    } catch {
      setError("Something went wrong. Please try again.")
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
            <h1 className={styles.title}>Welcome to Familia</h1>
            <p className={styles.subtitle}>Do you want to create a new family or join an existing one?</p>
            <div className={styles.choices}>
              <button className={styles.choiceBtn} onClick={() => setStep("create")}>
                <span className={styles.choiceLabel}>Create a family</span>
                <span className={styles.choiceDesc}>Set up a new family space and invite members</span>
              </button>
              <button className={styles.choiceBtn} onClick={() => setStep("join")}>
                <span className={styles.choiceLabel}>Join a family</span>
                <span className={styles.choiceDesc}>Enter a join code shared by a family member</span>
              </button>
            </div>
          </>
        )}

        {step === "create" && (
          <>
            <button className={styles.back} onClick={() => { setStep("choose"); setError("") }}>← Back</button>
            <h1 className={styles.title}>Create your family</h1>
            <p className={styles.subtitle}>Give your family a name and set your home location.</p>
            <form onSubmit={handleCreate} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Family name <span className={styles.optional}>(optional)</span></label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. The Smiths"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Home city <span className={styles.optional}>(optional)</span></label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Berlin"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <p className={styles.hint}>Used for weather on the home screen.</p>
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button type="submit" disabled={loading} className={styles.primaryBtn}>
                {loading ? "Creating…" : "Create family"}
              </button>
            </form>
          </>
        )}

        {step === "join" && (
          <>
            <button className={styles.back} onClick={() => { setStep("choose"); setError("") }}>← Back</button>
            <h1 className={styles.title}>Join a family</h1>
            <p className={styles.subtitle}>Enter the 10-digit code shared with you by your family.</p>
            <form onSubmit={handleJoin} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Join code</label>
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
                {loading ? "Joining…" : "Join family"}
              </button>
            </form>
          </>
        )}

        {step === "created" && (
          <>
            <div className={styles.successIcon}>✓</div>
            <h1 className={styles.title}>{createdFamilyName} is ready</h1>
            <p className={styles.subtitle}>
              Share this code with your family members so they can join.
            </p>
            <div className={styles.codeBlock}>
              <span className={styles.generatedCode}>{generatedCode}</span>
              <button className={styles.copyBtn} onClick={copyCode} title="Copy code">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <p className={styles.codeHint}>
              Anyone with this code can join your family. You can also find it later in Settings.
            </p>
            <button className={styles.primaryBtn} onClick={() => router.push("/")}>
              Go to home →
            </button>
          </>
        )}

      </div>
    </div>
  )
}
