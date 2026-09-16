import { listConnections } from './store'
import { syncGoogleCalendar } from './google-calendar'
import { syncGoogleTasks } from './google-tasks'
import { syncIcsCalendar } from './ics-calendar'
import { syncOutlookCalendar } from './outlook-calendar'
import { syncTodoist } from './todoist'

const STALE_MS = 15 * 60_000

/** Sync all connected calendars/tasks if stale. Safe to call on app load. */
export async function syncIntegrationsIfStale(userId: string): Promise<{ synced: number; errors: string[] }> {
  const connections = listConnections(userId).filter((c) => c.status === 'connected' || c.status === 'error')
  let synced = 0
  const errors: string[] = []

  for (const conn of connections) {
    const last = conn.lastSyncAt ? new Date(conn.lastSyncAt).getTime() : 0
    if (Date.now() - last < STALE_MS) continue
    try {
      if (conn.provider === 'google_calendar') synced += await syncGoogleCalendar(userId)
      else if (conn.provider === 'ics_calendar') synced += await syncIcsCalendar(userId, conn.id)
      else if (conn.provider === 'outlook_calendar') synced += await syncOutlookCalendar(userId)
      else if (conn.provider === 'google_tasks') synced += await syncGoogleTasks(userId)
      else if (conn.provider === 'todoist') synced += await syncTodoist(userId)
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
      if (conn.provider === 'google_calendar') synced += await syncGoogleCalendar(userId)
      else if (conn.provider === 'ics_calendar') synced += await syncIcsCalendar(userId, conn.id)
      else if (conn.provider === 'outlook_calendar') synced += await syncOutlookCalendar(userId)
      else if (conn.provider === 'google_tasks') synced += await syncGoogleTasks(userId)
      else if (conn.provider === 'todoist') synced += await syncTodoist(userId)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Sync failed')
    }
  }

  return { synced, errors }
}
