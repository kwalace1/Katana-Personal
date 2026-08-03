import { localDb } from '@/lib/local-db'
import { createId } from '@/lib/id'
import { todayKey } from '@/lib/dates'
import type { JournalEntry, Mood } from './types'

const ENTRIES = 'journal_entries'

function now() {
  return new Date().toISOString()
}

export const journalApi = {
  list(userId: string): JournalEntry[] {
    return localDb.list<JournalEntry>(ENTRIES, userId).sort((a, b) => b.date.localeCompare(a.date))
  },

  forDate(userId: string, date = todayKey()): JournalEntry | null {
    return journalApi.list(userId).find((e) => e.date === date) ?? null
  },

  upsert(
    userId: string,
    input: { date?: string; mood: Mood; body: string; reflection?: string },
  ): JournalEntry {
    const date = input.date || todayKey()
    const existing = journalApi.forDate(userId, date)
    const ts = now()
    if (existing) {
      return (
        localDb.update<JournalEntry>(ENTRIES, userId, existing.id, {
          mood: input.mood,
          body: input.body,
          reflection: input.reflection || '',
          updated_at: ts,
        }) || existing
      )
    }
    return localDb.insert(ENTRIES, userId, {
      id: createId(),
      user_id: userId,
      date,
      mood: input.mood,
      body: input.body,
      reflection: input.reflection || '',
      created_at: ts,
      updated_at: ts,
    })
  },

  remove(userId: string, id: string): boolean {
    return localDb.remove(ENTRIES, userId, id)
  },
}
