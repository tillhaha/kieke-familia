"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Sparkles, X, ImagePlus } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "../meals.module.css"

export default function NewMealPage() {
  const router = useRouter()
  const { t } = useTranslation()

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
        <ChevronLeft size={14} /> {t.meals.backLink}
      </Link>

      <div className={styles.detailHeader}>
        <h1 className={styles.pageTitle}>{t.meals.newRecipe}</h1>
        <button type="button" className={styles.aiImportBtn} onClick={() => setModalOpen(true)}>
          <Sparkles size={13} />
          {t.meals.aiImport}
        </button>
      </div>

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
            <span className={styles.imagePlaceholderText}>{t.meals.addPhoto}</span>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageFile} />

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="name" className={styles.formLabel}>{t.meals.nameLabel}</label>
          <input id="name" className={styles.formInput} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className={styles.metaRow}>
          <div className={styles.metaField}>
            <span className={styles.metaLabel}>{t.meals.typeLabel}</span>
            <select id="type" className={styles.typeSelect} value={mealType} onChange={(e) => setMealType(e.target.value)}>
              <option value="" disabled> </option>
              <option value="Meal">{t.meals.typeMeal}</option>
              <option value="Snack">{t.meals.typeSnack}</option>
              <option value="Drink">{t.meals.typeDrink}</option>
              <option value="Baked">{t.meals.typeBaked}</option>
            </select>
          </div>

          <div className={styles.metaField}>
            <span className={styles.metaLabel}>{t.meals.dietLabel}</span>
            <select id="diet" className={styles.typeSelect} value={diet} onChange={(e) => setDiet(e.target.value)}>
              <option value="" disabled> </option>
              <option value="Meat">{t.meals.dietMeat}</option>
              <option value="Fish">{t.meals.dietFish}</option>
              <option value="Vegetarian">{t.meals.dietVegetarian}</option>
            </select>
          </div>

          <div className={styles.metaField}>
            <span className={styles.metaLabel}>{t.meals.servingsLabel}</span>
            <input id="servings" type="text" inputMode="numeric" className={styles.servingsInput} value={servings} onChange={(e) => setServings(e.target.value)} placeholder="—" />
          </div>

          <label className={styles.toggle}>
            <input type="checkbox" checked={officeFriendly} onChange={(e) => setOfficeFriendly(e.target.checked)} />
            <span>{t.meals.officeLabel}</span>
          </label>
          <label className={styles.toggle}>
            <input type="checkbox" checked={thirtyMinute} onChange={(e) => setThirtyMinute(e.target.checked)} />
            <span>{t.meals.quickLabel}</span>
          </label>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="notes" className={styles.formLabel}>{t.meals.notesLabel}</label>
          <textarea id="notes" className={styles.formTextarea} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.meals.notesPlaceholder} />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="source" className={styles.formLabel}>{t.meals.sourceLabel}</label>
          <input id="source" className={styles.formInput} value={source} onChange={(e) => setSource(e.target.value)} placeholder={t.meals.sourcePlaceholder} />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="ingredients" className={styles.formLabel}>{t.meals.ingredientsLabel}</label>
          <textarea id="ingredients" className={styles.formTextarea} value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder={"200g flour\n2 eggs\n1 tsp salt"} />
          <span className={styles.formHint}>{t.meals.ingredientsHint}</span>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="steps" className={styles.formLabel}>{t.meals.stepsLabel}</label>
          <textarea id="steps" className={styles.formTextarea} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={"Mix the flour and eggs.\nAdd salt and knead for 10 minutes."} />
          <span className={styles.formHint}>{t.meals.stepsHint}</span>
        </div>

        {error && <p className={styles.errorMsg}>{error}</p>}

        <button type="submit" className={styles.saveBtn} disabled={saving || !name.trim()}>
          {saving ? t.meals.savingRecipe : t.meals.saveRecipe}
        </button>
      </form>

      {modalOpen && (
        <div className={styles.modalBackdrop} onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{t.meals.aiImport}</span>
              <button type="button" className={styles.modalCloseBtn} onClick={() => setModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <textarea
              ref={textareaRef}
              className={styles.modalTextarea}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={t.meals.insertRecipeOrUrl}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleParse() }}
            />

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.parseBtn}
                onClick={handleParse}
                disabled={parsing || !importText.trim()}
              >
                {parsing ? t.meals.importing : t.meals.import}
              </button>
              {parseError && <span className={styles.parseError}>{parseError}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
