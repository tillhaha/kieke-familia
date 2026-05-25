// src/app/meals/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { CheckSquare, Layers, Plus, Search, Square, Star } from "lucide-react"
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
  favorite: boolean
}

type BulkEdits = {
  mealType?: "Meal" | "Snack" | "Drink" | "Baked"
  diet?: "Vegetarian" | "Fish" | "Meat"
  officeFriendly?: boolean
  thirtyMinute?: boolean
}

function cycleBool(v: boolean | undefined): boolean | undefined {
  if (v === undefined) return true
  if (v === true) return false
  return undefined
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
  const [filterFavorite, setFilterFavorite] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)

  // Multi-select
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkEdits, setBulkEdits] = useState<BulkEdits>({})
  const [applying, setApplying] = useState(false)

  const fetchMeals = useCallback((q: string) => {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (filterMealType) params.set("mealType", filterMealType)
    if (filterDiet) params.set("diet", filterDiet)
    if (filterOffice) params.set("officeFriendly", "true")
    if (filterThirty) params.set("thirtyMinute", "true")
    if (filterFavorite) params.set("favorite", "true")
    return fetch(`/api/meals?${params}`)
      .then((r) => r.json())
      .then((d) => setMeals(d.meals ?? []))
  }, [filterMealType, filterDiet, filterOffice, filterThirty, filterFavorite])

  const toggleFavorite = async (id: string, current: boolean) => {
    setMeals((prev) => prev.map((m) => m.id === id ? { ...m, favorite: !current } : m))
    try {
      await fetch(`/api/meals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: !current }),
      })
    } catch {
      setMeals((prev) => prev.map((m) => m.id === id ? { ...m, favorite: current } : m))
    }
  }

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

  const hasFilters = query || filterMealType || filterDiet || filterOffice || filterThirty || filterFavorite

  // Multi-select helpers
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelected(new Set())
    setBulkEdits({})
  }

  const hasEdits = Object.values(bulkEdits).some((v) => v !== undefined)

  const applyBulkEdits = async () => {
    if (selected.size === 0 || !hasEdits || applying) return
    const body: Record<string, unknown> = { ids: Array.from(selected) }
    if (bulkEdits.mealType !== undefined) body.mealType = bulkEdits.mealType
    if (bulkEdits.diet !== undefined) body.diet = bulkEdits.diet
    if (bulkEdits.officeFriendly !== undefined) body.officeFriendly = bulkEdits.officeFriendly
    if (bulkEdits.thirtyMinute !== undefined) body.thirtyMinute = bulkEdits.thirtyMinute

    setApplying(true)
    try {
      const res = await fetch("/api/meals/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      exitSelectMode()
      setLoading(true)
      fetchMeals(query).finally(() => setLoading(false))
    } catch { /* silently ignore */ }
    finally { setApplying(false) }
  }

  const setBulkMealType = (v: "Meal" | "Snack" | "Drink" | "Baked") =>
    setBulkEdits((prev) => ({ ...prev, mealType: prev.mealType === v ? undefined : v }))

  const setBulkDiet = (v: "Vegetarian" | "Fish" | "Meat") =>
    setBulkEdits((prev) => ({ ...prev, diet: prev.diet === v ? undefined : v }))

  if (status === "loading") return null

  return (
    <div className={`${styles.container} ${selectMode ? styles.containerSelectMode : ""}`}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t.meals.title}</h1>
        <div className={styles.pageHeaderActions}>
          <button
            type="button"
            className={`${styles.selectBtn} ${selectMode ? styles.selectBtnActive : ""}`}
            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
          >
            <Layers size={14} strokeWidth={2} />
            {selectMode ? "Cancel" : "Select"}
          </button>
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

        <button
          className={`${styles.filterToggle} ${styles.filterToggleStar} ${filterFavorite ? styles.filterToggleActive : ""}`}
          onClick={() => setFilterFavorite((v) => !v)}
          title={t.meals.favoritesFilter}
        >
          <Star size={13} fill={filterFavorite ? "currentColor" : "none"} strokeWidth={1.5} />
        </button>

        {hasFilters && (
          <button
            className={styles.filterClear}
            onClick={() => { setQuery(""); setFilterMealType(""); setFilterDiet(""); setFilterOffice(false); setFilterThirty(false); setFilterFavorite(false) }}
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
          {meals.map((meal) => {
            const isSelected = selected.has(meal.id)
            return (
              <div
                key={meal.id}
                className={`${styles.listItem} ${selectMode && isSelected ? styles.listItemSelected : ""}`}
                onClick={selectMode ? () => toggleSelect(meal.id) : undefined}
              >
                {selectMode && (
                  <span className={styles.listItemCheckbox}>
                    {isSelected
                      ? <CheckSquare size={16} strokeWidth={2} className={styles.checkboxChecked} />
                      : <Square size={16} strokeWidth={2} className={styles.checkboxUnchecked} />
                    }
                  </span>
                )}
                <Link
                  href={`/meals/${meal.id}`}
                  className={styles.listItemLink}
                  onClick={selectMode ? (e) => e.preventDefault() : undefined}
                  tabIndex={selectMode ? -1 : undefined}
                >
                  <span className={styles.listItemName}>{meal.name}</span>
                  <span className={styles.listItemMeta}>
                    {meal.mealType}
                    {" · "}{dietLabel(meal.diet)}
                    {meal.officeFriendly ? ` · ${t.meals.officeFilter}` : ""}
                    {meal.thirtyMinute ? ` · ${t.meals.quickFilter}` : ""}
                  </span>
                </Link>
                {!selectMode && (
                  <button
                    className={`${styles.starBtn} ${meal.favorite ? styles.starBtnActive : ""}`}
                    onClick={() => toggleFavorite(meal.id, meal.favorite)}
                    title={meal.favorite ? "Remove from favourites" : "Add to favourites"}
                  >
                    <Star size={14} fill={meal.favorite ? "currentColor" : "none"} strokeWidth={1.5} />
                  </button>
                )}
              </div>
            )
          })}
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

      {/* Bulk action bar */}
      {selectMode && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>
            {selected.size} selected
          </span>

          <div className={styles.bulkGroups}>
            {/* Meal type */}
            <div className={styles.bulkGroup}>
              {(["Meal", "Snack", "Drink", "Baked"] as const).map((v) => (
                <button
                  key={v}
                  className={`${styles.bulkChip} ${bulkEdits.mealType === v ? styles.bulkChipActive : ""}`}
                  onClick={() => setBulkMealType(v)}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Diet */}
            <div className={styles.bulkGroup}>
              {(["Vegetarian", "Fish", "Meat"] as const).map((v) => (
                <button
                  key={v}
                  className={`${styles.bulkChip} ${bulkEdits.diet === v ? styles.bulkChipActive : ""}`}
                  onClick={() => setBulkDiet(v)}
                >
                  {v === "Vegetarian" ? "Veggie" : v}
                </button>
              ))}
            </div>

            {/* Boolean toggles */}
            <div className={styles.bulkGroup}>
              <button
                className={`${styles.bulkChip} ${bulkEdits.officeFriendly === true ? styles.bulkChipTrue : bulkEdits.officeFriendly === false ? styles.bulkChipFalse : ""}`}
                onClick={() => setBulkEdits((prev) => ({ ...prev, officeFriendly: cycleBool(prev.officeFriendly) }))}
                title="Cycle: unset → office-friendly → not office-friendly"
              >
                {bulkEdits.officeFriendly === true ? "✓ " : bulkEdits.officeFriendly === false ? "✗ " : ""}Office
              </button>
              <button
                className={`${styles.bulkChip} ${bulkEdits.thirtyMinute === true ? styles.bulkChipTrue : bulkEdits.thirtyMinute === false ? styles.bulkChipFalse : ""}`}
                onClick={() => setBulkEdits((prev) => ({ ...prev, thirtyMinute: cycleBool(prev.thirtyMinute) }))}
                title="Cycle: unset → quick → not quick"
              >
                {bulkEdits.thirtyMinute === true ? "✓ " : bulkEdits.thirtyMinute === false ? "✗ " : ""}Quick
              </button>
            </div>
          </div>

          <div className={styles.bulkActions}>
            <button className={styles.bulkCancelBtn} onClick={exitSelectMode}>
              Cancel
            </button>
            <button
              className={styles.bulkApplyBtn}
              disabled={selected.size === 0 || !hasEdits || applying}
              onClick={applyBulkEdits}
            >
              {applying ? "Saving…" : "Apply"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
