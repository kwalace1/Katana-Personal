import { defaultSyncWindow, mergeExternalEvents } from './calendar-merge'
import { isOAuthRedirect, openIntegrationOAuthPopup } from './oauth-popup'
import {
  connectOAuthProvider,
  getConnectionByProvider,
  markConnectionSync,
  upsertConnection,
} from './store'
import type { ExternalCalendarEvent, IntegrationConnection, OAuthTokens } from './types'

export function outlookCalendarConfigured(): boolean {
  return Boolean(import.meta.env.VITE_MS_CLIENT_ID || import.meta.env.VITE_OUTLOOK_CLIENT_ID)
}

export function openOutlookOAuth(): Promise<OAuthTokens | { redirected: true }> {
  return openIntegrationOAuthPopup('/api/integrations/outlook', 'katana-outlook-oauth', 'katana-outlook')
}

async function fetchOutlookEvents(
  connection: IntegrationConnection,
  window: { start: Date; end: Date },
): Promise<{ events: ExternalCalendarEvent[]; tokens?: OAuthTokens }> {
  const tokens = connection.config.oauthTokens
  if (!tokens?.refresh_token) throw new Error('Outlook not connected')

  const res = await fetch('/api/integrations/outlook/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date,
      timeMin: window.start.toISOString(),
      timeMax: window.end.toISOString(),
    }),
  })
  const json = (await res.json()) as {
    events?: ExternalCalendarEvent[]
    access_token?: string
    refresh_token?: string
    expiry_date?: number
    error?: string
  }
  if (!res.ok) throw new Error(json.error || 'Outlook sync failed')

  const nextTokens: OAuthTokens | undefined =
    json.access_token && (json.refresh_token || tokens.refresh_token)
      ? {
          access_token: json.access_token,
          refresh_token: json.refresh_token || tokens.refresh_token,
          expiry_date: json.expiry_date || tokens.expiry_date,
        }
      : undefined

  return { events: json.events || [], tokens: nextTokens }
}

export async function syncOutlookCalendar(userId: string): Promise<number> {
  const connection = getConnectionByProvider(userId, 'outlook_calendar')
  if (!connection?.config.oauthTokens?.refresh_token) return 0

  const window = defaultSyncWindow()
  try {
    const { events, tokens } = await fetchOutlookEvents(connection, window)
    if (tokens) {
      upsertConnection(userId, {
        ...connection,
        config: { ...connection.config, oauthTokens: tokens },
      })
    }
    const count = mergeExternalEvents(userId, 'outlook', events, window)
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

export async function connectAndSyncOutlookCalendar(userId: string): Promise<number | 'redirected'> {
  const result = await openOutlookOAuth()
  if (isOAuthRedirect(result)) return 'redirected'
  if (!result.refresh_token) throw new Error('Microsoft did not return a refresh token. Try again.')
  const connection = connectOAuthProvider(userId, 'outlook_calendar', result, 'Outlook Calendar')
  return syncOutlookCalendar(userId).catch((err) => {
    markConnectionSync(userId, connection.id, {
      lastError: err instanceof Error ? err.message : 'Sync failed',
      status: 'error',
    })
    throw err
  })
}
