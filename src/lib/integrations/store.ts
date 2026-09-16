import { createId } from '@/lib/id'
import type { GoogleCalendarTokens, IntegrationConnection, IntegrationProvider, OAuthTokens } from './types'

const KEY_PREFIX = 'katana-personal:integrations'

function storageKey(userId: string) {
  return `${KEY_PREFIX}:${userId}`
}

export function listConnections(userId: string): IntegrationConnection[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as IntegrationConnection[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveConnections(userId: string, connections: IntegrationConnection[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(connections))
}

export function getConnection(userId: string, id: string): IntegrationConnection | null {
  return listConnections(userId).find((c) => c.id === id) ?? null
}

export function getConnectionByProvider(
  userId: string,
  provider: IntegrationProvider,
): IntegrationConnection | null {
  return listConnections(userId).find((c) => c.provider === provider && c.status === 'connected') ?? null
}

export function upsertConnection(userId: string, connection: IntegrationConnection) {
  const list = listConnections(userId)
  const idx = list.findIndex((c) => c.id === connection.id)
  if (idx >= 0) list[idx] = connection
  else list.push(connection)
  saveConnections(userId, list)
}

export function removeConnection(userId: string, id: string) {
  saveConnections(
    userId,
    listConnections(userId).filter((c) => c.id !== id),
  )
}

export function connectGoogleCalendar(
  userId: string,
  tokens: GoogleCalendarTokens,
  label = 'Google Calendar',
): IntegrationConnection {
  const existing = getConnectionByProvider(userId, 'google_calendar')
  const connection: IntegrationConnection = {
    id: existing?.id ?? createId(),
    provider: 'google_calendar',
    label,
    status: 'connected',
    lastSyncAt: existing?.lastSyncAt ?? null,
    lastError: null,
    config: { calendarId: 'primary', googleTokens: tokens },
  }
  upsertConnection(userId, connection)
  return connection
}

export function connectIcsCalendar(userId: string, icsUrl: string, label = 'Subscribed calendar'): IntegrationConnection {
  const normalized = icsUrl.trim().replace(/^webcal:/i, 'https:')
  const existing = listConnections(userId).find((c) => c.provider === 'ics_calendar' && c.config.icsUrl === normalized)
  const connection: IntegrationConnection = {
    id: existing?.id ?? createId(),
    provider: 'ics_calendar',
    label,
    status: 'connected',
    lastSyncAt: existing?.lastSyncAt ?? null,
    lastError: null,
    config: { icsUrl: normalized },
  }
  upsertConnection(userId, connection)
  return connection
}

export function markConnectionSync(
  userId: string,
  id: string,
  patch: { lastSyncAt?: string | null; lastError?: string | null; status?: IntegrationConnection['status'] },
) {
  const conn = getConnection(userId, id)
  if (!conn) return
  upsertConnection(userId, {
    ...conn,
    lastSyncAt: patch.lastSyncAt !== undefined ? patch.lastSyncAt : conn.lastSyncAt,
    lastError: patch.lastError !== undefined ? patch.lastError : conn.lastError,
    status: patch.status ?? (patch.lastError ? 'error' : 'connected'),
  })
}

export function disconnectProvider(userId: string, provider: IntegrationProvider) {
  saveConnections(
    userId,
    listConnections(userId).filter((c) => c.provider !== provider),
  )
}

export function connectOAuthProvider(
  userId: string,
  provider: Extract<
    IntegrationProvider,
    'fitbit' | 'strava' | 'outlook_calendar' | 'google_tasks' | 'todoist'
  >,
  tokens: OAuthTokens,
  label: string,
): IntegrationConnection {
  const existing = getConnectionByProvider(userId, provider)
  const connection: IntegrationConnection = {
    id: existing?.id ?? createId(),
    provider,
    label,
    status: 'connected',
    lastSyncAt: existing?.lastSyncAt ?? null,
    lastError: null,
    config: { oauthTokens: tokens },
  }
  upsertConnection(userId, connection)
  return connection
}
