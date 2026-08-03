import { localDb } from '@/lib/local-db'
import { createId } from '@/lib/id'
import { isWithinInterval, parseISO, startOfDay, endOfDay } from '@/lib/dates'
import type { CalendarEvent } from './types'

const EVENTS = 'events'

function now() {
  return new Date().toISOString()
}

export const calendarApi = {
  list(userId: string): CalendarEvent[] {
    return localDb
      .list<CalendarEvent>(EVENTS, userId)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  },

  create(
    userId: string,
    input: Omit<CalendarEvent, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
  ): CalendarEvent {
    const ts = now()
    return localDb.insert(EVENTS, userId, {
      id: createId(),
      user_id: userId,
      ...input,
      created_at: ts,
      updated_at: ts,
    })
  },

  update(userId: string, id: string, patch: Partial<CalendarEvent>): CalendarEvent | null {
    return localDb.update<CalendarEvent>(EVENTS, userId, id, { ...patch, updated_at: now() })
  },

  remove(userId: string, id: string): boolean {
    return localDb.remove(EVENTS, userId, id)
  },

  forDay(userId: string, day: Date): CalendarEvent[] {
    const start = startOfDay(day)
    const end = endOfDay(day)
    return calendarApi.list(userId).filter((event) => {
      const s = parseISO(event.starts_at)
      return isWithinInterval(s, { start, end }) || (event.all_day && s.toDateString() === day.toDateString())
    })
  },

  upcoming(userId: string, limit = 5): CalendarEvent[] {
    const nowTs = Date.now()
    return calendarApi
      .list(userId)
      .filter((e) => parseISO(e.ends_at).getTime() >= nowTs)
      .slice(0, limit)
  },

  get(userId: string, id: string): CalendarEvent | null {
    return localDb.getById<CalendarEvent>(EVENTS, userId, id)
  },

  /** Events on the same day that overlap in time (ignores all-day). */
  conflicts(userId: string, day: Date): Set<string> {
    const dayEvents = calendarApi.forDay(userId, day).filter((e) => !e.all_day)
    const conflicted = new Set<string>()
    for (let i = 0; i < dayEvents.length; i++) {
      for (let j = i + 1; j < dayEvents.length; j++) {
        const a = dayEvents[i]
        const b = dayEvents[j]
        const aStart = parseISO(a.starts_at).getTime()
        const aEnd = parseISO(a.ends_at).getTime()
        const bStart = parseISO(b.starts_at).getTime()
        const bEnd = parseISO(b.ends_at).getTime()
        if (aStart < bEnd && bStart < aEnd) {
          conflicted.add(a.id)
          conflicted.add(b.id)
        }
      }
    }
    return conflicted
  },
}
