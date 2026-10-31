import { localDb } from '@/lib/local-db'
import { createId } from '@/lib/id'
import { todayKey } from '@/lib/dates'
import type { JournalEntry, Mood } from './types'

const ENTRIES = 'journal_entries'

function now() {
  return new Date().toISOString()
}

function byNewest(a: JournalEntry, b: JournalEntry) {
  const byDate = b.date.localeCompare(a.date)
  if (byDate !== 0) return byDate
  return b.created_at.localeCompare(a.created_at)
}

export const journalApi = {
  list(userId: string): JournalEntry[] {
    return localDb.list<JournalEntry>(ENTRIES, userId).sort(byNewest)
  },

  forDate(userId: string, date = todayKey()): JournalEntry | null {
    return journalApi.entriesForDate(userId, date)[0] ?? null
  },

  entriesForDate(userId: string, date = todayKey()): JournalEntry[] {
    return journalApi.list(userId).filter((entry) => entry.date === date)
  },

  create(
    userId: string,
    input: { date?: string; mood: Mood; body: string; reflection?: string },
  ): JournalEntry {
    const ts = now()
    return localDb.insert(ENTRIES, userId, {
      id: createId(),
      user_id: userId,
      date: input.date || todayKey(),
      mood: input.mood,
      body: input.body,
      reflection: input.reflection || '',
      created_at: ts,
      updated_at: ts,
    })
  },

  update(
    userId: string,
    id: string,
    input: { date?: string; mood: Mood; body: string; reflection?: string },
  ): JournalEntry | null {
    const current = journalApi.list(userId).find((entry) => entry.id === id)
    if (!current) return null
    return localDb.update<JournalEntry>(ENTRIES, userId, id, {
      date: input.date || current.date,
      mood: input.mood,
      body: input.body,
      reflection: input.reflection || '',
      updated_at: now(),
    })
  },

  upsert(
    userId: string,
    input: { date?: string; mood: Mood; body: string; reflection?: string },
  ): JournalEntry {
    const date = input.date || todayKey()
    const existing = journalApi.forDate(userId, date)
    if (existing) {
      return journalApi.update(userId, existing.id, { ...input, date }) || existing
    }
    return journalApi.create(userId, { ...input, date })
  },

  remove(userId: string, id: string): boolean {
    return localDb.remove(ENTRIES, userId, id)
  },
}
