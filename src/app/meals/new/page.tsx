"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import styles from "../meals.module.css"

export default function NewMealPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [servings, setServings] = useState(2)
  const [ingredients, setIngredients] = useState("")
  const [steps, setSteps] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    setError(null)

    const ingredientsArr = ingredients.split("\n").map((s) => s.trim()).filter(Boolean)
    const stepsArr = steps.split("\n").map((s) => s.trim()).filter(Boolean)

    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null, servings, ingredients: ingredientsArr, steps: stepsArr }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to create recipe."); return }
      router.push(`/meals/${data.meal.id}`)
    } catch {
      setError("Failed to create recipe.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.detailContainer}>
      <Link href="/meals" className={styles.backLink}>
        <ChevronLeft size={14} /> Meals
      </Link>

      <h1 className={styles.pageTitle}>New Recipe</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="name" className={styles.formLabel}>Name *</label>
          <input id="name" className={styles.formInput} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="desc" className={styles.formLabel}>Description</label>
          <textarea id="desc" className={styles.formTextarea} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description… (markdown supported)" />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="servings" className={styles.formLabel}>Servings</label>
          <input id="servings" type="number" min={1} className={styles.formInput} style={{ width: 80 }} value={servings} onChange={(e) => setServings(parseInt(e.target.value) || 2)} />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="ingredients" className={styles.formLabel}>Ingredients</label>
          <textarea id="ingredients" className={styles.formTextarea} value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder={"200g flour\n2 eggs\n1 tsp salt"} />
          <span className={styles.formHint}>One ingredient per line. Markdown supported.</span>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="steps" className={styles.formLabel}>Steps</label>
          <textarea id="steps" className={styles.formTextarea} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={"Mix the flour and eggs.\nAdd salt and knead for 10 minutes."} />
          <span className={styles.formHint}>One step per line. Markdown supported.</span>
        </div>

        {error && <p className={styles.errorMsg}>{error}</p>}

        <button type="submit" className={styles.saveBtn} disabled={saving || !name.trim()}>
          {saving ? "Saving…" : "Save Recipe"}
        </button>
      </form>
    </div>
  )
}
