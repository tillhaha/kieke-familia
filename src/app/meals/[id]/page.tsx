// src/app/meals/[id]/page.tsx
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import { ChevronLeft, ImagePlus, Pencil, Trash2 } from "lucide-react"
import styles from "../meals.module.css"

type MealType = "Meal" | "Snack" | "Drink" | "Baked"

type Diet = "Vegetarian" | "Meat" | "Fish"

type Meal = {
  id: string
  name: string
  mealType: MealType
  diet: Diet
  notes: string | null
  servings: number
  officeFriendly: boolean
  thirtyMinute: boolean
  ingredients: string[]
  steps: string[]
  imageUrl: string | null
  source: string | null
}

type EditingField = "notes" | "ingredients" | "steps" | "source" | null

function isUrl(text: string): boolean {
  try { const u = new URL(text); return u.protocol === "http:" || u.protocol === "https:" } catch { return false }
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto"
  el.style.height = el.scrollHeight + "px"
}

export default function MealDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [meal, setMeal] = useState<Meal | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Editing state
  const [name, setName] = useState("")
  const [servings, setServings] = useState("")
  const [mealType, setMealType] = useState<MealType | "">("Meal")
  const [diet, setDiet] = useState<Diet>("Meat")
  const [officeFriendly, setOfficeFriendly] = useState(false)
  const [thirtyMinute, setThirtyMinute] = useState(false)
  const [editingField, setEditingField] = useState<EditingField>(null)
  const [draftNotes, setDraftNotes] = useState("")
  const [draftIngredients, setDraftIngredients] = useState("") // one per line
  const [draftSteps, setDraftSteps] = useState("")             // one per line
  const [draftSource, setDraftSource] = useState("")

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/meals/${id}`)
      .then((r) => { if (!r.ok) { setNotFound(true); return null } return r.json() })
      .then((d) => {
        if (!d) return
        setMeal(d.meal)
        setName(d.meal.name)
        setServings(String(d.meal.servings))
        setMealType(d.meal.mealType)
        setDiet(d.meal.diet)
        setOfficeFriendly(d.meal.officeFriendly)
        setThirtyMinute(d.meal.thirtyMinute)
        setDraftNotes(d.meal.notes ?? "")
        setDraftIngredients((d.meal.ingredients as string[]).join("\n"))
        setDraftSteps((d.meal.steps as string[]).join("\n"))
        setDraftSource(d.meal.source ?? "")
      })
      .finally(() => setLoading(false))
  }, [id])

  const patch = useCallback(async (updates: Record<string, unknown>) => {
    const res = await fetch(`/api/meals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error()
    const data = await res.json()
    setMeal(data.meal)
    return data.meal as Meal
  }, [id])

  const handleNameBlur = async () => {
    if (!meal || name.trim() === meal.name) return
    try { await patch({ name: name.trim() }) } catch { setName(meal.name) }
  }

  const handleServingsBlur = async () => {
    const parsed = parseInt(servings)
    if (!meal) return
    if (isNaN(parsed) || parsed < 1) { setServings(String(meal.servings)); return }
    if (parsed === meal.servings) return
    try { await patch({ servings: parsed }) } catch { setServings(String(meal.servings)) }
  }

  const handleMealTypeChange = async (value: MealType | "") => {
    if (!value) return
    setMealType(value)
    try { await patch({ mealType: value }) } catch { setMealType(meal!.mealType) }
  }

  const handleDietChange = async (value: Diet) => {
    setDiet(value)
    try { await patch({ diet: value }) } catch { setDiet(meal!.diet) }
  }

  const handleToggle = async (field: "officeFriendly" | "thirtyMinute", value: boolean) => {
    if (field === "officeFriendly") setOfficeFriendly(value)
    else setThirtyMinute(value)
    try { await patch({ [field]: value }) } catch {
      if (field === "officeFriendly") setOfficeFriendly(!value)
      else setThirtyMinute(!value)
    }
  }

  const handleSourceBlur = async () => {
    setEditingField(null)
    const val = draftSource.trim() || null
    if (!meal || val === meal.source) return
    try { await patch({ source: val }) } catch { setDraftSource(meal.source ?? "") }
  }

  const handleNotesBlur = async () => {
    setEditingField(null)
    if (!meal || draftNotes === (meal.notes ?? "")) return
    try {
      const updated = await patch({ notes: draftNotes || null })
      setDraftNotes(updated.notes ?? "")
    } catch { setDraftNotes(meal.notes ?? "") }
  }

  const handleIngredientsBlur = async () => {
    setEditingField(null)
    const arr = draftIngredients.split("\n").map((s) => s.trim()).filter(Boolean)
    if (!meal || JSON.stringify(arr) === JSON.stringify(meal.ingredients)) return
    try {
      const updated = await patch({ ingredients: arr })
      setMeal(updated)
      setDraftIngredients((updated.ingredients as string[]).join("\n"))
    } catch { setDraftIngredients((meal.ingredients as string[]).join("\n")) }
  }

  const handleStepsBlur = async () => {
    setEditingField(null)
    const arr = draftSteps.split("\n").map((s) => s.trim()).filter(Boolean)
    if (!meal || JSON.stringify(arr) === JSON.stringify(meal.steps)) return
    try {
      const updated = await patch({ steps: arr })
      setMeal(updated)
      setDraftSteps((updated.steps as string[]).join("\n"))
    } catch { setDraftSteps((meal.steps as string[]).join("\n")) }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await fetch(`/api/meals/${id}`, { method: "DELETE" })
      router.push("/meals")
    } catch { setDeleting(false); setConfirmDelete(false) }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageUploading(true)
    const form = new FormData()
    form.append("image", file)
    try {
      const res = await fetch(`/api/meals/${id}/image`, { method: "POST", body: form })
      const data = await res.json()
      if (res.ok) setMeal(data.meal)
    } finally {
      setImageUploading(false)
      e.target.value = ""
    }
  }

  const handleImageRemove = async () => {
    setImageUploading(true)
    try {
      const res = await fetch(`/api/meals/${id}/image`, { method: "DELETE" })
      const data = await res.json()
      if (res.ok) setMeal(data.meal)
    } finally {
      setImageUploading(false)
    }
  }

  if (loading) return null
  if (notFound) return <div className={styles.detailContainer}><p>Recipe not found.</p></div>
  if (!meal) return null

  return (
    <div className={styles.detailContainer}>
      <Link href="/meals" className={styles.backLink}>
        <ChevronLeft size={14} /> Recipes
      </Link>

      <div className={styles.detailHeader}>
        <input
          className={styles.titleInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
        />
        <button
          className={confirmDelete ? styles.deleteBtnConfirm : styles.deleteBtn}
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "Deleting…" : confirmDelete ? "Sure? Click to confirm" : "Delete"}
        </button>
      </div>

      {/* Image */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />
      <div className={styles.imageBlock}>
        {meal.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={meal.imageUrl} alt={meal.name} className={styles.recipeImage} />
            <div className={styles.imageActions}>
              <button className={styles.imageActionBtn} onClick={() => fileInputRef.current?.click()} disabled={imageUploading}>
                <Pencil size={11} /> Change
              </button>
              <button className={styles.imageActionBtn} onClick={handleImageRemove} disabled={imageUploading}>
                <Trash2 size={11} /> Remove
              </button>
            </div>
          </>
        ) : (
          <div className={styles.imagePlaceholder} onClick={() => fileInputRef.current?.click()}>
            <ImagePlus size={22} strokeWidth={1.5} />
            <span className={styles.imagePlaceholderText}>{imageUploading ? "Uploading…" : "Add a photo"}</span>
          </div>
        )}
      </div>

      {/* Type + Diet + Servings + Tags row */}
      <div className={styles.metaRow}>
        <div className={styles.metaField}>
          <span className={styles.metaLabel}>Type</span>
          <select
            className={styles.typeSelect}
            value={mealType}
            onChange={(e) => handleMealTypeChange(e.target.value as MealType | "")}
          >
            <option value="" disabled> </option>
            <option value="Meal">Meal</option>
            <option value="Snack">Snack</option>
            <option value="Drink">Drink</option>
            <option value="Baked">Baked</option>
          </select>
        </div>

        <div className={styles.metaField}>
          <span className={styles.metaLabel}>Diet</span>
          <select
            className={styles.typeSelect}
            value={diet}
            onChange={(e) => handleDietChange(e.target.value as Diet)}
          >
            <option value="Meat">Meat</option>
            <option value="Fish">Fish</option>
            <option value="Vegetarian">Vegetarian</option>
          </select>
        </div>

        <div className={styles.metaField}>
          <span className={styles.metaLabel}>Servings</span>
          <input
            type="text"
            inputMode="numeric"
            className={styles.servingsInput}
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            onBlur={handleServingsBlur}
          />
        </div>

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={officeFriendly}
            onChange={(e) => handleToggle("officeFriendly", e.target.checked)}
          />
          <span>Office</span>
        </label>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={thirtyMinute}
            onChange={(e) => handleToggle("thirtyMinute", e.target.checked)}
          />
          <span>Quick</span>
        </label>
      </div>

      {/* Notes */}
      <div className={styles.fieldSection}>
        <span className={styles.fieldLabel}>Notes</span>
        {editingField === "notes" ? (
          <textarea
            autoFocus
            className={styles.fieldTextarea}
            value={draftNotes}
            onChange={(e) => { setDraftNotes(e.target.value); autoResize(e.target) }}
            onBlur={handleNotesBlur}
            ref={(el) => { if (el) autoResize(el) }}
          />
        ) : (
          <div className={styles.editableField} onClick={() => setEditingField("notes")}>
            {draftNotes
              ? <div className={styles.markdown}><ReactMarkdown>{draftNotes}</ReactMarkdown></div>
              : <span style={{ color: "var(--secondary)", opacity: 0.5, fontSize: "0.875rem" }}>Click to add notes…</span>
            }
          </div>
        )}
      </div>

      {/* Source */}
      <div className={styles.fieldSection}>
        <span className={styles.fieldLabel}>Source</span>
        {editingField === "source" ? (
          <input
            autoFocus
            className={styles.sourceInput}
            value={draftSource}
            onChange={(e) => setDraftSource(e.target.value)}
            onBlur={handleSourceBlur}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
            placeholder="URL or book / person name"
          />
        ) : (
          <div className={styles.editableField} onClick={() => setEditingField("source")}>
            {draftSource
              ? isUrl(draftSource)
                ? <a href={draftSource} target="_blank" rel="noopener noreferrer" className={styles.sourceLink} onClick={(e) => e.stopPropagation()}>{draftSource}</a>
                : <span>{draftSource}</span>
              : <span style={{ color: "var(--secondary)", opacity: 0.5, fontSize: "0.875rem" }}>Click to add source…</span>
            }
          </div>
        )}
      </div>

      {/* Ingredients */}
      <div className={styles.fieldSection}>
        <span className={styles.fieldLabel}>Ingredients</span>
        {editingField === "ingredients" ? (
          <textarea
            autoFocus
            className={styles.fieldTextarea}
            value={draftIngredients}
            placeholder={"200g flour\n2 eggs"}
            onChange={(e) => { setDraftIngredients(e.target.value); autoResize(e.target) }}
            onBlur={handleIngredientsBlur}
            ref={(el) => { if (el) autoResize(el) }}
          />
        ) : (
          <div className={styles.editableField} onClick={() => setEditingField("ingredients")}>
            {meal.ingredients.length > 0
              ? <ul className={styles.markdown} style={{ paddingLeft: "1.25rem" }}>
                  {meal.ingredients.map((item, i) => (
                    <li key={i}><ReactMarkdown>{item}</ReactMarkdown></li>
                  ))}
                </ul>
              : <span style={{ color: "var(--secondary)", opacity: 0.5, fontSize: "0.875rem" }}>Click to add ingredients…</span>
            }
          </div>
        )}
      </div>

      {/* Steps */}
      <div className={styles.fieldSection}>
        <span className={styles.fieldLabel}>Preparation Steps</span>
        {editingField === "steps" ? (
          <textarea
            autoFocus
            className={styles.fieldTextarea}
            value={draftSteps}
            placeholder={"Mix flour and eggs.\nKnead for 10 min."}
            onChange={(e) => { setDraftSteps(e.target.value); autoResize(e.target) }}
            onBlur={handleStepsBlur}
            ref={(el) => { if (el) autoResize(el) }}
          />
        ) : (
          <div className={styles.editableField} onClick={() => setEditingField("steps")}>
            {meal.steps.length > 0
              ? <ol className={styles.markdown} style={{ paddingLeft: "1.25rem" }}>
                  {meal.steps.map((step, i) => (
                    <li key={i}><ReactMarkdown>{step}</ReactMarkdown></li>
                  ))}
                </ol>
              : <span style={{ color: "var(--secondary)", opacity: 0.5, fontSize: "0.875rem" }}>Click to add steps…</span>
            }
          </div>
        )}
      </div>
    </div>
  )
}
