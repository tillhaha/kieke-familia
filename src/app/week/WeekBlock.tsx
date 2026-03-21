// src/app/week/WeekBlock.tsx
"use client"

import { useState, useCallback, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import { ExternalLink } from "lucide-react"
import styles from "./week.module.css"

export type DayData = {
  id: string
  date: string // YYYY-MM-DD
  note: string | null
  lunch: string | null
  dinner: string | null
  dinnerActivity: string | null
  lunchMealId: string | null
  dinnerMealId: string | null
}

export type WeekData = {
  startDate: string
  endDate: string
  days: DayData[]
}

type Props = {
  week: WeekData
  onDayUpdate: (date: string, field: string, value: string | null) => void
}

type Field = "note" | "lunch" | "dinner" | "dinnerActivity"

type MealResult = { id: string; name: string; servings: number }

type RecipeSearch = {
  key: string
  query: string
  results: MealResult[]
  savedText: string
}

const ROWS: { field: Field; label: string; placeholder: string }[] = [
  { field: "note", label: "Note", placeholder: "Add a note…" },
  { field: "lunch", label: "Lunch", placeholder: "Lunch… (type /recipe to search)" },
  { field: "dinner", label: "Dinner", placeholder: "Dinner… (type /recipe to search)" },
  { field: "dinnerActivity", label: "Activity", placeholder: "Activity…" },
]

const MEAL_FIELDS = new Set<Field>(["lunch", "dinner"])

function formatWeekHeader(startDate: string, endDate: string): string {
  const fmt = (s: string) =>
    new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  const year = new Date(endDate + "T00:00:00").getFullYear()
  return `${fmt(startDate)} – ${fmt(endDate)}, ${year}`
}

function formatDayHeader(dateStr: string): { weekday: string; day: number } {
  const d = new Date(dateStr + "T00:00:00")
  return {
    weekday: d.toLocaleDateString("en-GB", { weekday: "short" }),
    day: d.getDate(),
  }
}

function isPastWeek(endDate: string): boolean {
  const end = new Date(endDate + "T00:00:00")
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return end < today
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto"
  el.style.height = el.scrollHeight + "px"
}

export function WeekBlock({ week, onDayUpdate }: Props) {
  const past = isPastWeek(week.endDate)

  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const day of week.days) {
      for (const { field } of ROWS) {
        init[`${day.date}:${field}`] = day[field] ?? ""
      }
    }
    return init
  })

  const [mealIds, setMealIds] = useState<Record<string, string | null>>(() => {
    const init: Record<string, string | null> = {}
    for (const day of week.days) {
      init[`${day.date}:lunch`] = day.lunchMealId ?? null
      init[`${day.date}:dinner`] = day.dinnerMealId ?? null
    }
    return init
  })

  const [cellErrors, setCellErrors] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [recipeSearch, setRecipeSearch] = useState<RecipeSearch | null>(null)

  // Debounced meal search
  const searchQuery = recipeSearch?.query ?? null
  useEffect(() => {
    if (searchQuery === null) return
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/meals?q=${encodeURIComponent(searchQuery)}`)
        const data = await res.json()
        setRecipeSearch((prev) => prev ? { ...prev, results: data.meals ?? [] } : null)
      } catch { /* ignore */ }
    }, 200)
    return () => clearTimeout(t)
  }, [searchQuery])

  const getSaved = useCallback(
    (date: string, field: Field): string => {
      const day = week.days.find((d) => d.date === date)
      return day?.[field] ?? ""
    },
    [week]
  )

  const handleBlur = async (date: string, field: Field) => {
    setFocusedKey(null)
    const key = `${date}:${field}`
    const current = drafts[key] ?? ""
    const saved = getSaved(date, field)
    if (current === saved) return

    setSaving((prev) => new Set(prev).add(key))

    // If overwriting a meal-linked cell with free text, clear the FK
    const body: Record<string, string | null> = { [field]: current || null }
    if (MEAL_FIELDS.has(field) && mealIds[key]) {
      const mealIdField = field === "lunch" ? "lunchMealId" : "dinnerMealId"
      body[mealIdField] = null
      setMealIds((prev) => ({ ...prev, [key]: null }))
    }

    try {
      const res = await fetch(`/api/weeks/days/${date}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      onDayUpdate(date, field, current || null)
    } catch {
      setDrafts((prev) => ({ ...prev, [key]: saved }))
      setCellErrors((prev) => {
        const next = new Set(prev).add(key)
        setTimeout(() => setCellErrors((p) => { const n = new Set(p); n.delete(key); return n }), 2000)
        return next
      })
    } finally {
      setSaving((prev) => { const next = new Set(prev); next.delete(key); return next })
    }
  }

  const selectMeal = async (date: string, field: "lunch" | "dinner", meal: MealResult) => {
    const key = `${date}:${field}`
    const mealIdField = field === "lunch" ? "lunchMealId" : "dinnerMealId"

    setDrafts((prev) => ({ ...prev, [key]: meal.name }))
    setMealIds((prev) => ({ ...prev, [key]: meal.id }))
    setRecipeSearch(null)

    setSaving((prev) => new Set(prev).add(key))
    try {
      const res = await fetch(`/api/weeks/days/${date}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: meal.name, [mealIdField]: meal.id }),
      })
      if (!res.ok) throw new Error()
      onDayUpdate(date, field, meal.name)
      onDayUpdate(date, mealIdField, meal.id)
    } catch {
      setDrafts((prev) => ({ ...prev, [key]: getSaved(date, field) }))
      setMealIds((prev) => ({ ...prev, [key]: null }))
    } finally {
      setSaving((prev) => { const next = new Set(prev); next.delete(key); return next })
    }
  }

  return (
    <div className={styles.weekBlock}>
      <h2 className={styles.weekHeader}>
        {formatWeekHeader(week.startDate, week.endDate)}
      </h2>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.cornerCell} />
              {week.days.map((day) => {
                const { weekday, day: dayNum } = formatDayHeader(day.date)
                return (
                  <th key={day.date} className={styles.dayHeader}>
                    <span className={styles.dayName}>{weekday}</span>
                    <span className={styles.dayNum}>{dayNum}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ field, label, placeholder }) => (
              <tr key={field}>
                <td className={styles.rowLabel}>{label}</td>
                {week.days.map((day) => {
                  const key = `${day.date}:${field}`
                  const hasError = cellErrors.has(key)
                  const isFocused = focusedKey === key
                  const isSearching = recipeSearch?.key === key
                  const value = drafts[key] ?? ""
                  const isDisabled = past || saving.has(key)
                  const isMealField = MEAL_FIELDS.has(field)
                  const linkedMealId = isMealField ? mealIds[key] : null

                  return (
                    <td key={day.date} className={`${styles.cell} ${hasError ? styles.cellError : ""}`}>
                      {isSearching ? (
                        /* Recipe search mode */
                        <div className={styles.recipeSearchContainer}>
                          <input
                            autoFocus
                            className={styles.recipeSearchInput}
                            value={recipeSearch!.query}
                            placeholder="Search meals…"
                            onChange={(e) =>
                              setRecipeSearch((prev) => prev ? { ...prev, query: e.target.value } : null)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                setDrafts((prev) => ({ ...prev, [key]: recipeSearch!.savedText }))
                                setRecipeSearch(null)
                              }
                            }}
                            onBlur={() => {
                              // Delay to allow mousedown on result to fire first
                              setTimeout(() => {
                                setRecipeSearch((prev) => {
                                  if (prev?.key === key) {
                                    setDrafts((d) => ({ ...d, [key]: prev.savedText }))
                                    return null
                                  }
                                  return prev
                                })
                              }, 150)
                            }}
                          />
                          {recipeSearch!.results.length > 0 && (
                            <ul className={styles.recipeDropdown}>
                              {recipeSearch!.results.map((meal) => (
                                <li
                                  key={meal.id}
                                  className={styles.recipeDropdownItem}
                                  onMouseDown={() => selectMeal(day.date, field as "lunch" | "dinner", meal)}
                                >
                                  <span className={styles.recipeDropdownName}>{meal.name}</span>
                                  <span className={styles.recipeDropdownMeta}>{meal.servings} srv</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : isFocused ? (
                        /* Edit mode */
                        <textarea
                          autoFocus
                          className={styles.cellInput}
                          value={value}
                          placeholder={placeholder}
                          disabled={isDisabled}
                          onChange={(e) => {
                            const v = e.target.value
                            // Enter recipe search mode when /recipe is typed in meal fields
                            if (isMealField && v === "/recipe") {
                              setFocusedKey(null)
                              setRecipeSearch({ key, query: "", results: [], savedText: drafts[key] ?? "" })
                              return
                            }
                            setDrafts((prev) => ({ ...prev, [key]: v }))
                            autoResize(e.target)
                          }}
                          onBlur={() => handleBlur(day.date, field)}
                          ref={(el) => { if (el) autoResize(el) }}
                        />
                      ) : (
                        /* Preview mode */
                        <div
                          className={styles.cellPreview}
                          onClick={() => { if (!isDisabled) setFocusedKey(key) }}
                        >
                          {value && (
                            <div className={styles.cellPreviewInner}>
                              <ReactMarkdown>{value}</ReactMarkdown>
                              {linkedMealId && (
                                <a
                                  href={`/meals/${linkedMealId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.mealLink}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink size={11} />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
