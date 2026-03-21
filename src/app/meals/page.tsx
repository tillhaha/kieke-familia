// src/app/meals/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import styles from "./meals.module.css"

type MealSummary = {
  id: string
  name: string
  description: string | null
  servings: number
  createdAt: string
}

export default function MealsPage() {
  const { status } = useSession()
  const [meals, setMeals] = useState<MealSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status !== "authenticated") return
    fetch("/api/meals")
      .then((r) => r.json())
      .then((d) => setMeals(d.meals ?? []))
      .finally(() => setLoading(false))
  }, [status])

  if (status === "loading" || loading) return null

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Meals</h1>
        <Link href="/meals/new" className={styles.newBtn}>
          <Plus size={14} strokeWidth={2.5} />
          New Recipe
        </Link>
      </div>

      {meals.length === 0 ? (
        <p className={styles.emptyState}>No recipes yet. Add your first one!</p>
      ) : (
        <div className={styles.grid}>
          {meals.map((meal) => (
            <Link key={meal.id} href={`/meals/${meal.id}`} className={styles.card}>
              <span className={styles.cardName}>{meal.name}</span>
              {meal.description && (
                <span className={styles.cardDesc}>{meal.description}</span>
              )}
              <span className={styles.cardMeta}>{meal.servings} servings</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
