// src/app/meals/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import BatchImportModal from "./BatchImportModal"
import styles from "./meals.module.css"

type MealSummary = {
  id: string
  name: string
  mealType: string
  diet: string
  officeFriendly: boolean
  thirtyMinute: boolean
}

export default function MealsPage() {
  const { status } = useSession()
  const { t } = useTranslation()
  const [meals, setMeals] = useState<MealSummary[]>([])
  const [loading, setLoading] = useState(true)

  const [query, setQuery] = useState("")
  const [filterMealType, setFilterMealType] = useState("")
  const [filterDiet, setFilterDiet] = useState("")
  const [filterOffice, setFilterOffice] = useState(false)
  const [filterThirty, setFilterThirty] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)

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

  const dietLabel = (diet: string) => {
    if (diet === "Vegetarian") return `🥦 ${t.meals.dietVegetarian}`
    if (diet === "Fish") return `🐟 ${t.meals.dietFish}`
    if (diet === "Meat") return `🥩 ${t.meals.dietMeat}`
    return diet
  }

  const hasFilters = query || filterMealType || filterDiet || filterOffice || filterThirty

  if (status === "loading") return null

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t.meals.title}</h1>
        <div className={styles.pageHeaderActions}>
          <button
            type="button"
            className={styles.batchBtn}
            onClick={() => setBatchOpen(true)}
          >
            {t.meals.batchImport}
          </button>
          <Link href="/meals/new" className={styles.newBtn}>
            <Plus size={14} strokeWidth={2.5} />
            {t.meals.newRecipe}
          </Link>
        </div>
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
          <option value="">{t.meals.allTypes}</option>
          <option value="Meal">{t.meals.typeMeal}</option>
          <option value="Snack">{t.meals.typeSnack}</option>
          <option value="Drink">{t.meals.typeDrink}</option>
          <option value="Baked">{t.meals.typeBaked}</option>
        </select>

        <select
          className={styles.filterSelect}
          value={filterDiet}
          onChange={(e) => setFilterDiet(e.target.value)}
        >
          <option value="">{t.meals.allDiets}</option>
          <option value="Vegetarian">{t.meals.dietVegetarian}</option>
          <option value="Fish">{t.meals.dietFish}</option>
          <option value="Meat">{t.meals.dietMeat}</option>
        </select>

        <button
          className={`${styles.filterToggle} ${filterOffice ? styles.filterToggleActive : ""}`}
          onClick={() => setFilterOffice((v) => !v)}
        >
          {t.meals.officeFilter}
        </button>

        <button
          className={`${styles.filterToggle} ${filterThirty ? styles.filterToggleActive : ""}`}
          onClick={() => setFilterThirty((v) => !v)}
        >
          {t.meals.quickFilter}
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
        <p className={styles.emptyState}>{hasFilters ? t.meals.noRecipesMatch : t.meals.noRecipesYet}</p>
      ) : (
        <div className={styles.list}>
          {meals.map((meal) => (
            <Link key={meal.id} href={`/meals/${meal.id}`} className={styles.listItem}>
              <span className={styles.listItemName}>{meal.name}</span>
              <span className={styles.listItemMeta}>
                {meal.mealType}
                {" · "}{dietLabel(meal.diet)}
                {meal.officeFriendly ? ` · ${t.meals.officeFilter}` : ""}
                {meal.thirtyMinute ? ` · ${t.meals.quickFilter}` : ""}
              </span>
            </Link>
          ))}
        </div>
      )}

      {batchOpen && (
        <BatchImportModal
          onClose={() => setBatchOpen(false)}
          onRefresh={() => {
            setLoading(true)
            fetchMeals(query).finally(() => setLoading(false))
          }}
        />
      )}
    </div>
  )
}
