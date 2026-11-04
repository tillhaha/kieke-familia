// src/app/thoughts/CategoriesModal.tsx
// Manage the user's own categories/projects for the private todo list: add,
// rename (renaming onto an existing name merges), describe and delete. The
// descriptions tell the thoughts assistant what belongs in each category.
"use client"

import { useState, useEffect } from "react"
import { Trash2, X } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./thoughts.module.css"
import { Button } from "@/components/ui/Button"

export type CategoryDef = { id: string; name: string; description: string | null; count: number }

type Props = {
  categories: CategoryDef[]
  onChanged: () => Promise<void>
  onClose: () => void
}

export function CategoriesModal({ categories, onChanged, onClose }: Props) {
  const { t } = useTranslation()
  const tt = t.thoughts
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  async function run(action: () => Promise<Response>, conflictMessage?: string): Promise<boolean> {
    setBusy(true)
    setError("")
    try {
      const r = await action()
      if (r.status === 409 && conflictMessage) {
        setError(conflictMessage)
        return false
      }
      if (!r.ok) throw new Error()
      await onChanged()
      return true
    } catch {
      setError(tt.failed)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const ok = await run(
      () =>
        fetch("/api/personal-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName, description: newDesc }),
        }),
      tt.categoryExists
    )
    if (ok) {
      setNewName("")
      setNewDesc("")
    }
  }

  function update(id: string, data: { name?: string; description?: string }) {
    return run(() =>
      fetch(`/api/personal-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    )
  }

  function remove(cat: CategoryDef) {
    if (cat.count > 0 && !window.confirm(tt.deleteCategoryConfirm.replace("{name}", cat.name).replace("{n}", String(cat.count)))) return
    return run(() => fetch(`/api/personal-categories/${cat.id}`, { method: "DELETE" }))
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.catModal}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.catModalHeader}>
          <h2 className={styles.modalTitle}>{tt.categoriesTitle}</h2>
          <button className={styles.iconBtn} onClick={onClose} aria-label={tt.close}>
            <X size={16} />
          </button>
        </div>
        <p className={styles.subtitle}>{tt.categoriesHint}</p>

        <form className={styles.catAdd} onSubmit={add}>
          <input
            className={styles.input}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={tt.categoryNamePlaceholder}
            maxLength={40}
            autoFocus
          />
          <input
            className={styles.input}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder={tt.categoryDescriptionPlaceholder}
            maxLength={300}
          />
          <Button type="submit" variant="primary" className={styles.catAddBtn} disabled={busy || !newName.trim()}>
            {tt.addCategory}
          </Button>
        </form>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.catList}>
          {categories.map((cat) => (
            <CategoryRow key={cat.id} cat={cat} busy={busy} onSave={(data) => update(cat.id, data)} onDelete={() => remove(cat)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function CategoryRow({
  cat,
  busy,
  onSave,
  onDelete,
}: {
  cat: CategoryDef
  busy: boolean
  onSave: (data: { name?: string; description?: string }) => Promise<boolean>
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const tt = t.thoughts
  const [name, setName] = useState(cat.name)
  const [desc, setDesc] = useState(cat.description ?? "")
  const nameChanged = name.trim() !== cat.name
  const descChanged = desc.trim() !== (cat.description ?? "")

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || (!nameChanged && !descChanged)) return
    onSave({ ...(nameChanged ? { name } : {}), ...(descChanged ? { description: desc } : {}) })
  }

  return (
    <form className={styles.catRow} onSubmit={save}>
      <div className={styles.catRowFields}>
        <div className={styles.catRowTop}>
          <input className={`${styles.input} ${styles.catNameInput}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          <span className={styles.catCount}>{cat.count}</span>
        </div>
        <input
          className={`${styles.input} ${styles.catDescInput}`}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={tt.categoryDescriptionPlaceholder}
          maxLength={300}
        />
      </div>
      <div className={styles.catRowActions}>
        {(nameChanged || descChanged) && (
          <Button type="submit" variant="primary" size="sm" disabled={busy || !name.trim()}>
            {tt.save}
          </Button>
        )}
        <button type="button" className={styles.iconBtn} onClick={onDelete} disabled={busy} aria-label={tt.delete} title={tt.delete}>
          <Trash2 size={15} />
        </button>
      </div>
    </form>
  )
}
