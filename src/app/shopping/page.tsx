// src/app/shopping/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect, useRef, useMemo } from "react"
import { Plus, X } from "lucide-react"
import styles from "./shopping.module.css"

type Category = { id: string; name: string; order: number }
type ShoppingItem = { id: string; name: string; quantity: string | null; categoryId: string | null; category: Category | null }

export default function ShoppingPage() {
  const { status } = useSession()
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [loading, setLoading] = useState(true)

  // Add form
  const [qty, setQty] = useState("")
  const [name, setName] = useState("")
  // categoryId is the user's explicit selection; "" means "use memory suggestion or none"
  const [categoryId, setCategoryId] = useState("")
  const [addError, setAddError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Inline category reassign
  const [editingCategoryFor, setEditingCategoryFor] = useState<string | null>(null)

  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    if (status !== "authenticated") return
    Promise.all([
      fetch("/api/shopping/categories").then((r) => r.json()),
      fetch("/api/shopping/items").then((r) => r.json()),
    ]).then(([catData, itemData]) => {
      setCategories(catData.categories ?? [])
      setItems(itemData.items ?? [])
    }).finally(() => setLoading(false))
  }, [status])

  // Memory lookup: item name → categoryId (derived, no setState needed)
  const memory = useMemo(() => {
    const m: Record<string, string> = {}
    for (const item of items) {
      if (item.categoryId) m[item.name.toLowerCase()] = item.categoryId
    }
    return m
  }, [items])

  // Effective category: user's explicit pick, or memory suggestion for current name
  const effectiveCategoryId = useMemo(() => {
    if (categoryId) return categoryId
    const key = name.trim().toLowerCase()
    return (key && memory[key]) ? memory[key] : ""
  }, [categoryId, name, memory])

  const handleAdd = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!name.trim()) return
    setAddError(null)

    const optimisticItem: ShoppingItem = {
      id: `optimistic-${Date.now()}`,
      name: name.trim(),
      quantity: qty.trim() || null,
      categoryId: effectiveCategoryId || null,
      category: categories.find((c) => c.id === effectiveCategoryId) ?? null,
    }
    setItems((prev) => [...prev, optimisticItem])

    const savedQty = qty
    const savedName = name
    const savedCatId = effectiveCategoryId
    setQty("")
    setName("")
    setCategoryId("")
    nameInputRef.current?.focus()

    try {
      const res = await fetch("/api/shopping/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: savedName.trim(), quantity: savedQty.trim() || undefined, categoryId: savedCatId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== optimisticItem.id))
        setAddError(data.error ?? "Failed to add item")
        return
      }
      setItems((prev) => prev.map((i) => (i.id === optimisticItem.id ? data : i)))
    } catch {
      setItems((prev) => prev.filter((i) => i.id !== optimisticItem.id))
      setAddError("Failed to add item")
    }
  }

  const handleDelete = async (id: string) => {
    const removedIndex = items.findIndex((i) => i.id === id)
    const removed = items[removedIndex]
    setItems((prev) => prev.filter((i) => i.id !== id))
    try {
      const res = await fetch(`/api/shopping/items/${id}`, { method: "DELETE" })
      if (!res.ok && removed) {
        setItems((prev) => {
          const next = [...prev]
          next.splice(removedIndex, 0, removed)
          return next
        })
      }
    } catch {
      if (removed) {
        setItems((prev) => {
          const next = [...prev]
          next.splice(removedIndex, 0, removed)
          return next
        })
      }
    }
  }

  const handleCategoryChange = async (itemId: string, newCategoryId: string) => {
    setEditingCategoryFor(null)
    const oldItem = items.find((i) => i.id === itemId)
    const newCat = categories.find((c) => c.id === newCategoryId) ?? null
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, categoryId: newCategoryId || null, category: newCat } : i))
    try {
      const res = await fetch(`/api/shopping/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: newCategoryId || null }),
      })
      if (!res.ok && oldItem) setItems((prev) => prev.map((i) => i.id === itemId ? oldItem : i))
    } catch {
      if (oldItem) setItems((prev) => prev.map((i) => i.id === itemId ? oldItem : i))
    }
  }

  async function handleClearList() {
    const prev = items
    setItems([])
    setClearing(true)
    try {
      const res = await fetch("/api/shopping/items", { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
    } catch {
      setItems(prev)
    } finally {
      setClearing(false)
    }
  }

  // Group items by category
  const grouped = (() => {
    const catMap = new Map<string | null, ShoppingItem[]>()
    for (const item of items) {
      const key = item.categoryId ?? null
      if (!catMap.has(key)) catMap.set(key, [])
      catMap.get(key)!.push(item)
    }
    const result: { category: Category | null; items: ShoppingItem[] }[] = []
    for (const cat of categories) {
      const catItems = catMap.get(cat.id)
      if (catItems?.length) result.push({ category: cat, items: catItems })
    }
    const uncategorized = catMap.get(null)
    if (uncategorized?.length) result.push({ category: null, items: uncategorized })
    return result
  })()

  if (status === "loading" || loading) return null

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Shopping List</h1>
      </div>

      {/* Add form */}
      <form className={styles.addForm} onSubmit={handleAdd}>
        <input
          className={styles.qtyInput}
          placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <input
          ref={nameInputRef}
          className={styles.nameInput}
          placeholder="Add item…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
        <select
          className={styles.categorySelect}
          value={effectiveCategoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button type="submit" className={styles.addBtn} disabled={!name.trim()}>
          <Plus size={14} strokeWidth={2.5} />
          Add
        </button>
      </form>
      {addError && <p className={styles.addError}>{addError}</p>}

      {/* Item list */}
      {items.length === 0 ? (
        <p className={styles.emptyState}>No items yet. Add something above.</p>
      ) : (
        <div className={styles.list}>
          {grouped.map(({ category, items: groupItems }) => (
            <div key={category?.id ?? "uncategorized"} className={styles.group}>
              <div className={styles.groupLabel}>{category?.name ?? "Other"}</div>
              <div className={styles.groupItems}>
                {groupItems.map((item) => (
                  <div key={item.id} className={styles.item}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      onChange={() => handleDelete(item.id)}
                    />
                    {item.quantity && <span className={styles.itemQty}>{item.quantity}</span>}
                    <span className={styles.itemName}>{item.name}</span>
                    {editingCategoryFor === item.id ? (
                      <select
                        className={styles.categoryPillSelect}
                        value={item.categoryId ?? ""}
                        autoFocus
                        onBlur={() => setEditingCategoryFor(null)}
                        onChange={(e) => handleCategoryChange(item.id, e.target.value)}
                      >
                        <option value="">Other</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        className={styles.categoryPill}
                        onClick={() => setEditingCategoryFor(item.id)}
                        title="Change category"
                      >
                        {item.category?.name ?? "Other"}
                      </button>
                    )}
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(item.id)}
                      aria-label="Remove item"
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        <button
          className={styles.clearBtn}
          onClick={handleClearList}
          disabled={clearing || items.length === 0}
        >
          Clear list
        </button>
      </div>
    </div>
  )
}
