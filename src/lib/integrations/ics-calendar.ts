import { defaultSyncWindow, mergeExternalEvents } from './calendar-merge'
import { connectIcsCalendar, getConnection, markConnectionSync } from './store'
import type { ExternalCalendarEvent } from './types'

async function fetchIcsEvents(url: string, window: { start: Date; end: Date }): Promise<ExternalCalendarEvent[]> {
  const res = await fetch('/api/integrations/ics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      timeMin: window.start.toISOString(),
      timeMax: window.end.toISOString(),
    }),
  })
  const json = (await res.json()) as { events?: ExternalCalendarEvent[]; error?: string }
  if (!res.ok) throw new Error(json.error || 'Could not fetch calendar feed')
  return json.events || []
}

export async function syncIcsCalendar(userId: string, connectionId: string): Promise<number> {
  const connection = getConnection(userId, connectionId)
  const url = connection?.config.icsUrl
  if (!connection || !url) return 0

  const window = defaultSyncWindow()
  try {
    const events = await fetchIcsEvents(url, window)
    const count = mergeExternalEvents(userId, 'ics', events, window)
    markConnectionSync(userId, connection.id, {
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      status: 'connected',
    })
    return count
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync failed'
    markConnectionSync(userId, connection.id, { lastError: msg, status: 'error' })
    throw err
  }
}

export async function connectAndSyncIcsCalendar(userId: string, icsUrl: string, label?: string): Promise<number> {
  const connection = connectIcsCalendar(userId, icsUrl, label)
  return syncIcsCalendar(userId, connection.id)
}
