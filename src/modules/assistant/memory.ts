/**
 * Personal memory — durable, user-controlled facts about the individual.
 * Separate from tasks, commitments, chat history, and activity logs.
 * Phase 3: only explicit “remember…” creates entries.
 */

import { createId } from '@/lib/id'
import { localDb } from '@/lib/local-db'
import type { PersonalMemorySlice } from '@/lib/personal-context/types'

export const MEMORY_COLLECTION = 'personal_memory' as const

export const MEMORY_KINDS = ['fact', 'preference', 'pattern', 'note'] as const
export type MemoryKind = (typeof MEMORY_KINDS)[number]

export type PersonalMemory = {
  id: string
  user_id: string
  kind: MemoryKind
  text: string
  /** 1 = user-confirmed; <1 reserved for future inferred patterns (never auto-written in Phase 3). */
  confidence: number
  /** How this memory was created. */
  source: 'explicit' | 'inferred'
  created_at: string
  updated_at: string
}

const MAX_CONTEXT_ITEMS = 6
const TEXT_MAX = 280

function nowIso() {
  return new Date().toISOString()
}

function normalize(row: PersonalMemory): PersonalMemory {
  const kind = MEMORY_KINDS.includes(row.kind) ? row.kind : 'note'
  const confidence =
    typeof row.confidence === 'number' && row.confidence >= 0 && row.confidence <= 1
      ? row.confidence
      : kind === 'pattern'
        ? 0.5
        : 1
  return {
    ...row,
    kind,
    text: (row.text || '').trim().slice(0, TEXT_MAX),
    confidence,
    source: row.source === 'inferred' ? 'inferred' : 'explicit',
  }
}

export function listMemories(userId: string): PersonalMemory[] {
  return localDb
    .list<PersonalMemory>(MEMORY_COLLECTION, userId)
    .map(normalize)
    .filter((m) => m.text.length > 0)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export function getMemory(userId: string, id: string): PersonalMemory | null {
  const row = localDb.getById<PersonalMemory>(MEMORY_COLLECTION, userId, id)
  return row ? normalize(row) : null
}

export function createMemory(
  userId: string,
  input: { text: string; kind?: MemoryKind },
): PersonalMemory | null {
  const text = input.text.trim().replace(/^["'“”]+|["'“”]+$/g, '').slice(0, TEXT_MAX)
  if (!text) return null
  const kind = input.kind && MEMORY_KINDS.includes(input.kind) ? input.kind : inferKindFromText(text)
  const stamp = nowIso()
  // Phase 3: never create inferred/pattern memories from automation.
  const safeKind: MemoryKind = kind === 'pattern' ? 'note' : kind
  return normalize(
    localDb.insert(MEMORY_COLLECTION, userId, {
      id: createId(),
      user_id: userId,
      kind: safeKind,
      text,
      confidence: 1,
      source: 'explicit' as const,
      created_at: stamp,
      updated_at: stamp,
    }),
  )
}

export function updateMemory(
  userId: string,
  id: string,
  patch: { text?: string; kind?: MemoryKind },
): PersonalMemory | null {
  const existing = getMemory(userId, id)
  if (!existing) return null
  const text =
    patch.text != null
      ? patch.text.trim().replace(/^["'“”]+|["'“”]+$/g, '').slice(0, TEXT_MAX)
      : existing.text
  if (!text) return null
  let kind = patch.kind ?? existing.kind
  if (kind === 'pattern' && existing.source !== 'inferred') {
    // User may label something as pattern later; keep confidence below confirmed fact.
    kind = 'pattern'
  }
  const updated = localDb.update<PersonalMemory>(MEMORY_COLLECTION, userId, id, {
    text,
    kind,
    confidence: kind === 'pattern' ? Math.min(existing.confidence, 0.7) : 1,
    updated_at: nowIso(),
  })
  return updated ? normalize(updated) : null
}

export function deleteMemory(userId: string, id: string): boolean {
  return localDb.remove(MEMORY_COLLECTION, userId, id)
}

/** Heuristic kind for explicit remember text — preferences vs facts. */
export function inferKindFromText(text: string): MemoryKind {
  const t = text.toLowerCase()
  if (
    /\b(prefer|preference|like to|don't like|do not like|hate|love|usually|always|never|morning person|night owl)\b/.test(
      t,
    )
  ) {
    return 'preference'
  }
  return 'fact'
}

/**
 * Parse explicit remember / forget intents.
 * Returns null when the utterance is not an explicit memory command.
 */
export function tryParseMemoryCommand(
  userId: string,
  question: string,
): { kind: 'remember' | 'forget'; memory?: PersonalMemory; text: string; removed?: number } | null {
  const q = question.trim()
  if (!q) return null

  const remember =
    q.match(/^(?:please\s+)?remember(?:\s+that)?\s+(.+)$/i) ||
    q.match(/^(?:please\s+)?(?:don't|do not)\s+forget(?:\s+that)?\s+(.+)$/i) ||
    q.match(/^note(?:\s+that)?\s+(.+)\s+for later\.?$/i)

  if (remember?.[1]) {
    const raw = remember[1].trim().replace(/[.?!]+$/, '')
    if (!raw || /^(this|that|it)$/i.test(raw)) return null
    const memory = createMemory(userId, { text: raw })
    if (!memory) return null
    return { kind: 'remember', memory, text: memory.text }
  }

  const forgetAll = /^(?:please\s+)?(?:forget|clear|delete)(?:\s+all)?(?:\s+my)?\s+memories?\s*[?.!]*$/i.test(
    q,
  )
  if (forgetAll) {
    const all = listMemories(userId)
    for (const m of all) deleteMemory(userId, m.id)
    return { kind: 'forget', text: 'all', removed: all.length }
  }

  const forget =
    q.match(/^(?:please\s+)?forget(?:\s+that)?\s+(.+)$/i) ||
    q.match(/^(?:please\s+)?(?:stop remembering|delete memory(?:\s+of)?)\s+(.+)$/i)

  if (forget?.[1]) {
    const needle = forget[1].trim().replace(/[.?!]+$/, '').toLowerCase()
    if (!needle || /^(this|that|it|everything)$/i.test(needle)) {
      if (/everything|all/i.test(needle)) {
        const all = listMemories(userId)
        for (const m of all) deleteMemory(userId, m.id)
        return { kind: 'forget', text: 'all', removed: all.length }
      }
      return null
    }
    const matches = listMemories(userId).filter(
      (m) =>
        m.text.toLowerCase().includes(needle) || needle.includes(m.text.toLowerCase().slice(0, 40)),
    )
    for (const m of matches) deleteMemory(userId, m.id)
    return {
      kind: 'forget',
      text: needle,
      removed: matches.length,
    }
  }

  return null
}

const KIND_PRIORITY: Record<MemoryKind, number> = {
  preference: 0,
  fact: 1,
  note: 2,
  pattern: 3,
}

/**
 * Deterministic, lightweight selection for PersonalContext / LLM.
 * Prefers preferences, then recent facts/notes. Patterns only if confirmed enough —
 * Phase 3 won't create them, but if present they are labeled as less certain.
 */
export function selectMemoriesForContext(userId: string, limit = MAX_CONTEXT_ITEMS): PersonalMemory[] {
  const all = listMemories(userId)
  return [...all]
    .sort((a, b) => {
      const pk = KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]
      if (pk !== 0) return pk
      return b.updated_at.localeCompare(a.updated_at)
    })
    .slice(0, limit)
}

export function toMemorySlice(userId: string): PersonalMemorySlice | null {
  const items = selectMemoriesForContext(userId).map((m) => ({
    id: m.id,
    kind: m.kind,
    text: m.text,
    confidence: m.confidence,
    source: m.source,
  }))
  if (items.length === 0) return null
  return { items }
}

export function formatMemoriesForCoach(userId: string): string | null {
  const items = selectMemoriesForContext(userId, 4)
  if (items.length === 0) return null
  return items
    .map((m) => {
      const tag =
        m.kind === 'preference'
          ? 'Preference'
          : m.kind === 'pattern'
            ? 'Pattern (unconfirmed)'
            : m.kind === 'fact'
              ? 'Fact'
              : 'Note'
      return `${tag}: ${m.text}`
    })
    .join(' · ')
}
