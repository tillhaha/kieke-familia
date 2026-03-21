// src/app/meals/[id]/page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import { ChevronLeft } from "lucide-react"
import styles from "../meals.module.css"

type Meal = {
  id: string
  name: string
  description: string | null
  servings: number
  ingredients: string[]
  steps: string[]
}

type EditingField = "description" | "ingredients" | "steps" | null

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
  const [servings, setServings] = useState(2)
  const [editingField, setEditingField] = useState<EditingField>(null)
  const [draftDescription, setDraftDescription] = useState("")
  const [draftIngredients, setDraftIngredients] = useState("") // one per line
  const [draftSteps, setDraftSteps] = useState("")             // one per line

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/meals/${id}`)
      .then((r) => { if (!r.ok) { setNotFound(true); return null } return r.json() })
      .then((d) => {
        if (!d) return
        setMeal(d.meal)
        setName(d.meal.name)
        setServings(d.meal.servings)
        setDraftDescription(d.meal.description ?? "")
        setDraftIngredients((d.meal.ingredients as string[]).join("\n"))
        setDraftSteps((d.meal.steps as string[]).join("\n"))
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
    if (!meal || servings === meal.servings) return
    try { await patch({ servings }) } catch { setServings(meal.servings) }
  }

  const handleDescriptionBlur = async () => {
    setEditingField(null)
    if (!meal || draftDescription === (meal.description ?? "")) return
    try {
      const updated = await patch({ description: draftDescription || null })
      setDraftDescription(updated.description ?? "")
    } catch { setDraftDescription(meal.description ?? "") }
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

  if (loading) return null
  if (notFound) return <div className={styles.detailContainer}><p>Recipe not found.</p></div>
  if (!meal) return null

  return (
    <div className={styles.detailContainer}>
      <Link href="/meals" className={styles.backLink}>
        <ChevronLeft size={14} /> Meals
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

      {/* Servings */}
      <div className={styles.fieldSection}>
        <span className={styles.fieldLabel}>Servings</span>
        <div className={styles.servingsRow}>
          <input
            type="number"
            min={1}
            className={styles.servingsInput}
            value={servings}
            onChange={(e) => setServings(parseInt(e.target.value) || 1)}
            onBlur={handleServingsBlur}
          />
          <span style={{ fontSize: "0.875rem", color: "var(--secondary)" }}>people</span>
        </div>
      </div>

      {/* Description */}
      <div className={styles.fieldSection}>
        <span className={styles.fieldLabel}>Description</span>
        {editingField === "description" ? (
          <textarea
            autoFocus
            className={styles.fieldTextarea}
            value={draftDescription}
            onChange={(e) => { setDraftDescription(e.target.value); autoResize(e.target) }}
            onBlur={handleDescriptionBlur}
            ref={(el) => { if (el) autoResize(el) }}
          />
        ) : (
          <div className={styles.editableField} onClick={() => setEditingField("description")}>
            {draftDescription
              ? <div className={styles.markdown}><ReactMarkdown>{draftDescription}</ReactMarkdown></div>
              : <span style={{ color: "var(--secondary)", opacity: 0.5, fontSize: "0.875rem" }}>Click to add description…</span>
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
