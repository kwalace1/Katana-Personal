import { defaultSyncWindow, mergeExternalEvents } from './calendar-merge'
import { isOAuthRedirect, openIntegrationOAuthPopup } from './oauth-popup'
import {
  connectGoogleCalendar,
  getConnectionByProvider,
  markConnectionSync,
  upsertConnection,
} from './store'
import type { ExternalCalendarEvent, GoogleCalendarTokens, IntegrationConnection } from './types'

export function googleCalendarConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)
}

export function openGoogleCalendarOAuth(): Promise<GoogleCalendarTokens | { redirected: true }> {
  return openIntegrationOAuthPopup(
    '/api/integrations/google',
    'katana-google-calendar-oauth',
    'katana-google-calendar',
  )
}

async function fetchGoogleEvents(
  connection: IntegrationConnection,
  window: { start: Date; end: Date },
): Promise<{ events: ExternalCalendarEvent[]; tokens?: GoogleCalendarTokens }> {
  const tokens = connection.config.googleTokens
  if (!tokens?.refresh_token) throw new Error('Google Calendar not connected')

  const res = await fetch('/api/integrations/google/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date,
      calendarId: connection.config.calendarId || 'primary',
      timeMin: window.start.toISOString(),
      timeMax: window.end.toISOString(),
    }),
  })
  const json = (await res.json()) as {
    events?: ExternalCalendarEvent[]
    access_token?: string
    expiry_date?: number
    error?: string
  }
  if (!res.ok) throw new Error(json.error || 'Sync failed')

  const nextTokens: GoogleCalendarTokens | undefined =
    json.access_token && tokens.refresh_token
      ? {
          access_token: json.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: json.expiry_date || tokens.expiry_date,
        }
      : undefined

  return { events: json.events || [], tokens: nextTokens }
}

export async function syncGoogleCalendar(userId: string): Promise<number> {
  const connection = getConnectionByProvider(userId, 'google_calendar')
  if (!connection?.config.googleTokens?.refresh_token) return 0

  const window = defaultSyncWindow()
  try {
    const { events, tokens } = await fetchGoogleEvents(connection, window)
    if (tokens) {
      upsertConnection(userId, {
        ...connection,
        config: { ...connection.config, googleTokens: tokens },
      })
    }
    const count = mergeExternalEvents(userId, 'google', events, window)
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

export async function connectAndSyncGoogleCalendar(userId: string): Promise<number | 'redirected'> {
  const result = await openGoogleCalendarOAuth()
  if (isOAuthRedirect(result)) return 'redirected'
  if (!result.refresh_token) {
    throw new Error('Google did not return a refresh token. Try again and approve calendar access.')
  }
  const connection = connectGoogleCalendar(userId, result)
  return syncGoogleCalendar(userId).catch((err) => {
    markConnectionSync(userId, connection.id, {
      lastError: err instanceof Error ? err.message : 'Sync failed',
      status: 'error',
    })
    throw err
  })
}
