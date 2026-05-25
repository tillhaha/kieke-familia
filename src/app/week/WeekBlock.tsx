// src/app/week/WeekBlock.tsx
"use client"

import { Fragment, useState, useCallback, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import ReactMarkdown from "react-markdown"
import { Baby, ExternalLink, Link, Pencil, Sun, CloudSun, CloudRain, CloudLightning, ShoppingCart, MapPin, Zap, Coffee, Utensils, Cloud } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import { EMOJI_CATEGORIES } from "./emojiData"
import styles from "./week.module.css"

export type DayWeather = {
  low: number
  high: number
  morningRain: number
  afternoonRain: number
  eveningRain: number
}

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

export type CustodyEntry = { id: string; date: string; location: "WITH_US" | "WITH_MONA"; personName: string }

export type CalendarEvent = {
  id: string
  summary: string
  date: string    // YYYY-MM-DD start date
  endDate: string // YYYY-MM-DD exclusive end (Google/iCal convention: day-after for all-day)
  allDay: boolean
  startTime?: string | null // "HH:MM" for timed events, null for all-day
  calendarName?: string | null
  color?: string | null
}

type Props = {
  week: WeekData
  onDayUpdate: (date: string, field: string, value: string | null) => void
  weather?: Record<string, DayWeather>
  custodyEntries?: CustodyEntry[]
  calendarEvents?: CalendarEvent[]
  readOnly?: boolean
  id?: string
  editHref?: string
  onGenerateShopping?: (weekStartDate: string) => Promise<void>
}

type Field = "note" | "lunch" | "dinner" | "dinnerActivity"

type MealResult = { id: string; name: string; servings: number }

type RecipeSearch = {
  key: string
  query: string
  results: MealResult[]
  savedText: string
}

type LinkPrompt = {
  key: string
  selStart: number
  selEnd: number
  selText: string
  baseText: string
}

type EmojiPickerState = {
  key: string
  colonPos: number
  top: number
  left: number
}

const SECTION_ROWS: { section: string; rows: { field: Field; label: string; placeholder: string }[] }[] = [
  {
    section: "Notes",
    rows: [
      { field: "note", label: "Location", placeholder: "Add a note…" },
    ],
  },
  {
    section: "Meals",
    rows: [
      { field: "lunch", label: "Lunch", placeholder: "Lunch… (type / to search recipes)" },
      { field: "dinner", label: "Dinner", placeholder: "Dinner… (type / to search recipes)" },
    ],
  },
]

const ALL_ROWS = SECTION_ROWS.flatMap((s) => s.rows)

const FIELD_ICON: Record<string, React.ReactNode> = {
  note:          <MapPin size={11} strokeWidth={2} />,
  dinnerActivity:<Zap size={11} strokeWidth={2} />,
  lunch:         <Coffee size={11} strokeWidth={2} />,
  dinner:        <Utensils size={11} strokeWidth={2} />,
}

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

function WeatherIcon({ rain }: { rain: number }) {
  if (rain >= 75) return <CloudLightning size={15} color="#818cf8" />
  if (rain >= 50) return <CloudRain size={15} color="#60a5fa" />
  if (rain >= 25) return <CloudSun size={15} color="#fbbf24" />
  return <Sun size={15} color="#f59e0b" />
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto"
  el.style.height = el.scrollHeight + "px"
}

export function WeekBlock({ week, onDayUpdate, weather, custodyEntries, calendarEvents, readOnly, id, editHref, onGenerateShopping }: Props) {
  const past = isPastWeek(week.endDate)
  const { t } = useTranslation()

  const rowLabel = (field: Field): string => {
    if (field === "note") return t.weekBlock.location
    if (field === "lunch") return t.weekBlock.lunch
    if (field === "dinner") return t.weekBlock.dinner
    return field
  }
  const rowPlaceholder = (field: Field): string => {
    if (field === "note") return t.weekBlock.locationPlaceholder
    if (field === "lunch") return t.weekBlock.lunchPlaceholder
    if (field === "dinner") return t.weekBlock.dinnerPlaceholder
    return ""
  }

  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const day of week.days) {
      for (const { field } of ALL_ROWS) {
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
  const [generating, setGenerating] = useState(false)
  const [linkPrompt, setLinkPrompt] = useState<LinkPrompt | null>(null)
  const [linkUrl, setLinkUrl] = useState("")
  const linkPromptKeyRef = useRef<string | null>(null)
  const linkUrlInputRef = useRef<HTMLInputElement>(null)
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map())

  useEffect(() => {
    if (linkPrompt) setTimeout(() => linkUrlInputRef.current?.focus(), 0)
  }, [linkPrompt])

  const insertLink = (url: string) => {
    if (!linkPrompt) return
    const { key, selStart, selEnd, selText, baseText } = linkPrompt
    const label = selText || (() => { try { return new URL(url).hostname.replace(/^www\./, "") } catch { return url } })()
    const mdLink = `[${label}](${url})`
    const newText = baseText.slice(0, selStart) + mdLink + baseText.slice(selEnd)
    setDrafts((prev) => ({ ...prev, [key]: newText }))
    linkPromptKeyRef.current = null
    setLinkPrompt(null)
    setLinkUrl("")
    setTimeout(() => {
      const ta = textareaRefs.current.get(key)
      if (ta) { ta.focus(); const pos = selStart + mdLink.length; ta.setSelectionRange(pos, pos); autoResize(ta) }
    }, 0)
  }

  const dismissLinkPrompt = (date: string, field: Field) => {
    linkPromptKeyRef.current = null
    setLinkPrompt(null)
    setLinkUrl("")
    handleBlur(date, field)
  }

  const [emojiPicker, setEmojiPicker] = useState<EmojiPickerState | null>(null)
  const [activeEmojiCategory, setActiveEmojiCategory] = useState(0)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!emojiPicker) return
    const onMouseDown = (e: MouseEvent) => {
      if (emojiPickerRef.current?.contains(e.target as Node)) return
      setEmojiPicker(null)
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [emojiPicker])

  const insertEmoji = (emoji: string, key: string, colonPos: number) => {
    setDrafts((prev) => {
      const current = prev[key] ?? ""
      const before = current.slice(0, colonPos)
      const after = current.slice(colonPos + 1)
      return { ...prev, [key]: before + emoji + after }
    })
    setEmojiPicker(null)
    setTimeout(() => {
      const ta = textareaRefs.current.get(key)
      if (ta) { ta.focus(); autoResize(ta) }
    }, 0)
  }

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, key: string, field: Field) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault()
      const ta = e.currentTarget
      const selStart = ta.selectionStart
      const selEnd = ta.selectionEnd
      const selText = ta.value.slice(selStart, selEnd)
      linkPromptKeyRef.current = key
      setLinkPrompt({ key, selStart, selEnd, selText, baseText: ta.value })
      setLinkUrl("")
      return
    }
    if (e.key === ":" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const ta = e.currentTarget
      const rect = ta.getBoundingClientRect()
      setEmojiPicker({ key, colonPos: ta.selectionStart, top: rect.bottom + 4, left: rect.left })
      setActiveEmojiCategory(0)
    }
    if (e.key === "Escape" && emojiPicker?.key === key) {
      setEmojiPicker(null)
    }
    if (field === "note" || field === "dinnerActivity") return
    // slash command handled in onChange
  }

  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>, key: string) => {
    const pasted = e.clipboardData.getData("text").trim()
    if (!/^https?:\/\/\S+$/.test(pasted)) return
    e.preventDefault()
    const ta = e.currentTarget
    const selStart = ta.selectionStart
    const selEnd = ta.selectionEnd
    const selText = ta.value.slice(selStart, selEnd)
    let insert: string
    if (selText) {
      insert = `[${selText}](${pasted})`
    } else {
      try { insert = `[${new URL(pasted).hostname.replace(/^www\./, "")}](${pasted})` } catch { insert = pasted }
    }
    const newVal = ta.value.slice(0, selStart) + insert + ta.value.slice(selEnd)
    setDrafts((prev) => ({ ...prev, [key]: newVal }))
    setTimeout(() => { const ta2 = textareaRefs.current.get(key); if (ta2) autoResize(ta2) }, 0)
  }

  const renderLinkPromptBar = (key: string, date: string, field: Field) => {
    if (linkPrompt?.key !== key) return null
    return (
      <div className={styles.linkPromptBar}>
        <Link size={11} className={styles.linkPromptIcon} />
        <input
          ref={linkUrlInputRef}
          className={styles.linkPromptInput}
          value={linkUrl}
          placeholder="https://…"
          onChange={(e) => setLinkUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); if (linkUrl.trim()) insertLink(linkUrl.trim()) }
            if (e.key === "Escape") { e.preventDefault(); linkPromptKeyRef.current = null; setLinkPrompt(null); setLinkUrl(""); setTimeout(() => textareaRefs.current.get(key)?.focus(), 0) }
          }}
          onBlur={(e) => {
            if (e.relatedTarget === textareaRefs.current.get(key)) return
            dismissLinkPrompt(date, field)
          }}
        />
        <button
          className={styles.linkPromptSubmit}
          onMouseDown={(e) => { e.preventDefault(); if (linkUrl.trim()) insertLink(linkUrl.trim()) }}
        >
          Insert
        </button>
      </div>
    )
  }

  // Mobile views
  const [mobileView, setMobileView] = useState<"day" | "3day" | "week">("3day")
  const [mobileDayDetail, setMobileDayDetail] = useState<string | null>(null)
  const [mobilePillDetail, setMobilePillDetail] = useState<string | null>(null)

  const linkifyText = (text: string) =>
    text.replace(/(?<!\]\()https?:\/\/[^\s)\]>]+/g, (url) => {
      try { return `[${new URL(url).hostname.replace(/^www\./, "")}](${url})` } catch { return url }
    })

  const pillComponents = {
    li: ({ children, ...props }: React.ComponentPropsWithoutRef<"li">) => {
      const text = typeof children === "string" ? children : Array.isArray(children) ? children.map((c) => (typeof c === "string" ? c : "")).join("") : ""
      return (
        <li
          onMouseEnter={(e) => showPillTooltip(text, e)}
          onMouseLeave={hidePillTooltip}
          onClick={(e) => { e.stopPropagation(); setMobilePillDetail(text) }}
          {...props}
        >
          {children}
        </li>
      )
    },
    a: ({ href, children }: React.ComponentPropsWithoutRef<"a">) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.inlineLink}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </a>
    ),
  }

  const todayDateStr = (() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
  })()

  const getMobileDays = (): DayData[] => {
    const idx = week.days.findIndex(d => d.date === todayDateStr)
    const start = idx >= 0 ? idx : 0
    if (mobileView === "day") return week.days.slice(start, start + 1)
    if (mobileView === "3day") return week.days.slice(start, start + 3)
    return week.days
  }

  // Pill tooltip
  const [pillTooltip, setPillTooltip] = useState<{ text: string; x: number; y: number } | null>(null)
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showPillTooltip = (text: string, e: React.MouseEvent) => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    tooltipTimer.current = setTimeout(() => {
      setPillTooltip({ text, x: rect.left + rect.width / 2, y: rect.top })
    }, 300)
  }
  const hidePillTooltip = () => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
    setPillTooltip(null)
  }

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
    const previousMealId = MEAL_FIELDS.has(field) ? mealIds[key] : null
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
      if (previousMealId !== null) {
        setMealIds((prev) => ({ ...prev, [key]: previousMealId }))
      }
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
    const previousMealId = mealIds[key]  // snapshot before optimistic update

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
      setMealIds((prev) => ({ ...prev, [key]: previousMealId }))  // restore previous, not null
    } finally {
      setSaving((prev) => { const next = new Set(prev); next.delete(key); return next })
    }
  }

  const handleGenerateShopping = async () => {
    if (!onGenerateShopping) return
    setGenerating(true)
    try {
      await onGenerateShopping(week.startDate)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className={styles.weekBlock} id={id}>
      <h2 className={styles.weekHeader}>
        {formatWeekHeader(week.startDate, week.endDate)}
        {editHref && (
          <a href={editHref} className={styles.weekEditLink} aria-label="Edit this week">
            <Pencil size={13} strokeWidth={2} />
          </a>
        )}
      </h2>
      {onGenerateShopping && !readOnly && (
        <button
          className={styles.generateBtn}
          onClick={handleGenerateShopping}
          disabled={generating}
        >
          <ShoppingCart size={13} strokeWidth={2} />
          {generating ? t.weekBlock.adding : t.weekBlock.addToShoppingList}
        </button>
      )}
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
            {weather && (
              <tr>
                <td className={styles.rowLabel}>{t.weekBlock.weather}</td>
                {week.days.map((day) => {
                  const w = weather[day.date]
                  if (!w) return <td key={day.date} className={`${styles.cell} ${styles.weatherCell}`} />
                  return (
                    <td key={day.date} className={`${styles.cell} ${styles.weatherCell}`}>
                      <div className={styles.weatherTemp}>{w.low}–{w.high}°</div>
                      <div className={styles.weatherPhases}>
                        <div className={styles.weatherPhase}>
                          <WeatherIcon rain={w.morningRain} />
                          <span>AM</span>
                        </div>
                        <div className={styles.weatherPhase}>
                          <WeatherIcon rain={w.afternoonRain} />
                          <span>PM</span>
                        </div>
                        <div className={styles.weatherPhase}>
                          <WeatherIcon rain={w.eveningRain} />
                          <span>Eve</span>
                        </div>
                      </div>
                    </td>
                  )
                })}
              </tr>
            )}
            {SECTION_ROWS.map(({ section, rows }) => (
              <Fragment key={section}>
                <tr>
                  <td colSpan={week.days.length + 1} className={styles.sectionHeader} />
                </tr>
                {rows.map(({ field }) => (
                  <tr key={field}>
                    <td className={`${styles.rowLabel} ${styles.subRowLabel}`}>{rowLabel(field)}</td>
                {week.days.map((day) => {
                  const key = `${day.date}:${field}`
                  const hasError = cellErrors.has(key)
                  const isFocused = focusedKey === key
                  const isSearching = recipeSearch?.key === key
                  const value = drafts[key] ?? ""
                  const isDisabled = readOnly || past || saving.has(key)
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
                            placeholder={t.weekBlock.searchMeals}
                            onChange={(e) =>
                              setRecipeSearch((prev) => prev ? { ...prev, query: e.target.value } : null)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                setRecipeSearch((prev) => {
                                  if (prev?.key === key) {
                                    setDrafts((d) => ({ ...d, [key]: prev.savedText }))
                                  }
                                  return null
                                })
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
                        <>
                        <textarea
                          autoFocus
                          className={styles.cellInput}
                          value={value}
                          placeholder={rowPlaceholder(field)}
                          disabled={isDisabled}
                          onChange={(e) => {
                            const v = e.target.value
                            if (isMealField && v.trimEnd().endsWith("/")) {
                              const textBeforeCommand = v.trimEnd().slice(0, -1)
                              setFocusedKey(null)
                              setRecipeSearch({ key, query: "", results: [], savedText: textBeforeCommand })
                              return
                            }
                            setDrafts((prev) => ({ ...prev, [key]: v }))
                            autoResize(e.target)
                          }}
                          onKeyDown={(e) => handleTextareaKeyDown(e, key, field)}
                          onPaste={(e) => handleTextareaPaste(e, key)}
                          onBlur={(e) => {
                            if (e.relatedTarget === linkUrlInputRef.current) return
                            if (linkPromptKeyRef.current === key) return
                            if (emojiPickerRef.current?.contains(e.relatedTarget as Node)) return
                            setEmojiPicker((prev) => prev?.key === key ? null : prev)
                            handleBlur(day.date, field)
                          }}
                          ref={(el) => {
                            if (el) { textareaRefs.current.set(key, el); autoResize(el) }
                            else textareaRefs.current.delete(key)
                          }}
                        />
                        {renderLinkPromptBar(key, day.date, field)}
                        </>
                      ) : (
                        /* Preview mode */
                        <div
                          className={`${styles.cellPreview} ${readOnly ? styles.cellPreviewReadOnly : ""} ${field === "note" ? styles.cellPreviewNote : ""}`}
                          onClick={() => { if (!isDisabled) setFocusedKey(key) }}
                        >
                          {value && (
                            <div className={styles.cellPreviewInner}>
                              <ReactMarkdown
                                components={{
                                  ...pillComponents,
                                }}
                              >{linkifyText(value)}</ReactMarkdown>
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
                {section === "Notes" && calendarEvents && (
                  <tr>
                    <td className={`${styles.rowLabel} ${styles.subRowLabel}`}>{t.weekBlock.events}</td>
                    {week.days.map((day) => {
                      const dayEvents = calendarEvents.filter((e) => e.date <= day.date && e.endDate > day.date)
                      return (
                        <td key={day.date} className={`${styles.cell} ${styles.eventsCell}`}>
                          {dayEvents.map((e) => (
                            <div
                              key={e.id}
                              className={styles.calEventChip}
                              onMouseEnter={(ev) => showPillTooltip([e.summary, e.allDay ? t.weekBlock.allDay : e.startTime, e.calendarName].filter(Boolean).join(" · "), ev)}
                              onMouseLeave={hidePillTooltip}
                            >
                              {e.color && <span className={styles.calEventDot} style={{ background: e.color }} />}
                              <span className={styles.calEventName}>{e.summary}</span>
                            </div>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                )}
                {section === "Notes" && custodyEntries && (
                  <tr>
                    <td className={`${styles.rowLabel} ${styles.subRowLabel}`}>Emilia</td>
                    {week.days.map((day) => {
                      const entry = custodyEntries.find((c) => c.date === day.date)
                      return (
                        <td key={day.date} className={`${styles.cell} ${styles.emiliaCell}`}>
                          {entry && (
                            <Baby
                              size={13}
                              strokeWidth={2}
                              className={entry.location === "WITH_US" ? styles.emiliaIconHome : styles.emiliaIconMona}
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile Views (≤768px) ─────────────────────────── */}
      <div className={styles.mobileViews}>
        {/* View switcher pills */}
        <div className={styles.mobileViewSwitcher}>
          {(["day", "3day", "week"] as const).map((v) => (
            <button
              key={v}
              className={`${styles.mobileViewBtn} ${mobileView === v ? styles.mobileViewBtnActive : ""}`}
              onClick={() => setMobileView(v)}
            >
              {v === "day" ? t.weekBlock.dayView : v === "3day" ? t.weekBlock.threeDayView : t.weekBlock.weekView}
            </button>
          ))}
        </div>

        {/* Day / 3-Day columns — row-first layout for equal row heights */}
        {(mobileView === "day" || mobileView === "3day") && (
          <div className={styles.mobileDaysRow}>
            {/* Header row */}
            <div className={styles.mobileRowGroup}>
              {getMobileDays().map((day) => {
                const isToday = day.date === todayDateStr
                const { weekday, day: dayNum } = formatDayHeader(day.date)
                const w = weather?.[day.date]
                return (
                  <div key={day.date} className={`${styles.mobileDayColHeader} ${isToday ? styles.mobileDayColHeaderToday : ""}`}>
                    <span className={styles.mobileDayColWeekday}>{weekday}</span>
                    <span className={styles.mobileDayColDate}>{dayNum}</span>
                    {w && (
                      <>
                        <span className={styles.mobileDayColTemp}>{w.low}–{w.high}°</span>
                        <div className={styles.mobileDayColPhases}>
                          <div className={styles.mobileDayColPhase}><WeatherIcon rain={w.morningRain} /><span>AM</span></div>
                          <div className={styles.mobileDayColPhase}><WeatherIcon rain={w.afternoonRain} /><span>PM</span></div>
                          <div className={styles.mobileDayColPhase}><WeatherIcon rain={w.eveningRain} /><span>Eve</span></div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Field rows */}
            {ALL_ROWS.map(({ field }) => (
              <Fragment key={field}>
                <div className={styles.mobileRowGroup}>
                  {getMobileDays().map((day) => {
                    const key = `${day.date}:${field}`
                    const value = drafts[key] ?? ""
                    const isDisabled = readOnly || past || saving.has(key)
                    const isFocused = focusedKey === key
                    const isSearching = recipeSearch?.key === key
                    const isMealField = MEAL_FIELDS.has(field)
                    const linkedMealId = isMealField ? mealIds[key] : null
                    const hasError = cellErrors.has(key)
                    return (
                      <div key={day.date} className={`${styles.mobileDayField} ${hasError ? styles.cellError : ""}`}>
                        <span className={styles.mobileDayFieldLabel}>{rowLabel(field)}</span>
                        {isSearching ? (
                          <div className={styles.recipeSearchContainer}>
                            <input
                              autoFocus
                              className={styles.recipeSearchInput}
                              value={recipeSearch!.query}
                              placeholder={t.weekBlock.searchMeals}
                              onChange={(e) =>
                                setRecipeSearch((prev) => prev ? { ...prev, query: e.target.value } : null)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  setRecipeSearch((prev) => {
                                    if (prev?.key === key) setDrafts((d) => ({ ...d, [key]: prev.savedText }))
                                    return null
                                  })
                                }
                              }}
                              onBlur={() => {
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
                          <>
                          <textarea
                            autoFocus
                            className={styles.cellInput}
                            value={value}
                            placeholder={rowPlaceholder(field)}
                            disabled={isDisabled}
                            onChange={(e) => {
                              const v = e.target.value
                              if (isMealField && v.trimEnd().endsWith("/recipe")) {
                                const textBeforeCommand = v.trimEnd().slice(0, -"/recipe".length)
                                setFocusedKey(null)
                                setRecipeSearch({ key, query: "", results: [], savedText: textBeforeCommand })
                                return
                              }
                              setDrafts((prev) => ({ ...prev, [key]: v }))
                              autoResize(e.target)
                            }}
                            onKeyDown={(e) => handleTextareaKeyDown(e, key, field)}
                            onPaste={(e) => handleTextareaPaste(e, key)}
                            onBlur={(e) => {
                              if (e.relatedTarget === linkUrlInputRef.current) return
                              if (linkPromptKeyRef.current === key) return
                              if (emojiPickerRef.current?.contains(e.relatedTarget as Node)) return
                              setEmojiPicker((prev) => prev?.key === key ? null : prev)
                              handleBlur(day.date, field)
                            }}
                            ref={(el) => {
                              if (el) { textareaRefs.current.set(key, el); autoResize(el) }
                              else textareaRefs.current.delete(key)
                            }}
                          />
                          {renderLinkPromptBar(key, day.date, field)}
                          </>
                        ) : (
                          <div
                            className={styles.mobileDayFieldContent}
                            onClick={() => { if (!isDisabled) setFocusedKey(key) }}
                          >
                            {value ? (
                              <>
                                <ReactMarkdown components={{ ...pillComponents }}>{linkifyText(value)}</ReactMarkdown>
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
                              </>
                            ) : (
                              <span className={styles.mobileDayFieldEmpty}>–</span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {field === "note" && calendarEvents && (
                  <div className={styles.mobileRowGroup}>
                    {getMobileDays().map((day) => {
                      const dayEvents = calendarEvents.filter((e) => e.date <= day.date && e.endDate > day.date)
                      return (
                        <div key={day.date} className={styles.mobileDayField}>
                          <span className={styles.mobileDayFieldLabel}>{t.weekBlock.events}</span>
                          <div className={styles.mobileDayFieldContent}>
                            {dayEvents.length > 0 ? dayEvents.map((e) => (
                              <div key={e.id} className={styles.calEventChip}>
                                {e.color && <span className={styles.calEventDot} style={{ background: e.color }} />}
                                <span className={styles.calEventName}>{e.summary}</span>
                              </div>
                            )) : <span className={styles.mobileDayFieldEmpty}>–</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {field === "note" && custodyEntries && custodyEntries.length > 0 && (
                  <div className={styles.mobileRowGroup}>
                    {getMobileDays().map((day) => {
                      const custodyEntry = custodyEntries.find(c => c.date === day.date)
                      return (
                        <div key={day.date} className={styles.mobileDayField}>
                          <span className={styles.mobileDayFieldLabel}>Emilia</span>
                          <div className={styles.mobileDayFieldIconWrap}>
                            {custodyEntry && (
                              <Baby
                                size={14}
                                strokeWidth={2}
                                className={custodyEntry.location === "WITH_US" ? styles.emiliaIconHome : styles.emiliaIconMona}
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        )}

        {/* Week view — mini-table with all rows */}
        {mobileView === "week" && (
          <div className={styles.mobileWeekTable}>
            {/* Header row: empty label corner + 7 day headers */}
            <div className={styles.mobileWeekTableCorner} />
            {week.days.map((day) => {
              const isToday = day.date === todayDateStr
              const { weekday, day: dayNum } = formatDayHeader(day.date)
              return (
                <div
                  key={day.date}
                  className={`${styles.mobileWeekTableDayHeader} ${isToday ? styles.mobileWeekTableDayHeaderToday : ""}`}
                  onClick={() => setMobileDayDetail(day.date)}
                >
                  <span className={styles.mobileWeekTableWeekday}>{weekday}</span>
                  <span className={`${styles.mobileWeekTableDayNum} ${isToday ? styles.mobileWeekTableDayNumToday : ""}`}>{dayNum}</span>
                </div>
              )
            })}

            {/* Weather row */}
            {weather && (
              <>
                <div className={styles.mobileWeekTableLabel}><Cloud size={11} strokeWidth={2} /></div>
                {week.days.map((day) => {
                  const isToday = day.date === todayDateStr
                  const w = weather[day.date]
                  return (
                    <div
                      key={day.date}
                      className={`${styles.mobileWeekTableCell} ${styles.mobileWeekTableWeatherCell} ${isToday ? styles.mobileWeekTableCellToday : ""}`}
                      onClick={() => setMobileDayDetail(day.date)}
                    >
                      {w && (
                        <>
                          <span className={styles.mobileWeekTableTempText}>{w.low}–{w.high}°</span>
                          <div className={styles.mobileWeekTablePhases}>
                            <WeatherIcon rain={w.morningRain} />
                            <WeatherIcon rain={w.afternoonRain} />
                            <WeatherIcon rain={w.eveningRain} />
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </>
            )}

            {/* Content rows */}
            {ALL_ROWS.map(({ field }) => (
              <Fragment key={field}>
                <div className={styles.mobileWeekTableLabel}>{FIELD_ICON[field]}</div>
                {week.days.map((day) => {
                  const key = `${day.date}:${field}`
                  const isToday = day.date === todayDateStr
                  const value = drafts[key] ?? ""
                  const isDisabled = readOnly || past || saving.has(key)
                  const isFocused = focusedKey === key
                  const isSearching = recipeSearch?.key === key
                  const isMealField = MEAL_FIELDS.has(field)
                  return (
                    <div
                      key={day.date}
                      className={`${styles.mobileWeekTableCell} ${isToday ? styles.mobileWeekTableCellToday : ""}`}
                    >
                      {isSearching ? (
                        <div className={styles.recipeSearchContainer}>
                          <input
                            autoFocus
                            className={styles.recipeSearchInput}
                            value={recipeSearch!.query}
                            placeholder={t.weekBlock.searchMeals}
                            onChange={(e) =>
                              setRecipeSearch((prev) => prev ? { ...prev, query: e.target.value } : null)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                setRecipeSearch((prev) => {
                                  if (prev?.key === key) setDrafts((d) => ({ ...d, [key]: prev.savedText }))
                                  return null
                                })
                              }
                            }}
                            onBlur={() => {
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
                        <textarea
                          autoFocus
                          className={styles.cellInput}
                          value={value}
                          placeholder={rowPlaceholder(field)}
                          disabled={isDisabled}
                          onChange={(e) => {
                            const v = e.target.value
                            if (isMealField && v.trimEnd().endsWith("/")) {
                              const textBeforeCommand = v.trimEnd().slice(0, -1)
                              setFocusedKey(null)
                              setRecipeSearch({ key, query: "", results: [], savedText: textBeforeCommand })
                              return
                            }
                            setDrafts((prev) => ({ ...prev, [key]: v }))
                            autoResize(e.target)
                          }}
                          onBlur={() => handleBlur(day.date, field)}
                          ref={(el) => { if (el) autoResize(el) }}
                        />
                      ) : (
                        <div
                          className={styles.mobileWeekTableCellText}
                          onClick={() => { if (!isDisabled) setFocusedKey(key) }}
                        >
                          {value
                            ? <ReactMarkdown components={{ ...pillComponents }}>{linkifyText(value)}</ReactMarkdown>
                            : <span style={{ opacity: 0.3 }}>–</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
                {field === "note" && calendarEvents && (
                  <>
                    <div className={styles.mobileWeekTableLabel}><Zap size={11} strokeWidth={2} /></div>
                    {week.days.map((day) => {
                      const isToday = day.date === todayDateStr
                      const dayEvents = calendarEvents.filter((e) => e.date <= day.date && e.endDate > day.date)
                      return (
                        <div
                          key={day.date}
                          className={`${styles.mobileWeekTableCell} ${isToday ? styles.mobileWeekTableCellToday : ""}`}
                          onClick={() => setMobileDayDetail(day.date)}
                        >
                          <span className={styles.mobileWeekTableCellText}>
                            {dayEvents.map((e) => e.summary).join(", ")}
                          </span>
                        </div>
                      )
                    })}
                  </>
                )}
                {field === "note" && custodyEntries && custodyEntries.length > 0 && (
                  <>
                    <div className={styles.mobileWeekTableLabel}><Baby size={11} strokeWidth={2} /></div>
                    {week.days.map((day) => {
                      const isToday = day.date === todayDateStr
                      const entry = custodyEntries.find(c => c.date === day.date)
                      return (
                        <div
                          key={day.date}
                          className={`${styles.mobileWeekTableCell} ${styles.mobileWeekTableCustodyCell} ${isToday ? styles.mobileWeekTableCellToday : ""}`}
                          onClick={() => setMobileDayDetail(day.date)}
                        >
                          {entry && (
                            <Baby
                              size={10}
                              strokeWidth={2}
                              className={entry.location === "WITH_US" ? styles.emiliaIconHome : styles.emiliaIconMona}
                            />
                          )}
                        </div>
                      )
                    })}
                  </>
                )}
              </Fragment>
            ))}
          </div>
        )}

        {/* Pill detail modal (tap a pill item) */}
        {mobilePillDetail && (
          <div className={styles.mobileModalBackdrop} onClick={() => setMobilePillDetail(null)}>
            <div className={styles.mobileModal} onClick={e => e.stopPropagation()}>
              <p className={styles.mobileModalFieldValue}>{mobilePillDetail}</p>
              <button className={styles.mobileModalClose} onClick={() => setMobilePillDetail(null)}>{t.weekBlock.close}</button>
            </div>
          </div>
        )}

        {/* Day detail modal (week view tap) */}
        {mobileDayDetail && (() => {
          const day = week.days.find(d => d.date === mobileDayDetail)
          if (!day) return null
          const { weekday, day: dayNum } = formatDayHeader(day.date)
          const w = weather?.[day.date]
          const custodyEntry = custodyEntries?.find(c => c.date === day.date)
          return (
            <div className={styles.mobileModalBackdrop} onClick={() => setMobileDayDetail(null)}>
              <div className={styles.mobileModal} onClick={e => e.stopPropagation()}>
                <div className={styles.mobileModalHeader}>
                  <span className={styles.mobileModalWeekday}>{weekday}</span>
                  <span className={styles.mobileModalDate}>{dayNum}</span>
                </div>
                {w && (
                  <div className={styles.mobileModalWeather}>
                    <span>{w.low}–{w.high}°</span>
                    <WeatherIcon rain={w.afternoonRain} />
                  </div>
                )}
                {ALL_ROWS.map(({ field }) => {
                  const value = drafts[`${day.date}:${field}`] ?? ""
                  if (!value) return null
                  const isMealField = MEAL_FIELDS.has(field)
                  const linkedMealId = isMealField ? mealIds[`${day.date}:${field}`] : null
                  return (
                    <div key={field} className={styles.mobileModalField}>
                      <span className={styles.mobileModalFieldLabel}>{rowLabel(field)}</span>
                      <div className={styles.mobileModalFieldValue}>{value}</div>
                      {linkedMealId && (
                        <a href={`/meals/${linkedMealId}`} target="_blank" rel="noopener noreferrer" className={styles.mealLink}>
                          <ExternalLink size={11} /> {t.weekBlock.viewRecipe}
                        </a>
                      )}
                    </div>
                  )
                })}
                {custodyEntry && (
                  <div className={styles.mobileModalField}>
                    <span className={styles.mobileModalFieldLabel}>Emilia</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <Baby size={14} strokeWidth={2} className={custodyEntry.location === "WITH_US" ? styles.emiliaIconHome : styles.emiliaIconMona} />
                      <span className={styles.mobileModalFieldValue}>{custodyEntry.location === "WITH_US" ? t.weekBlock.withUs : t.weekBlock.withMona}</span>
                    </div>
                  </div>
                )}
                {calendarEvents && calendarEvents.filter((e) => e.date === day.date).length > 0 && (
                  <div className={styles.mobileModalField}>
                    <span className={styles.mobileModalFieldLabel}>{t.weekBlock.events}</span>
                    {calendarEvents.filter((e) => e.date === day.date).map((e) => (
                      <div key={e.id} className={styles.calEventChip}>
                        {e.color && <span className={styles.calEventDot} style={{ background: e.color }} />}
                        <span className={styles.mobileModalFieldValue}>{e.summary}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button className={styles.mobileModalClose} onClick={() => setMobileDayDetail(null)}>{t.weekBlock.close}</button>
              </div>
            </div>
          )
        })()}
      </div>

      {pillTooltip && (
        <div className={styles.pillTooltip} style={{ left: pillTooltip.x, top: pillTooltip.y }}>
          {pillTooltip.text}
        </div>
      )}

      {emojiPicker && typeof document !== "undefined" && createPortal(
        <div
          ref={emojiPickerRef}
          className={styles.emojiPicker}
          style={{ top: emojiPicker.top, left: emojiPicker.left }}
        >
          <div className={styles.emojiCategoryTabs}>
            {EMOJI_CATEGORIES.map((cat, i) => (
              <button
                key={i}
                className={`${styles.emojiCategoryTab} ${activeEmojiCategory === i ? styles.emojiCategoryTabActive : ""}`}
                onMouseDown={(e) => { e.preventDefault(); setActiveEmojiCategory(i) }}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className={styles.emojiGrid}>
            {EMOJI_CATEGORIES[activeEmojiCategory].emojis.map((emoji) => (
              <button
                key={emoji}
                className={styles.emojiBtn}
                title={emoji}
                onMouseDown={(e) => { e.preventDefault(); insertEmoji(emoji, emojiPicker.key, emojiPicker.colonPos) }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
