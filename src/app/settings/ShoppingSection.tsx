"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./settings.module.css"
import shopStyles from "../shopping/shopping.module.css"

type Category = { id: string; name: string; order: number }
type BlacklistTerm = { id: string; term: string }

export function ShoppingSection() {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<Category[]>([])
  const [blacklist, setBlacklist] = useState<BlacklistTerm[]>([])
  const [loading, setLoading] = useState(true)

  const [newCatName, setNewCatName] = useState("")
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingCatName, setEditingCatName] = useState("")
  const [newBlacklistTerm, setNewBlacklistTerm] = useState("")

  useEffect(() => {
    Promise.all([
      fetch("/api/shopping/categories").then((r) => r.json()),
      fetch("/api/shopping/blacklist").then((r) => r.json()),
    ]).then(([catData, blData]) => {
      setCategories(catData.categories ?? [])
      setBlacklist(blData.terms ?? [])
    }).finally(() => setLoading(false))
  }, [])

  async function handleAddCategory() {
    if (!newCatName.trim()) return
    const res = await fetch("/api/shopping/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName.trim() }),
    })
    const data = await res.json()
    if (res.ok) { setCategories((prev) => [...prev, data]); setNewCatName("") }
  }

  async function handleRenameCategory(id: string) {
    if (!editingCatName.trim()) return
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
  }

  async function handleDeleteCategory(id: string) {
    setCategories((prev) => prev.filter((c) => c.id !== id))
    await fetch(`/api/shopping/categories/${id}`, { method: "DELETE" })
  }

  async function handleAddBlacklist() {
    if (!newBlacklistTerm.trim()) return
    const res = await fetch("/api/shopping/blacklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: newBlacklistTerm.trim() }),
    })
    const data = await res.json()
    if (res.ok) { setBlacklist((prev) => [...prev, data]); setNewBlacklistTerm("") }
  }

  async function handleDeleteBlacklist(id: string) {
    setBlacklist((prev) => prev.filter((t) => t.id !== id))
    await fetch(`/api/shopping/blacklist/${id}`, { method: "DELETE" })
  }

  if (loading) return <p className={styles.spinner}>{t.settings.loading}</p>

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.settings.shopping}</h2>

      <h3 className={styles.subTitle}>{t.settings.categoriesTitle}</h3>
      <div className={shopStyles.manageList}>
        {categories.map((cat) => (
          <div key={cat.id} className={shopStyles.manageRow}>
            {editingCatId === cat.id ? (
              <>
                <input
                  className={shopStyles.manageInput}
                  value={editingCatName}
                  autoFocus
                  onChange={(e) => setEditingCatName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRenameCategory(cat.id) }}
                />
                <button className={shopStyles.manageSaveBtn} onClick={() => handleRenameCategory(cat.id)}>{t.settings.save}</button>
                <button className={shopStyles.manageDeleteBtn} aria-label={t.settings.cancel} onClick={() => { setEditingCatId(null); setEditingCatName("") }}><X size={13} /></button>
              </>
            ) : (
              <>
                <span className={shopStyles.manageRowName}>{cat.name}</span>
                <button className={shopStyles.manageSaveBtn} onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name) }}>{t.settings.rename}</button>
                <button className={shopStyles.manageDeleteBtn} aria-label={t.settings.remove} onClick={() => handleDeleteCategory(cat.id)}><X size={13} /></button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className={shopStyles.manageAddRow}>
        <input
          className={shopStyles.manageInput}
          placeholder={t.settings.newCategoryPlaceholder}
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAddCategory() }}
        />
        <button className={shopStyles.manageSaveBtn} onClick={handleAddCategory}>{t.settings.add}</button>
      </div>

      <h3 className={styles.subTitle}>{t.settings.blacklistTitle}</h3>
      <p className={styles.sectionDesc}>{t.settings.blacklistDesc}</p>
      <div className={shopStyles.manageList}>
        {blacklist.map((entry) => (
          <div key={entry.id} className={shopStyles.manageRow}>
            <span className={shopStyles.manageRowName}>{entry.term}</span>
            <button className={shopStyles.manageDeleteBtn} aria-label={t.settings.remove} onClick={() => handleDeleteBlacklist(entry.id)}><X size={13} /></button>
          </div>
        ))}
      </div>
      <div className={shopStyles.manageAddRow}>
        <input
          className={shopStyles.manageInput}
          placeholder={t.settings.newTermPlaceholder}
          value={newBlacklistTerm}
          onChange={(e) => setNewBlacklistTerm(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAddBlacklist() }}
        />
        <button className={shopStyles.manageSaveBtn} onClick={handleAddBlacklist}>{t.settings.add}</button>
      </div>
    </div>
  )
}
