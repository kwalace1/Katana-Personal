import { listConnections } from './store'
import { syncGoogleCalendar } from './google-calendar'
import { syncIcsCalendar } from './ics-calendar'
import { syncFitbit, syncStrava } from './health-providers'

const STALE_MS = 15 * 60_000

/** Sync all connected calendars if stale. Safe to call on app load. */
export async function syncIntegrationsIfStale(userId: string): Promise<{ synced: number; errors: string[] }> {
  const connections = listConnections(userId).filter((c) => c.status === 'connected' || c.status === 'error')
  let synced = 0
  const errors: string[] = []

  for (const conn of connections) {
    const last = conn.lastSyncAt ? new Date(conn.lastSyncAt).getTime() : 0
    if (Date.now() - last < STALE_MS) continue
    try {
      if (conn.provider === 'google_calendar') {
        synced += await syncGoogleCalendar(userId)
      } else if (conn.provider === 'ics_calendar') {
        synced += await syncIcsCalendar(userId, conn.id)
      } else if (conn.provider === 'fitbit') {
        synced += await syncFitbit(userId)
      } else if (conn.provider === 'strava') {
        synced += await syncStrava(userId)
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Sync failed')
    }
  }

  return { synced, errors }
}

export async function syncAllIntegrations(userId: string): Promise<{ synced: number; errors: string[] }> {
  const connections = listConnections(userId)
  let synced = 0
  const errors: string[] = []

  for (const conn of connections) {
    if (conn.status === 'disconnected') continue
    try {
      if (conn.provider === 'google_calendar') {
        synced += await syncGoogleCalendar(userId)
      } else if (conn.provider === 'ics_calendar') {
        synced += await syncIcsCalendar(userId, conn.id)
      } else if (conn.provider === 'fitbit') {
        synced += await syncFitbit(userId)
      } else if (conn.provider === 'strava') {
        synced += await syncStrava(userId)
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Sync failed')
    }
  }

  return { synced, errors }
}
