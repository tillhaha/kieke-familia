// src/app/shopping/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect, useRef, useMemo } from "react"
import { Plus, X, Settings } from "lucide-react"
import styles from "./shopping.module.css"

type Category = { id: string; name: string; order: number }
type ShoppingItem = { id: string; name: string; quantity: string | null; categoryId: string | null; category: Category | null }
type BlacklistTerm = { id: string; term: string }

export default function ShoppingPage() {
  const { status } = useSession()
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [blacklist, setBlacklist] = useState<BlacklistTerm[]>([])
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

  // Manage panel
  const [clearing, setClearing] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [newBlacklistTerm, setNewBlacklistTerm] = useState("")
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingCatName, setEditingCatName] = useState("")

  useEffect(() => {
    if (status !== "authenticated") return
    Promise.all([
      fetch("/api/shopping/categories").then((r) => r.json()),
      fetch("/api/shopping/items").then((r) => r.json()),
      fetch("/api/shopping/blacklist").then((r) => r.json()),
    ]).then(([catData, itemData, blData]) => {
      setCategories(catData.categories ?? [])
      setItems(itemData.items ?? [])
      setBlacklist(blData.terms ?? [])
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

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    try {
      const res = await fetch("/api/shopping/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setCategories((prev) => [...prev, data])
        setNewCatName("")
      }
    } catch { /* ignore */ }
  }

  const handleRenameCategory = async (id: string) => {
    if (!editingCatName.trim()) return
    try {
      const res = await fetch(`/api/shopping/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingCatName.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setCategories((prev) => prev.map((c) => c.id === id ? data : c))
        setEditingCatId(null)
        setEditingCatName("")
      }
    } catch { /* ignore */ }
  }

  const handleDeleteCategory = async (id: string) => {
    const prevCategories = categories
    const prevItems = items
    setCategories((prev) => prev.filter((c) => c.id !== id))
    setItems((prev) => prev.map((i) => i.categoryId === id ? { ...i, categoryId: null, category: null } : i))
    try {
      const res = await fetch(`/api/shopping/categories/${id}`, { method: "DELETE" })
      if (!res.ok) {
        setCategories(prevCategories)
        setItems(prevItems)
      }
    } catch {
      setCategories(prevCategories)
      setItems(prevItems)
    }
  }

  const handleAddBlacklist = async () => {
    if (!newBlacklistTerm.trim()) return
    try {
      const res = await fetch("/api/shopping/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: newBlacklistTerm.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setBlacklist((prev) => [...prev, data])
        setNewBlacklistTerm("")
      }
    } catch { /* ignore */ }
  }

  const handleDeleteBlacklist = async (id: string) => {
    setBlacklist((prev) => prev.filter((t) => t.id !== id))
    await fetch(`/api/shopping/blacklist/${id}`, { method: "DELETE" })
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
        <button className={styles.manageBtn} onClick={() => setManageOpen((v) => !v)}>
          <Settings size={13} strokeWidth={2} />
          {manageOpen ? "Close" : "Manage"}
        </button>
      </div>

      {/* Manage panel */}
      {manageOpen && (
        <div className={styles.managePanel}>
          {/* Categories */}
          <div className={styles.manageSection}>
            <div className={styles.manageSectionTitle}>Categories</div>
            <div className={styles.manageList}>
              {categories.map((cat) => (
                <div key={cat.id} className={styles.manageRow}>
                  {editingCatId === cat.id ? (
                    <>
                      <input
                        className={styles.manageInput}
                        value={editingCatName}
                        autoFocus
                        onChange={(e) => setEditingCatName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRenameCategory(cat.id) }}
                      />
                      <button className={styles.manageSaveBtn} onClick={() => handleRenameCategory(cat.id)}>Save</button>
                      <button className={styles.manageDeleteBtn} aria-label="Cancel rename" onClick={() => { setEditingCatId(null); setEditingCatName("") }}><X size={13} /></button>
                    </>
                  ) : (
                    <>
                      <span className={styles.manageRowName}>{cat.name}</span>
                      <button className={styles.manageSaveBtn} onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name) }}>Rename</button>
                      <button className={styles.manageDeleteBtn} aria-label="Delete category" onClick={() => handleDeleteCategory(cat.id)}><X size={13} /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className={styles.manageAddRow}>
              <input
                className={styles.manageInput}
                placeholder="New category…"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddCategory() }}
              />
              <button className={styles.manageSaveBtn} onClick={handleAddCategory}>Add</button>
            </div>
          </div>

          {/* Blacklist */}
          <div className={styles.manageSection}>
            <div className={styles.manageSectionTitle}>Blacklist (excluded from Generate)</div>
            <div className={styles.manageList}>
              {blacklist.map((entry) => (
                <div key={entry.id} className={styles.manageRow}>
                  <span className={styles.manageRowName}>{entry.term}</span>
                  <button className={styles.manageDeleteBtn} aria-label="Remove from blacklist" onClick={() => handleDeleteBlacklist(entry.id)}><X size={13} /></button>
                </div>
              ))}
            </div>
            <div className={styles.manageAddRow}>
              <input
                className={styles.manageInput}
                placeholder="New term…"
                value={newBlacklistTerm}
                onChange={(e) => setNewBlacklistTerm(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddBlacklist() }}
              />
              <button className={styles.manageSaveBtn} onClick={handleAddBlacklist}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
