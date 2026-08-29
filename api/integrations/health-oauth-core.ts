export interface HealthOAuthEnv {
  fitbitClientId: string
  fitbitClientSecret: string
  stravaClientId: string
  stravaClientSecret: string
}

export interface OAuthTokens {
  access_token: string
  refresh_token: string
  expiry_date: number
}

const FITBIT_CLIENT_ID = process.env.FITBIT_CLIENT_ID || process.env.VITE_FITBIT_CLIENT_ID || ''
const FITBIT_CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET || ''
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || process.env.VITE_STRAVA_CLIENT_ID || ''
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET || ''

export function readHealthOAuthEnv(): HealthOAuthEnv {
  return {
    fitbitClientId: FITBIT_CLIENT_ID,
    fitbitClientSecret: FITBIT_CLIENT_SECRET,
    stravaClientId: STRAVA_CLIENT_ID,
    stravaClientSecret: STRAVA_CLIENT_SECRET,
  }
}

function baseUrl(req: Request): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3001'
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  return `${proto}://${host}`
}

function oauthPopupHtml(messageType: string, payload: Record<string, unknown>): Response {
  const body = `<!DOCTYPE html><html><body><script>
    (function () {
      var payload = ${JSON.stringify(payload)};
      try {
        if (window.opener) {
          window.opener.postMessage({
            type: '${messageType}',
            tokens: payload.tokens || null,
            error: payload.error || null
          }, '*');
        }
      } catch (e) {}
      window.close();
      document.body.textContent = payload.error ? 'Connection failed.' : 'Connected.';
    })();
  </script></body></html>`
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

async function refreshFitbitToken(refreshToken: string, env: HealthOAuthEnv): Promise<OAuthTokens> {
  const basic = Buffer.from(`${env.fitbitClientId}:${env.fitbitClientSecret}`).toString('base64')
  const res = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) throw new Error(String(json.errors || json.error || 'Fitbit token refresh failed'))
  return {
    access_token: String(json.access_token || ''),
    refresh_token: String(json.refresh_token || refreshToken),
    expiry_date: Date.now() + Number(json.expires_in || 3600) * 1000,
  }
}

async function refreshStravaToken(refreshToken: string, env: HealthOAuthEnv): Promise<OAuthTokens> {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.stravaClientId,
      client_secret: env.stravaClientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) throw new Error(String(json.message || json.error || 'Strava token refresh failed'))
  return {
    access_token: String(json.access_token || ''),
    refresh_token: String(json.refresh_token || refreshToken),
    expiry_date: Date.now() + Number(json.expires_in || 3600) * 1000,
  }
}

async function ensureAccessToken(
  body: { refresh_token?: string; access_token?: string; expiry_date?: number },
  refreshFn: (rt: string) => Promise<OAuthTokens>,
): Promise<OAuthTokens> {
  if (!body.refresh_token) throw new Error('Missing refresh token')
  if (body.access_token && body.expiry_date && body.expiry_date > Date.now() + 60_000) {
    return {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expiry_date: body.expiry_date,
    }
  }
  return refreshFn(body.refresh_token)
}

export async function handleFitbitOAuthRequest(req: Request, env = readHealthOAuthEnv()): Promise<Response> {
  const url = new URL(req.url)
  const action = url.searchParams.get('action') || 'start'
  const redirectUri = `${baseUrl(req)}/api/integrations/fitbit`

  if (action === 'start') {
    if (!env.fitbitClientId) {
      return oauthPopupHtml('katana-fitbit-oauth', { error: 'Fitbit not configured (FITBIT_CLIENT_ID).' })
    }
    const auth = new URL('https://www.fitbit.com/oauth2/authorize')
    auth.searchParams.set('client_id', env.fitbitClientId)
    auth.searchParams.set('response_type', 'code')
    auth.searchParams.set('scope', 'sleep activity heartrate')
    auth.searchParams.set('redirect_uri', redirectUri)
    return Response.redirect(auth.toString(), 302)
  }

  if (action === 'callback') {
    const code = url.searchParams.get('code')
    if (!code) return oauthPopupHtml('katana-fitbit-oauth', { error: 'Missing OAuth code.' })
    const basic = Buffer.from(`${env.fitbitClientId}:${env.fitbitClientSecret}`).toString('base64')
    const tokenRes = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.fitbitClientId,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }),
    })
    const tokenJson = (await tokenRes.json()) as Record<string, unknown>
    if (!tokenRes.ok) {
      return oauthPopupHtml('katana-fitbit-oauth', { error: String(tokenJson.errors || 'Token exchange failed') })
    }
    return oauthPopupHtml('katana-fitbit-oauth', {
      tokens: {
        access_token: String(tokenJson.access_token || ''),
        refresh_token: String(tokenJson.refresh_token || ''),
        expiry_date: Date.now() + Number(tokenJson.expires_in || 3600) * 1000,
      },
    })
  }

  return new Response('Not found', { status: 404 })
}

export async function handleStravaOAuthRequest(req: Request, env = readHealthOAuthEnv()): Promise<Response> {
  const url = new URL(req.url)
  const action = url.searchParams.get('action') || 'start'
  const redirectUri = `${baseUrl(req)}/api/integrations/strava`

  if (action === 'start') {
    if (!env.stravaClientId) {
      return oauthPopupHtml('katana-strava-oauth', { error: 'Strava not configured (STRAVA_CLIENT_ID).' })
    }
    const auth = new URL('https://www.strava.com/oauth/authorize')
    auth.searchParams.set('client_id', env.stravaClientId)
    auth.searchParams.set('response_type', 'code')
    auth.searchParams.set('scope', 'activity:read_all')
    auth.searchParams.set('redirect_uri', redirectUri)
    return Response.redirect(auth.toString(), 302)
  }

  if (action === 'callback') {
    const code = url.searchParams.get('code')
    if (!code) return oauthPopupHtml('katana-strava-oauth', { error: 'Missing OAuth code.' })
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.stravaClientId,
        client_secret: env.stravaClientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    })
    const tokenJson = (await tokenRes.json()) as Record<string, unknown>
    if (!tokenRes.ok) {
      return oauthPopupHtml('katana-strava-oauth', { error: String(tokenJson.message || 'Token exchange failed') })
    }
    return oauthPopupHtml('katana-strava-oauth', {
      tokens: {
        access_token: String(tokenJson.access_token || ''),
        refresh_token: String(tokenJson.refresh_token || ''),
        expiry_date: Date.now() + Number(tokenJson.expires_in || 3600) * 1000,
      },
    })
  }

  return new Response('Not found', { status: 404 })
}

export async function handleFitbitSyncRequest(req: Request, env = readHealthOAuthEnv()): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const body = (await req.json()) as {
    refresh_token?: string
    access_token?: string
    expiry_date?: number
  }

  try {
    const tokens = await ensureAccessToken(body, (rt) => refreshFitbitToken(rt, env))
    const sleep: { date: string; hours: number; bedtime?: string; wake?: string; source: 'fitbit' }[] = []
    const workouts: { date: string; activity: string; duration_minutes: number; notes?: string }[] = []

    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const sleepRes = await fetch(`https://api.fitbit.com/1.2/user/-/sleep/date/${key}.json`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (sleepRes.ok) {
        const sleepJson = (await sleepRes.json()) as {
          sleep?: { dateOfSleep?: string; minutesAsleep?: number; startTime?: string; endTime?: string }[]
        }
        for (const s of sleepJson.sleep || []) {
          if (!s.dateOfSleep || !s.minutesAsleep) continue
          sleep.push({
            date: s.dateOfSleep,
            hours: Math.round((s.minutesAsleep / 60) * 10) / 10,
            bedtime: s.startTime,
            wake: s.endTime,
            source: 'fitbit',
          })
        }
      }

      const actRes = await fetch(`https://api.fitbit.com/1/user/-/activities/date/${key}.json`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (actRes.ok) {
        const actJson = (await actRes.json()) as {
          activities?: { activityName?: string; duration?: number; startTime?: string }[]
        }
        for (const a of actJson.activities || []) {
          if (!a.activityName || !a.duration) continue
          workouts.push({
            date: key,
            activity: a.activityName,
            duration_minutes: Math.max(1, Math.round(a.duration / 60000)),
            notes: 'Imported from Fitbit',
          })
        }
      }
    }

    return Response.json({
      sleep,
      workouts,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date,
    })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Fitbit sync failed' }, { status: 502 })
  }
}

export async function handleStravaSyncRequest(req: Request, env = readHealthOAuthEnv()): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const body = (await req.json()) as {
    refresh_token?: string
    access_token?: string
    expiry_date?: number
  }

  try {
    const tokens = await ensureAccessToken(body, (rt) => refreshStravaToken(rt, env))
    const after = Math.floor((Date.now() - 14 * 86400000) / 1000)
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=40`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    )
    const activities = (await res.json()) as {
      name?: string
      type?: string
      start_date?: string
      moving_time?: number
      distance?: number
    }[]
    if (!res.ok) throw new Error('Strava activities fetch failed')

    const workouts = (activities || []).map((a) => ({
      date: (a.start_date || '').slice(0, 10),
      activity: a.name || a.type || 'Workout',
      duration_minutes: Math.max(1, Math.round((a.moving_time || 0) / 60)),
      notes: a.distance
        ? `Imported from Strava · ${Math.round(a.distance / 1000)} km`
        : 'Imported from Strava',
    }))

    return Response.json({
      workouts,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date,
    })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Strava sync failed' }, { status: 502 })
  }
}
