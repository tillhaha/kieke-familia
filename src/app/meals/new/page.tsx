"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Sparkles, X, ImagePlus } from "lucide-react"
import styles from "../meals.module.css"

export default function NewMealPage() {
  const router = useRouter()

  // Form fields
  const [name, setName] = useState("")
  const [notes, setNotes] = useState("")
  const [servings, setServings] = useState("")
  const [mealType, setMealType] = useState("")
  const [diet, setDiet] = useState("")
  const [officeFriendly, setOfficeFriendly] = useState(false)
  const [thirtyMinute, setThirtyMinute] = useState(false)
  const [ingredients, setIngredients] = useState("")
  const [steps, setSteps] = useState("")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [source, setSource] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // AI Import modal
  const [modalOpen, setModalOpen] = useState(false)
  const [importText, setImportText] = useState("")
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => textareaRef.current?.focus(), 50)
    } else {
      setParseError(null)
    }
  }, [modalOpen])

  useEffect(() => {
    if (!modalOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModalOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [modalOpen])

  const handleParse = async () => {
    if (!importText.trim() || parsing) return
    setParsing(true)
    setParseError(null)

    try {
      const res = await fetch("/api/meals/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: importText }),
      })
      const data = await res.json()
      if (!res.ok) { setParseError(data.error ?? "Failed to parse recipe."); return }

      const r = data.recipe
      setName(r.name ?? "")
      setMealType(r.mealType ?? "")
      setServings(String(r.servings ?? 2))
      setDiet(r.diet ?? "Meat")
      setOfficeFriendly(r.officeFriendly ?? false)
      setThirtyMinute(r.thirtyMinute ?? false)
      setIngredients((r.ingredients ?? []).join("\n"))
      setSteps((r.steps ?? []).join("\n"))
      setNotes(r.notes ?? "")
      setImageUrl(r.imageUrl ?? null)
      setSource(r.source ?? "")
      setImportText("")
      setModalOpen(false)
    } catch {
      setParseError("Failed to parse recipe.")
    } finally {
      setParsing(false)
    }
  }

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setImageUrl(objectUrl)
    // store file reference for upload after save
    ;(handleImageFile as any)._file = file
    e.target.value = ""
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    setError(null)

    const ingredientsArr = ingredients.split("\n").map((s) => s.trim()).filter(Boolean)
    const stepsArr = steps.split("\n").map((s) => s.trim()).filter(Boolean)

    // Only include imageUrl if it's an external URL (local blob URLs can't be stored)
    const savedImageUrl = imageUrl?.startsWith("http") ? imageUrl : null

    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mealType, diet, notes: notes || null, servings: parseInt(servings) || 2, officeFriendly, thirtyMinute, ingredients: ingredientsArr, steps: stepsArr, imageUrl: savedImageUrl, source: source.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to create recipe."); return }

      const mealId = data.meal.id

      // Upload local image file if one was selected
      const pendingFile = (handleImageFile as any)._file as File | undefined
      if (pendingFile && mealId) {
        const form = new FormData()
        form.append("image", pendingFile)
        await fetch(`/api/meals/${mealId}/image`, { method: "POST", body: form }).catch(() => {})
      }

      router.push("/meals")
    } catch {
      setError("Failed to create recipe.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.detailContainer}>
      <Link href="/meals" className={styles.backLink}>
        <ChevronLeft size={14} /> Recipes
      </Link>

      <div className={styles.detailHeader}>
        <h1 className={styles.pageTitle}>New Recipe</h1>
        <button type="button" className={styles.aiImportBtn} onClick={() => setModalOpen(true)}>
          <Sparkles size={13} />
          AI Import
        </button>
      </div>

      {/* Image preview */}
      {imageUrl ? (
        <div className={styles.imagePreview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Recipe" className={styles.imagePreviewImg} />
          <button type="button" className={styles.imagePreviewRemove} onClick={() => { setImageUrl(null); (handleImageFile as any)._file = undefined }}>
            <X size={13} />
          </button>
        </div>
      ) : (
        <div className={styles.imageBlock}>
          <div className={styles.imagePlaceholder} onClick={() => fileInputRef.current?.click()}>
            <ImagePlus size={22} strokeWidth={1.5} />
            <span className={styles.imagePlaceholderText}>Add a photo</span>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageFile} />

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="name" className={styles.formLabel}>Name *</label>
          <input id="name" className={styles.formInput} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className={styles.metaRow}>
          <div className={styles.metaField}>
            <span className={styles.metaLabel}>Type</span>
            <select id="type" className={styles.typeSelect} value={mealType} onChange={(e) => setMealType(e.target.value)}>
              <option value="" disabled> </option>
              <option value="Meal">Meal</option>
              <option value="Snack">Snack</option>
              <option value="Drink">Drink</option>
              <option value="Baked">Baked</option>
            </select>
          </div>

          <div className={styles.metaField}>
            <span className={styles.metaLabel}>Diet</span>
            <select id="diet" className={styles.typeSelect} value={diet} onChange={(e) => setDiet(e.target.value)}>
              <option value="" disabled> </option>
              <option value="Meat">Meat</option>
              <option value="Fish">Fish</option>
              <option value="Vegetarian">Vegetarian</option>
            </select>
          </div>

          <div className={styles.metaField}>
            <span className={styles.metaLabel}>Servings</span>
            <input id="servings" type="text" inputMode="numeric" className={styles.servingsInput} value={servings} onChange={(e) => setServings(e.target.value)} placeholder="—" />
          </div>

          <label className={styles.toggle}>
            <input type="checkbox" checked={officeFriendly} onChange={(e) => setOfficeFriendly(e.target.checked)} />
            <span>Office</span>
          </label>
          <label className={styles.toggle}>
            <input type="checkbox" checked={thirtyMinute} onChange={(e) => setThirtyMinute(e.target.checked)} />
            <span>Quick</span>
          </label>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="notes" className={styles.formLabel}>Notes</label>
          <textarea id="notes" className={styles.formTextarea} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes…" />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="source" className={styles.formLabel}>Source</label>
          <input id="source" className={styles.formInput} value={source} onChange={(e) => setSource(e.target.value)} placeholder="URL or book / person name" />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="ingredients" className={styles.formLabel}>Ingredients</label>
          <textarea id="ingredients" className={styles.formTextarea} value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder={"200g flour\n2 eggs\n1 tsp salt"} />
          <span className={styles.formHint}>One ingredient per line.</span>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="steps" className={styles.formLabel}>Steps</label>
          <textarea id="steps" className={styles.formTextarea} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={"Mix the flour and eggs.\nAdd salt and knead for 10 minutes."} />
          <span className={styles.formHint}>One step per line.</span>
        </div>

        {error && <p className={styles.errorMsg}>{error}</p>}

        <button type="submit" className={styles.saveBtn} disabled={saving || !name.trim()}>
          {saving ? "Saving…" : "Save Recipe"}
        </button>
      </form>

      {modalOpen && (
        <div className={styles.modalBackdrop} onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>AI Import</span>
              <button type="button" className={styles.modalCloseBtn} onClick={() => setModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <textarea
              ref={textareaRef}
              className={styles.modalTextarea}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Insert recipe or URL here"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleParse() }}
            />

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.parseBtn}
                onClick={handleParse}
                disabled={parsing || !importText.trim()}
              >
                {parsing ? "Importing…" : "Import"}
              </button>
              {parseError && <span className={styles.parseError}>{parseError}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
