import type { ExternalCalendarEvent } from './shared/types'
import {
  decodeOAuthState,
  encodeOAuthState,
  oauthPopupHtml,
  requestBaseUrl,
} from './shared/oauth-popup'

export interface MsOAuthEnv {
  clientId: string
  clientSecret: string
}

const MS_CLIENT_ID = process.env.MS_CLIENT_ID || process.env.VITE_MS_CLIENT_ID || process.env.VITE_OUTLOOK_CLIENT_ID || ''
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET || ''
const MS_SCOPES = 'openid profile offline_access User.Read Calendars.Read'

export function readMsOAuthEnv(): MsOAuthEnv {
  return { clientId: MS_CLIENT_ID, clientSecret: MS_CLIENT_SECRET }
}

function redirectUri(req: Request): string {
  return `${requestBaseUrl(req)}/api/integrations/outlook`
}

async function refreshMsToken(refreshToken: string, env: MsOAuthEnv) {
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: MS_SCOPES,
    }),
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) throw new Error(typeof json.error_description === 'string' ? json.error_description : 'Microsoft refresh failed')
  return {
    access_token: String(json.access_token || ''),
    refresh_token: String(json.refresh_token || refreshToken),
    expiry_date: Date.now() + Number(json.expires_in || 3600) * 1000,
  }
}

function mapGraphEvent(item: Record<string, unknown>): ExternalCalendarEvent | null {
  const id = typeof item.id === 'string' ? item.id : null
  if (!id) return null
  const subject = typeof item.subject === 'string' ? item.subject : 'Untitled'
  const start = item.start as { dateTime?: string; date?: string; timeZone?: string } | undefined
  const end = item.end as { dateTime?: string; date?: string; timeZone?: string } | undefined
  const isAllDay = Boolean(item.isAllDay)
  const startsRaw = start?.dateTime || start?.date
  const endsRaw = end?.dateTime || end?.date || startsRaw
  if (!startsRaw || !endsRaw) return null
  // Graph dateTime is often timezone-less local; append Z only when clearly UTC-less ISO without offset.
  const toIso = (raw: string) => {
    if (/Z$|[+-]\d{2}:\d{2}$/.test(raw)) return new Date(raw).toISOString()
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00.000Z`).toISOString()
    return new Date(`${raw}Z`).toISOString()
  }
  const location = item.location as { displayName?: string } | undefined
  return {
    external_id: id,
    title: subject,
    notes: typeof item.bodyPreview === 'string' ? item.bodyPreview : '',
    starts_at: toIso(startsRaw),
    ends_at: toIso(endsRaw),
    all_day: isAllDay,
    location: location?.displayName || '',
  }
}

export async function handleOutlookOAuthRequest(req: Request, env = readMsOAuthEnv()): Promise<Response> {
  const url = new URL(req.url)
  let action = url.searchParams.get('action') || ''
  if (!action) action = url.searchParams.get('code') || url.searchParams.get('error') ? 'callback' : 'start'

  if (action === 'start') {
    if (!env.clientId) {
      return oauthPopupHtml('katana-outlook-oauth', { error: 'Outlook not configured (MS_CLIENT_ID).' })
    }
    const origin = url.searchParams.get('origin') || requestBaseUrl(req)
    const state = encodeOAuthState({ origin, nonce: crypto.randomUUID() })
    const auth = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
    auth.searchParams.set('client_id', env.clientId)
    auth.searchParams.set('response_type', 'code')
    auth.searchParams.set('redirect_uri', redirectUri(req))
    auth.searchParams.set('response_mode', 'query')
    auth.searchParams.set('scope', MS_SCOPES)
    auth.searchParams.set('state', state)
    auth.searchParams.set('prompt', 'select_account')
    return Response.redirect(auth.toString(), 302)
  }

  if (action === 'callback') {
    const err = url.searchParams.get('error')
    if (err) {
      return oauthPopupHtml('katana-outlook-oauth', {
        error: url.searchParams.get('error_description') || err,
      })
    }
    const code = url.searchParams.get('code')
    if (!code) return oauthPopupHtml('katana-outlook-oauth', { error: 'Missing OAuth code.' })
    if (!env.clientId || !env.clientSecret) {
      return oauthPopupHtml('katana-outlook-oauth', { error: 'Microsoft OAuth secrets not configured.' })
    }
    void decodeOAuthState(url.searchParams.get('state') || '')

    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.clientId,
        client_secret: env.clientSecret,
        code,
        redirect_uri: redirectUri(req),
        grant_type: 'authorization_code',
        scope: MS_SCOPES,
      }),
    })
    const tokenJson = (await tokenRes.json()) as Record<string, unknown>
    if (!tokenRes.ok) {
      return oauthPopupHtml('katana-outlook-oauth', {
        error: String(tokenJson.error_description || tokenJson.error || 'Token exchange failed'),
      })
    }
    return oauthPopupHtml('katana-outlook-oauth', {
      tokens: {
        access_token: String(tokenJson.access_token || ''),
        refresh_token: String(tokenJson.refresh_token || ''),
        expiry_date: Date.now() + Number(tokenJson.expires_in || 3600) * 1000,
      },
    })
  }

  return new Response('Not found', { status: 404 })
}

export async function handleOutlookSyncRequest(req: Request, env = readMsOAuthEnv()): Promise<Response> {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST required' }), { status: 405 })
  if (!env.clientId || !env.clientSecret) {
    return new Response(JSON.stringify({ error: 'Outlook not configured' }), { status: 503 })
  }

  let body: { refresh_token?: string; access_token?: string; expiry_date?: number; timeMin?: string; timeMax?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }
  if (!body.refresh_token) {
    return new Response(JSON.stringify({ error: 'refresh_token required' }), { status: 400 })
  }

  let access = body.access_token || ''
  let expiry = body.expiry_date || 0
  let refresh = body.refresh_token
  if (!access || expiry <= Date.now() + 60_000) {
    const refreshed = await refreshMsToken(body.refresh_token, env)
    access = refreshed.access_token
    expiry = refreshed.expiry_date
    refresh = refreshed.refresh_token
  }

  const start = body.timeMin || new Date(Date.now() - 30 * 86400000).toISOString()
  const end = body.timeMax || new Date(Date.now() + 90 * 86400000).toISOString()
  const listUrl = new URL('https://graph.microsoft.com/v1.0/me/calendarView')
  listUrl.searchParams.set('startDateTime', start)
  listUrl.searchParams.set('endDateTime', end)
  listUrl.searchParams.set('$top', '250')
  listUrl.searchParams.set('$orderby', 'start/dateTime')
  listUrl.searchParams.set('$select', 'id,subject,bodyPreview,start,end,isAllDay,location')

  const res = await fetch(listUrl.toString(), {
    headers: {
      Authorization: `Bearer ${access}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  })
  const json = (await res.json()) as { value?: Record<string, unknown>[]; error?: { message?: string } }
  if (!res.ok) {
    return new Response(JSON.stringify({ error: json.error?.message || 'Outlook sync failed' }), { status: 502 })
  }

  const events = (json.value || []).map(mapGraphEvent).filter((e): e is ExternalCalendarEvent => Boolean(e))
  return new Response(JSON.stringify({ events, access_token: access, refresh_token: refresh, expiry_date: expiry }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
