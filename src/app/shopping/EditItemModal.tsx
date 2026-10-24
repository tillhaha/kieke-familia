// src/app/shopping/EditItemModal.tsx
"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./shopping.module.css"
import { SHOPPING_TAGS, type ShoppingTag } from "@/lib/shoppingTags"

type Category = { id: string; name: string; order: number }
export type EditableItem = { id: string; name: string; quantity: string | null; categoryId: string | null; tags: ShoppingTag[] }
export type ItemChanges = { name?: string; quantity?: string | null; categoryId?: string | null; tags?: ShoppingTag[] }

type Props = {
  item: EditableItem
  categories: Category[]
  onClose: () => void
  onSave: (changes: ItemChanges) => Promise<boolean>
}

export default function EditItemModal({ item, categories, onClose, onSave }: Props) {
  const { t } = useTranslation()
  const [qty, setQty] = useState(item.quantity ?? "")
  const [name, setName] = useState(item.name)
  const [categoryId, setCategoryId] = useState(item.categoryId ?? "")
  const [tags, setTags] = useState<ShoppingTag[]>(item.tags)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    // Only send what changed — a categoryId in the body overwrites the remembered mapping
    const changes: ItemChanges = {}
    if (name.trim() !== item.name) changes.name = name.trim()
    if ((qty.trim() || null) !== item.quantity) changes.quantity = qty.trim() || null
    if ((categoryId || null) !== item.categoryId) changes.categoryId = categoryId || null
    if (tags.length !== item.tags.length || tags.some((tag) => !item.tags.includes(tag))) changes.tags = tags
    if (Object.keys(changes).length === 0) {
      onClose()
      return
    }

    setSaving(true)
    setError("")
    const ok = await onSave(changes)
    setSaving(false)
    if (ok) onClose()
    else setError(t.shopping.failedToSave)
  }

  return (
    <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className={styles.modal} onSubmit={handleSave}>
        <h2 className={styles.modalTitle}>{t.shopping.editItem}</h2>

        <div className={styles.modalRow}>
          <label className={styles.modalField} style={{ flex: "0 0 96px" }}>
            <span className={styles.modalLabel}>{t.shopping.qty}</span>
            <input className={styles.modalInput} value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          <label className={styles.modalField}>
            <span className={styles.modalLabel}>{t.shopping.itemName}</span>
            <input
              className={styles.modalInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              autoComplete="off"
            />
          </label>
        </div>

        <label className={styles.modalField}>
          <span className={styles.modalLabel}>{t.shopping.category}</span>
          <select className={styles.modalInput} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">{t.shopping.other}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <div className={styles.modalField}>
          <span className={styles.modalLabel}>{t.shopping.tags}</span>
          <div className={styles.modalTags}>
            {SHOPPING_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`${styles.tagFilterPill} ${tags.includes(tag) ? styles.tagFilterPillActive : ""}`}
                onClick={() => setTags((prev) => prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag])}
                aria-pressed={tags.includes(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {error && <p className={styles.addError}>{error}</p>}

        <div className={styles.modalFooter}>
          <button type="button" className={styles.modalCancelBtn} onClick={onClose}>{t.shopping.cancel}</button>
          <button type="submit" className={styles.addBtn} disabled={saving || !name.trim()}>{t.shopping.save}</button>
        </div>
      </form>
    </div>
  )
}
