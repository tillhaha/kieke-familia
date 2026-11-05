// src/lib/shoppingOffline.ts
// Offline support for the shopping list (supermarkets often have no signal):
//  - an outbox of pending changes (add / delete) that is replayed in order
//    when the connection is back, so checked-off items don't reappear
//  - a cached copy of the last server list, shown when the list can't load
// Both live in localStorage, keyed per user so a shared device never shows
// another account's list. Every access is wrapped: storage can be missing
// or blocked (private mode), in which case the page simply works online-only.

export type OutboxOp =
  | {
      opId: string
      kind: "add"
      tempId: string // id of the optimistic item shown in the list
      name: string
      quantity: string | null
      categoryId: string | null
      tags: string[]
    }
  | { opId: string; kind: "delete"; itemId: string }

export const TEMP_PREFIX = "optimistic-"

const outboxKey = (userId: string) => `kieke:shopping:${userId}:outbox:v1`
const cacheKey = (userId: string) => `kieke:shopping:${userId}:cache:v1`

// Fallback when localStorage is blocked: the outbox still works for this page visit
const memoryStore = new Map<string, string>()

function read<T>(key: string, fallback: T): T {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(key)
  } catch {
    // blocked — use the in-memory copy below
  }
  if (raw === null) raw = memoryStore.get(key) ?? null
  try {
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  const raw = JSON.stringify(value)
  try {
    window.localStorage.setItem(key, raw)
    memoryStore.delete(key)
  } catch {
    memoryStore.set(key, raw) // storage full / blocked
  }
}

export function newId(prefix = "") {
  return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function loadOutbox(userId: string): OutboxOp[] {
  const ops = read<OutboxOp[]>(outboxKey(userId), [])
  return Array.isArray(ops) ? ops : []
}

export function saveOutbox(userId: string, ops: OutboxOp[]) {
  write(outboxKey(userId), ops)
}

export function enqueue(userId: string, op: OutboxOp) {
  saveOutbox(userId, [...loadOutbox(userId), op])
}

export function removeOp(userId: string, opId: string) {
  saveOutbox(userId, loadOutbox(userId).filter((o) => o.opId !== opId))
}

/** Drops a not-yet-sent add (item added offline, then checked off before sync). Returns true if found. */
export function cancelPendingAdd(userId: string, tempId: string): boolean {
  const ops = loadOutbox(userId)
  const next = ops.filter((o) => !(o.kind === "add" && o.tempId === tempId))
  if (next.length === ops.length) return false
  saveOutbox(userId, next)
  return true
}

export type ShoppingCache<Item, Category> = { items: Item[]; categories: Category[]; savedAt: number }

export function loadCache<Item, Category>(userId: string): ShoppingCache<Item, Category> | null {
  const c = read<ShoppingCache<Item, Category> | null>(cacheKey(userId), null)
  return c && Array.isArray(c.items) && Array.isArray(c.categories) ? c : null
}

export function saveCache<Item, Category>(userId: string, items: Item[], categories: Category[]) {
  write(cacheKey(userId), { items, categories, savedAt: Date.now() })
}

/** Server (or cached) list with the pending local changes applied on top. */
export function applyOutbox<Item extends { id: string }>(
  items: Item[],
  ops: OutboxOp[],
  toItem: (op: Extract<OutboxOp, { kind: "add" }>) => Item
): Item[] {
  const deleted = new Set(ops.filter((o) => o.kind === "delete").map((o) => (o as { itemId: string }).itemId))
  const base = items.filter((i) => !deleted.has(i.id) && !i.id.startsWith(TEMP_PREFIX))
  const adds = ops.filter((o): o is Extract<OutboxOp, { kind: "add" }> => o.kind === "add").map(toItem)
  return [...base, ...adds]
}
