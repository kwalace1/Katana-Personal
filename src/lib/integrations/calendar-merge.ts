import { addDays } from '@/lib/dates'
import { calendarApi } from '@/modules/calendar/api'
import type { CalendarEvent } from '@/modules/calendar/types'
import type { ExternalCalendarEvent } from './types'

export type CalendarImportSource = 'google' | 'ics'

/** Merge imported events into local IndexedDB; returns count upserted. */
export function mergeExternalEvents(
  userId: string,
  source: CalendarImportSource,
  events: ExternalCalendarEvent[],
  window?: { start: Date; end: Date },
): number {
  const sourceKey = source
  const existing = calendarApi.list(userId).filter((e) => e.source === sourceKey)
  const byExternal = new Map(
    existing.filter((e) => e.external_id).map((e) => [e.external_id as string, e]),
  )
  const seen = new Set<string>()
  let count = 0

  for (const ext of events) {
    seen.add(ext.external_id)
    const prev = byExternal.get(ext.external_id)
    if (prev) {
      calendarApi.update(userId, prev.id, {
        title: ext.title,
        notes: ext.notes,
        starts_at: ext.starts_at,
        ends_at: ext.ends_at,
        all_day: ext.all_day,
        location: ext.location,
        source: sourceKey,
        external_id: ext.external_id,
      })
    } else {
      calendarApi.create(userId, {
        title: ext.title,
        notes: ext.notes,
        starts_at: ext.starts_at,
        ends_at: ext.ends_at,
        all_day: ext.all_day,
        location: ext.location,
        recurrence: 'none',
        reminder_minutes: null,
        category: 'personal',
        color: null,
        source: sourceKey,
        external_id: ext.external_id,
      })
    }
    count += 1
  }

  // Drop imported events in sync window that vanished from the feed
  if (window) {
    const startMs = window.start.getTime()
    const endMs = window.end.getTime()
    for (const e of existing) {
      if (!e.external_id || seen.has(e.external_id)) continue
      const s = new Date(e.starts_at).getTime()
      if (s >= startMs && s <= endMs) {
        calendarApi.remove(userId, e.id)
      }
    }
  }

  return count
}

export function defaultSyncWindow(now = new Date()) {
  return {
    start: addDays(now, -30),
    end: addDays(now, 90),
  }
}

export function removeImportedBySource(userId: string, source: CalendarImportSource) {
  for (const e of calendarApi.list(userId)) {
    if (e.source === source) calendarApi.remove(userId, e.id)
  }
}

export function importedEventCount(userId: string, source: CalendarImportSource): number {
  return calendarApi.list(userId).filter((e) => e.source === source).length
}

export function isImportedEvent(event: CalendarEvent): boolean {
  return event.source === 'google' || event.source === 'ics'
}
