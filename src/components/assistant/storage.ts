// src/components/assistant/storage.ts
// Assistant conversations live only in this browser (localStorage, per user): kept 14 days,
// at most 20. A chat that was idle for 30 minutes isn't resumed — the panel starts fresh.
import type { ChatMessage } from "@/lib/assistant/messages"

export type Conversation = { id: string; startedAt: number; updatedAt: number; title: string; messages: ChatMessage[] }

const KEEP_MS = 14 * 24 * 60 * 60 * 1000
const MAX_CONVERSATIONS = 20
export const RESUME_WITHIN_MS = 30 * 60 * 1000

const key = (userId: string) => `kieke-assistant:${userId}`

export function loadConversations(userId: string): Conversation[] {
  try {
    const raw = localStorage.getItem(key(userId))
    const list = raw ? (JSON.parse(raw) as Conversation[]) : []
    const cutoff = Date.now() - KEEP_MS
    return Array.isArray(list) ? list.filter((c) => c && c.updatedAt > cutoff && Array.isArray(c.messages)) : []
  } catch {
    return []
  }
}

/** Insert or replace one conversation (empty ones aren't kept) */
export function saveConversation(userId: string, conversation: Conversation): Conversation[] {
  const others = loadConversations(userId).filter((c) => c.id !== conversation.id)
  const list = (conversation.messages.length ? [conversation, ...others] : others)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CONVERSATIONS)
  try {
    localStorage.setItem(key(userId), JSON.stringify(list))
  } catch {
    // storage full or blocked — the chat still works for this session
  }
  return list
}

export function newConversation(): Conversation {
  const now = Date.now()
  return { id: `c${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, startedAt: now, updatedAt: now, title: "", messages: [] }
}
