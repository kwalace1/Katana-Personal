import type { ExternalCalendarEvent } from './shared/types'
import { filterEventsInWindow, parseIcsEvents } from './shared/ics-parse'
import {
  decodeOAuthState,
  encodeOAuthState,
  oauthPopupHtml as sharedOAuthPopupHtml,
  requestBaseUrl,
} from './shared/oauth-popup'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'

export interface GoogleOAuthEnv {
  clientId: string
  clientSecret: string
}

export function googleOAuthConfigured(env: GoogleOAuthEnv = {
  clientId: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
}): boolean {
  return Boolean(env.clientId && env.clientSecret)
}

function redirectUri(req: Request): string {
  return `${requestBaseUrl(req)}/api/integrations/google`
}

function oauthPopupHtml(payload: Record<string, unknown>, returnOrigin?: string | null): Response {
  return sharedOAuthPopupHtml('katana-google-calendar-oauth', payload, returnOrigin)
}

export async function handleGoogleOAuthRequest(req: Request, env?: GoogleOAuthEnv): Promise<Response> {
  const cfg = env ?? { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET }
  const url = new URL(req.url)
  const action = url.searchParams.get('action') || 'start'

  if (action === 'start') {
    if (!cfg.clientId) {
      return oauthPopupHtml({ error: 'Google Calendar is not configured on this server (missing GOOGLE_CLIENT_ID).' })
    }
    const origin = url.searchParams.get('origin') || requestBaseUrl(req)
    const state = encodeOAuthState({ origin, nonce: crypto.randomUUID() })
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    auth.searchParams.set('client_id', cfg.clientId)
    auth.searchParams.set('redirect_uri', redirectUri(req))
    auth.searchParams.set('response_type', 'code')
    auth.searchParams.set('scope', GOOGLE_SCOPE)
    auth.searchParams.set('access_type', 'offline')
    auth.searchParams.set('prompt', 'consent')
    auth.searchParams.set('state', state)
    return Response.redirect(auth.toString(), 302)
  }

  if (action === 'callback') {
    const state = decodeOAuthState(url.searchParams.get('state') || '')
    const returnOrigin = state?.origin || null
    const err = url.searchParams.get('error')
    if (err) return oauthPopupHtml({ error: err }, returnOrigin)
    const code = url.searchParams.get('code')
    if (!code) return oauthPopupHtml({ error: 'Missing OAuth code.' }, returnOrigin)
    if (!cfg.clientId || !cfg.clientSecret) {
      return oauthPopupHtml({ error: 'Google OAuth secrets not configured.' }, returnOrigin)
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: redirectUri(req),
        grant_type: 'authorization_code',
      }),
    })
    const tokenJson = (await tokenRes.json()) as Record<string, unknown>
    if (!tokenRes.ok) {
      const msg = typeof tokenJson.error === 'string' ? tokenJson.error : 'Token exchange failed'
      return oauthPopupHtml({ error: msg }, returnOrigin)
    }

    const expiry = Date.now() + Number(tokenJson.expires_in || 3600) * 1000
    return oauthPopupHtml(
      {
        tokens: {
          access_token: String(tokenJson.access_token || ''),
          refresh_token: String(tokenJson.refresh_token || ''),
          expiry_date: expiry,
        },
      },
      returnOrigin,
    )
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function refreshGoogleAccessToken(refreshToken: string, cfg: GoogleOAuthEnv) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Refresh failed')
  return {
    access_token: String(json.access_token || ''),
    expiry_date: Date.now() + Number(json.expires_in || 3600) * 1000,
  }
}

function mapGoogleItem(item: Record<string, unknown>): ExternalCalendarEvent | null {
  const id = typeof item.id === 'string' ? item.id : null
  const summary = typeof item.summary === 'string' ? item.summary : 'Untitled'
  if (!id) return null
  const start = item.start as Record<string, string> | undefined
  const end = item.end as Record<string, string> | undefined
  const allDay = Boolean(start?.date)
  const starts_at = start?.dateTime || (start?.date ? `${start.date}T00:00:00.000Z` : null)
  const ends_at = end?.dateTime || (end?.date ? `${end.date}T00:00:00.000Z` : starts_at)
  if (!starts_at || !ends_at) return null
  return {
    external_id: id,
    title: summary,
    notes: typeof item.description === 'string' ? item.description : '',
    starts_at: new Date(starts_at).toISOString(),
    ends_at: new Date(ends_at).toISOString(),
    all_day: allDay,
    location: typeof item.location === 'string' ? item.location : '',
  }
}

export async function handleGoogleSyncRequest(req: Request, env?: GoogleOAuthEnv): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405 })
  }
  const cfg = env ?? { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET }
  if (!googleOAuthConfigured(cfg)) {
    return new Response(JSON.stringify({ error: 'Google not configured' }), { status: 503 })
  }

  let body: {
    refresh_token?: string
    access_token?: string
    expiry_date?: number
    calendarId?: string
    timeMin?: string
    timeMax?: string
  }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const refreshToken = body.refresh_token?.trim()
  if (!refreshToken) {
    return new Response(JSON.stringify({ error: 'refresh_token required' }), { status: 400 })
  }

  let accessToken = body.access_token || ''
  let expiry = body.expiry_date || 0
  if (!accessToken || expiry <= Date.now() + 60_000) {
    const refreshed = await refreshGoogleAccessToken(refreshToken, cfg)
    accessToken = refreshed.access_token
    expiry = refreshed.expiry_date
  }

  const calendarId = encodeURIComponent(body.calendarId || 'primary')
  const timeMin = body.timeMin || new Date(Date.now() - 30 * 86400000).toISOString()
  const timeMax = body.timeMax || new Date(Date.now() + 90 * 86400000).toISOString()

  const events: ExternalCalendarEvent[] = []
  let pageToken: string | undefined
  do {
    const listUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`)
    listUrl.searchParams.set('singleEvents', 'true')
    listUrl.searchParams.set('orderBy', 'startTime')
    listUrl.searchParams.set('timeMin', timeMin)
    listUrl.searchParams.set('timeMax', timeMax)
    listUrl.searchParams.set('maxResults', '250')
    if (pageToken) listUrl.searchParams.set('pageToken', pageToken)

    const res = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const json = (await res.json()) as { items?: Record<string, unknown>[]; nextPageToken?: string; error?: { message?: string } }
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: json.error?.message || 'Google Calendar fetch failed' }),
        { status: 502 },
      )
    }
    for (const item of json.items || []) {
      const mapped = mapGoogleItem(item)
      if (mapped) events.push(mapped)
    }
    pageToken = json.nextPageToken
  } while (pageToken)

  return new Response(
    JSON.stringify({
      events,
      access_token: accessToken,
      expiry_date: expiry,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}

export async function handleIcsFetchRequest(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405 })
  }
  let body: { url?: string; timeMin?: string; timeMax?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }
  const rawUrl = body.url?.trim().replace(/^webcal:/i, 'https:')
  if (!rawUrl) return new Response(JSON.stringify({ error: 'url required' }), { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), { status: 400 })
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return new Response(JSON.stringify({ error: 'URL must be http(s)' }), { status: 400 })
  }
  if (/^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(parsed.hostname)) {
    return new Response(JSON.stringify({ error: 'Private URLs not allowed' }), { status: 400 })
  }

  const res = await fetch(parsed.toString(), {
    headers: { Accept: 'text/calendar,text/plain,*/*' },
  })
  if (!res.ok) {
    return new Response(JSON.stringify({ error: `Fetch failed (${res.status})` }), { status: 502 })
  }
  const text = await res.text()
  const events = parseIcsEvents(text)
  const timeMin = body.timeMin || new Date(Date.now() - 30 * 86400000).toISOString()
  const timeMax = body.timeMax || new Date(Date.now() + 90 * 86400000).toISOString()
  const filtered = filterEventsInWindow(events, timeMin, timeMax)
  return new Response(JSON.stringify({ events: filtered }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
