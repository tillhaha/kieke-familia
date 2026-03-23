// src/app/meals/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { Plus, Search } from "lucide-react"
import styles from "./meals.module.css"

type MealSummary = {
  id: string
  name: string
  mealType: string
  diet: string
  officeFriendly: boolean
  thirtyMinute: boolean
}

const DIET_LABELS: Record<string, string> = {
  Vegetarian: "🥦 Veggie",
  Fish: "🐟 Fish",
  Meat: "🥩 Meat",
}

export default function MealsPage() {
  const { status } = useSession()
  const [meals, setMeals] = useState<MealSummary[]>([])
  const [loading, setLoading] = useState(true)

  const [query, setQuery] = useState("")
  const [filterMealType, setFilterMealType] = useState("")
  const [filterDiet, setFilterDiet] = useState("")
  const [filterOffice, setFilterOffice] = useState(false)
  const [filterThirty, setFilterThirty] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchMeals = useCallback((q: string) => {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (filterMealType) params.set("mealType", filterMealType)
    if (filterDiet) params.set("diet", filterDiet)
    if (filterOffice) params.set("officeFriendly", "true")
    if (filterThirty) params.set("thirtyMinute", "true")
    return fetch(`/api/meals?${params}`)
      .then((r) => r.json())
      .then((d) => setMeals(d.meals ?? []))
  }, [filterMealType, filterDiet, filterOffice, filterThirty])

  // Re-fetch when filters change (immediately)
  useEffect(() => {
    if (status !== "authenticated") return
    setLoading(true)
    fetchMeals(query).finally(() => setLoading(false))
  }, [status, fetchMeals]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced re-fetch when search query changes
  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setLoading(true)
      fetchMeals(value).finally(() => setLoading(false))
    }, 300)
  }

  const hasFilters = query || filterMealType || filterDiet || filterOffice || filterThirty

  if (status === "loading") return null

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Recipes</h1>
        <Link href="/meals/new" className={styles.newBtn}>
          <Plus size={14} strokeWidth={2.5} />
          New Recipe
        </Link>
      </div>

      {/* Search + Filters */}
      <div className={styles.controlsRow}>
        <div className={styles.searchRow}>
          <Search size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search recipes…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
          />
        </div>

        <div className={styles.filterBar}>
        <select
          className={styles.filterSelect}
          value={filterMealType}
          onChange={(e) => setFilterMealType(e.target.value)}
        >
          <option value="">All types</option>
          <option value="Meal">Meal</option>
          <option value="Snack">Snack</option>
          <option value="Drink">Drink</option>
          <option value="Baked">Baked</option>
        </select>

        <select
          className={styles.filterSelect}
          value={filterDiet}
          onChange={(e) => setFilterDiet(e.target.value)}
        >
          <option value="">All diets</option>
          <option value="Vegetarian">Vegetarian</option>
          <option value="Fish">Fish</option>
          <option value="Meat">Meat</option>
        </select>

        <button
          className={`${styles.filterToggle} ${filterOffice ? styles.filterToggleActive : ""}`}
          onClick={() => setFilterOffice((v) => !v)}
        >
          Office
        </button>

        <button
          className={`${styles.filterToggle} ${filterThirty ? styles.filterToggleActive : ""}`}
          onClick={() => setFilterThirty((v) => !v)}
        >
          Quick
        </button>

        {hasFilters && (
          <button
            className={styles.filterClear}
            onClick={() => { setQuery(""); setFilterMealType(""); setFilterDiet(""); setFilterOffice(false); setFilterThirty(false) }}
          >
            Clear
          </button>
        )}
        </div>
      </div>

      {loading ? null : meals.length === 0 ? (
        <p className={styles.emptyState}>{hasFilters ? "No recipes match your filters." : "No recipes yet. Add your first one!"}</p>
      ) : (
        <div className={styles.list}>
          {meals.map((meal) => (
            <Link key={meal.id} href={`/meals/${meal.id}`} className={styles.listItem}>
              <span className={styles.listItemName}>{meal.name}</span>
              <span className={styles.listItemMeta}>
                {meal.mealType}
                {" · "}{DIET_LABELS[meal.diet] ?? meal.diet}
                {meal.officeFriendly ? " · Office" : ""}
                {meal.thirtyMinute ? " · Quick" : ""}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
