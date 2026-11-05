// src/app/shopping/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Pencil, Plus, X, ShoppingCart, CloudOff, RefreshCw, EyeOff } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./shopping.module.css"
import { EmptyState } from "@/components/ui/EmptyState"
import { Page } from "@/components/ui/Page"
import { Button } from "@/components/ui/Button"
import { PageHeader } from "@/components/ui/PageHeader"
import { FilterPill } from "@/components/ui/FilterPill"
import { categoryLabel } from "@/lib/shoppingCategories"
import EditItemModal, { type ItemChanges } from "./EditItemModal"
import { SHOPPING_TAGS, type ShoppingTag } from "@/lib/shoppingTags"
import {
  TEMP_PREFIX,
  applyOutbox,
  cancelPendingAdd,
  enqueue,
  loadCache,
  loadOutbox,
  newId,
  removeOp,
  saveCache,
  type OutboxOp,
} from "@/lib/shoppingOffline"

type Category = { id: string; name: string; order: number }
type AddOp = Extract<OutboxOp, { kind: "add" }>
type ShoppingItem = { id: string; name: string; quantity: string | null; categoryId: string | null; category: Category | null; tags: ShoppingTag[] }

export default function ShoppingPage() {
  const { data: session, status } = useSession()
  const { t } = useTranslation()
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [loading, setLoading] = useState(true)

  // Add form
  const [qty, setQty] = useState("")
  const [name, setName] = useState("")
  const [addError, setAddError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Tag filter — while active, only tagged items are shown and new items get the tag
  // Tag pills cycle: off → only this tag → hide this tag → off. Several tags
  // can be hidden at once (e.g. skip Drogerie + Asia in the supermarket).
  const [tagFilter, setTagFilter] = useState<ShoppingTag | null>(null)
  const [hiddenTags, setHiddenTags] = useState<ShoppingTag[]>([])
  const visibleItems = tagFilter
    ? items.filter((i) => i.tags.includes(tagFilter))
    : items.filter((i) => !i.tags.some((tag) => hiddenTags.includes(tag)))

  const cycleTag = (tag: ShoppingTag) => {
    if (tagFilter === tag) {
      setTagFilter(null)
      setHiddenTags((prev) => [...prev, tag])
    } else if (hiddenTags.includes(tag)) {
      setHiddenTags((prev) => prev.filter((x) => x !== tag))
    } else {
      setTagFilter(tag)
      setHiddenTags((prev) => prev.filter((x) => x !== tag))
    }
  }

  // Edit modal
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const editingItem = items.find((i) => i.id === editingItemId) ?? null

  const [clearing, setClearing] = useState(false)

  // ── Offline sync (see src/lib/shoppingOffline.ts) ─────────────
  // Every add / check-off goes into a per-user outbox first and the list
  // updates immediately; the outbox is replayed in order whenever the
  // connection is back. The last server list is cached for offline use.
  const userId = session?.user?.id ?? null
  const [online, setOnline] = useState(true)
  const [connectionProblem, setConnectionProblem] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const flushingRef = useRef(false)
  const inFlightTempId = useRef<string | null>(null)
  const cancelledTempIds = useRef(new Set<string>())
  const categoriesRef = useRef<Category[]>([])

  const opToItem = useCallback((op: AddOp): ShoppingItem => ({
    id: op.tempId,
    name: op.name,
    quantity: op.quantity,
    categoryId: op.categoryId,
    category: categoriesRef.current.find((c) => c.id === op.categoryId) ?? null,
    tags: op.tags as ShoppingTag[],
  }), [])

  const refreshPending = useCallback(() => {
    if (userId) setPendingCount(loadOutbox(userId).length)
  }, [userId])

  // Server list + pending local changes on top; refreshes the offline cache
  const fetchList = useCallback(async (): Promise<boolean> => {
    if (!userId) return false
    try {
      const [catRes, itemRes] = await Promise.all([fetch("/api/shopping/categories"), fetch("/api/shopping/items")])
      if (!catRes.ok || !itemRes.ok) return false
      const [catData, itemData] = await Promise.all([catRes.json(), itemRes.json()])
      const cats: Category[] = catData.categories ?? []
      const serverItems: ShoppingItem[] = itemData.items ?? []
      categoriesRef.current = cats
      setCategories(cats)
      setItems(applyOutbox(serverItems, loadOutbox(userId), opToItem))
      saveCache(userId, serverItems, cats)
      setConnectionProblem(false)
      return true
    } catch {
      setConnectionProblem(true)
      return false
    }
  }, [userId, opToItem])

  // Replay the outbox in order; stops at the first network/server failure
  const flush = useCallback(async () => {
    if (!userId || flushingRef.current) return
    flushingRef.current = true
    let synced = false
    try {
      for (;;) {
        const op = loadOutbox(userId)[0]
        if (!op) break
        if (op.kind === "add") inFlightTempId.current = op.tempId
        let res: Response
        try {
          res = op.kind === "add"
            ? await fetch("/api/shopping/items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: op.name, quantity: op.quantity ?? undefined, categoryId: op.categoryId ?? undefined, tags: op.tags }),
              })
            : await fetch(`/api/shopping/items/${op.itemId}`, { method: "DELETE" })
        } catch {
          setConnectionProblem(true) // still offline — retried later
          break
        } finally {
          inFlightTempId.current = null
        }
        if (res.status >= 500 || res.status === 401) break // server trouble / signed out — retry later
        setConnectionProblem(false)
        removeOp(userId, op.opId)
        synced = true
        if (op.kind === "add") {
          if (res.ok) {
            const created: ShoppingItem = await res.json()
            if (cancelledTempIds.current.delete(op.tempId)) {
              // checked off while it was being sent → remove it on the server too
              enqueue(userId, { opId: newId(), kind: "delete", itemId: created.id })
            } else {
              setItems((prev) => prev.map((i) => (i.id === op.tempId ? created : i)))
            }
          } else {
            const data = await res.json().catch(() => ({}))
            setItems((prev) => prev.filter((i) => i.id !== op.tempId))
            setAddError(data.error ?? t.shopping.failedToAdd)
          }
        }
        // delete: ok, or 404 = already gone → done either way
      }
    } finally {
      flushingRef.current = false
      refreshPending()
    }
    if (synced && loadOutbox(userId).length === 0) await fetchList()
  }, [userId, fetchList, refreshPending, t])

  // Initial load: cached list first (instant, works offline), then the server
  useEffect(() => {
    if (status !== "authenticated" || !userId) return
    const cache = loadCache<ShoppingItem, Category>(userId)
    if (cache) {
      categoriesRef.current = cache.categories
      setCategories(cache.categories)
      setItems(applyOutbox(cache.items, loadOutbox(userId), opToItem))
      setLoading(false)
    }
    refreshPending()
    fetchList().finally(() => {
      setLoading(false)
      flush()
    })
  }, [status, userId, fetchList, flush, opToItem, refreshPending])

  // Sync when the connection comes back, when the app returns to the
  // foreground, and periodically while changes are waiting
  useEffect(() => {
    if (!userId) return
    const sync = async () => {
      setOnline(navigator.onLine)
      if (!navigator.onLine) return
      await flush()
      if (loadOutbox(userId).length === 0) await fetchList()
    }
    const onVisible = () => { if (document.visibilityState === "visible") sync() }
    setOnline(navigator.onLine)
    window.addEventListener("online", sync)
    window.addEventListener("offline", sync)
    document.addEventListener("visibilitychange", onVisible)
    const timer = window.setInterval(() => { if (loadOutbox(userId).length > 0) flush() }, 15000)
    return () => {
      window.removeEventListener("online", sync)
      window.removeEventListener("offline", sync)
      document.removeEventListener("visibilitychange", onVisible)
      window.clearInterval(timer)
    }
  }, [userId, flush, fetchList])

  // Remove an item locally and queue the server delete
  const queueRemoval = (id: string) => {
    if (!userId) return
    if (id.startsWith(TEMP_PREFIX)) {
      // added offline: drop the pending add, or delete it right after it lands
      if (inFlightTempId.current === id) cancelledTempIds.current.add(id)
      else cancelPendingAdd(userId, id)
    } else {
      enqueue(userId, { opId: newId(), kind: "delete", itemId: id })
    }
  }

  const memory = useMemo(() => {
    const m: Record<string, string> = {}
    for (const item of items) {
      if (item.categoryId) m[item.name.toLowerCase()] = item.categoryId
    }
    return m
  }, [items])

  // Items already on the list are placed right away; anything else is
  // categorised by the server (remembered mapping, then AI)
  const effectiveCategoryId = useMemo(() => {
    const key = name.trim().toLowerCase()
    return (key && memory[key]) ? memory[key] : ""
  }, [name, memory])

  const handleAdd = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!name.trim() || !userId) return
    setAddError(null)
    const op: AddOp = {
      opId: newId(),
      kind: "add",
      tempId: newId(TEMP_PREFIX),
      name: name.trim(),
      quantity: qty.trim() || null,
      categoryId: effectiveCategoryId || null,
      tags: tagFilter ? [tagFilter] : [],
    }
    enqueue(userId, op)
    setItems((prev) => [...prev, opToItem(op)])
    setQty("")
    setName("")
    nameInputRef.current?.focus()
    refreshPending()
    flush()
  }

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    queueRemoval(id)
    refreshPending()
    flush()
  }

  const handleEditSave = async (itemId: string, changes: ItemChanges): Promise<boolean> => {
    try {
      const res = await fetch(`/api/shopping/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      })
      if (!res.ok) return false
      const updated: ShoppingItem = await res.json()
      setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)))
      return true
    } catch {
      return false
    }
  }

  // Clears what this device shows (queued like single check-offs, so it works offline)
  async function handleClearList() {
    const current = items
    setItems([])
    setClearing(true)
    current.forEach((i) => queueRemoval(i.id))
    refreshPending()
    await flush()
    setClearing(false)
  }

  const grouped = (() => {
    const catMap = new Map<string | null, ShoppingItem[]>()
    for (const item of visibleItems) {
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
    <Page width="narrow">
      <PageHeader title={t.shopping.title} />

      {(!online || connectionProblem || pendingCount > 0) && (
        <div className={styles.syncBanner} role="status">
          {!online || connectionProblem
            ? <CloudOff size={15} strokeWidth={2} />
            : <RefreshCw size={15} strokeWidth={2} className={styles.syncSpin} />}
          <span>
            {!online || connectionProblem ? t.shopping.offlineNotice : null}
            {pendingCount > 0 && (
              <>
                {!online || connectionProblem ? " " : null}
                <strong>{t.shopping.pendingSync.replace("{n}", String(pendingCount))}</strong>
              </>
            )}
          </span>
        </div>
      )}

      <form className={styles.addForm} onSubmit={handleAdd}>
        <input
          className={styles.qtyInput}
          placeholder={t.shopping.qty}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <input
          ref={nameInputRef}
          className={styles.nameInput}
          placeholder={t.shopping.addItemPlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
        <Button type="submit" variant="primary" icon={<Plus size={15} strokeWidth={2.5} />} disabled={!name.trim()}>
          {t.shopping.add}
        </Button>
      </form>
      {addError && <p className={styles.addError}>{addError}</p>}

      <div className={styles.tagFilter}>
        <FilterPill
          active={tagFilter === null && hiddenTags.length === 0}
          onClick={() => { setTagFilter(null); setHiddenTags([]) }}
        >
          {t.shopping.allItems}
        </FilterPill>
        {SHOPPING_TAGS.map((tag) => {
          const hidden = hiddenTags.includes(tag)
          return (
            <FilterPill
              key={tag}
              active={tagFilter === tag}
              className={hidden ? styles.tagHidden : undefined}
              icon={hidden ? <EyeOff size={13} strokeWidth={2} /> : undefined}
              count={items.filter((i) => i.tags.includes(tag)).length}
              onClick={() => cycleTag(tag)}
              aria-pressed={tagFilter === tag ? true : hidden ? "mixed" : false}
              title={hidden ? t.shopping.tagHiddenHint.replace("{tag}", tag) : tagFilter === tag ? t.shopping.tagOnlyHint.replace("{tag}", tag) : undefined}
            >
              {tag}
            </FilterPill>
          )
        })}
      </div>

      {visibleItems.length === 0 ? (
        <EmptyState icon={<ShoppingCart size={22} strokeWidth={1.75} />}>{tagFilter ? t.shopping.noItemsWithTag : t.shopping.noItems}</EmptyState>
      ) : (
        <div className={styles.list}>
          {grouped.map(({ category, items: groupItems }) => (
            <div key={category?.id ?? "uncategorized"} className={styles.group}>
              <div className={styles.groupLabel}>{category ? categoryLabel(category.name, t) : t.shopping.other}</div>
              <div className={styles.groupItems}>
                {groupItems.map((item) => (
                  <div key={item.id} className={styles.item}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      onChange={() => handleDelete(item.id)}
                    />
                    {item.quantity && <span className={styles.itemQty}>{item.quantity}</span>}
                    <button
                      type="button"
                      className={styles.itemName}
                      onClick={() => setEditingItemId(item.id)}
                      disabled={item.id.startsWith(TEMP_PREFIX)}
                      title={t.shopping.editItem}
                    >
                      {item.name}
                    </button>
                    {item.tags.map((tag) => (
                      <span key={tag} className={styles.tagChip}>{tag}</span>
                    ))}
                    <button
                      className={styles.editBtn}
                      onClick={() => setEditingItemId(item.id)}
                      aria-label={t.shopping.editItem}
                      title={t.shopping.editItem}
                      disabled={item.id.startsWith(TEMP_PREFIX)}
                    >
                      <Pencil size={14} strokeWidth={2} />
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(item.id)}
                      aria-label={t.shopping.removeItem}
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

      <div className={styles.footer}>
        <Button variant="danger" size="sm" onClick={handleClearList} disabled={clearing || items.length === 0}>
          {t.shopping.clearList}
        </Button>
      </div>

      {editingItem && (
        <EditItemModal
          item={editingItem}
          categories={categories}
          onClose={() => setEditingItemId(null)}
          onSave={(changes) => handleEditSave(editingItem.id, changes)}
        />
      )}
    </Page>
  )
}
