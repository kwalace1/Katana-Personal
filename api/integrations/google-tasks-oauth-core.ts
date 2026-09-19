import {
  decodeOAuthState,
  encodeOAuthState,
  oauthPopupHtml,
  requestBaseUrl,
} from './shared/oauth-popup'

export interface GoogleTasksOAuthEnv {
  clientId: string
  clientSecret: string
}

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  process.env.VITE_GOOGLE_TASKS_CLIENT_ID ||
  process.env.VITE_GOOGLE_CLIENT_ID ||
  ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks.readonly'

export function readGoogleTasksOAuthEnv(): GoogleTasksOAuthEnv {
  return { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET }
}

function redirectUri(req: Request): string {
  return `${requestBaseUrl(req)}/api/integrations/google-tasks`
}

async function refreshGoogleToken(refreshToken: string, env: GoogleTasksOAuthEnv) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.clientId,
      client_secret: env.clientSecret,
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

export type ExternalTask = {
  external_id: string
  title: string
  notes: string
  due_at: string | null
  status: 'todo' | 'done'
}

export async function handleGoogleTasksOAuthRequest(
  req: Request,
  env = readGoogleTasksOAuthEnv(),
): Promise<Response> {
  const url = new URL(req.url)
  let action = url.searchParams.get('action') || ''
  if (!action) action = url.searchParams.get('code') || url.searchParams.get('error') ? 'callback' : 'start'

  if (action === 'start') {
    if (!env.clientId) {
      return oauthPopupHtml('katana-google-tasks-oauth', { error: 'Google Tasks not configured (GOOGLE_CLIENT_ID).' })
    }
    const origin = url.searchParams.get('origin') || requestBaseUrl(req)
    const state = encodeOAuthState({ origin, nonce: crypto.randomUUID() })
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    auth.searchParams.set('client_id', env.clientId)
    auth.searchParams.set('redirect_uri', redirectUri(req))
    auth.searchParams.set('response_type', 'code')
    auth.searchParams.set('scope', TASKS_SCOPE)
    auth.searchParams.set('access_type', 'offline')
    auth.searchParams.set('prompt', 'consent')
    auth.searchParams.set('state', state)
    return Response.redirect(auth.toString(), 302)
  }

  if (action === 'callback') {
    const state = decodeOAuthState(url.searchParams.get('state') || '')
    const returnOrigin = state?.origin || null
    const err = url.searchParams.get('error')
    if (err) return oauthPopupHtml('katana-google-tasks-oauth', { error: err }, returnOrigin)
    const code = url.searchParams.get('code')
    if (!code) {
      return oauthPopupHtml('katana-google-tasks-oauth', { error: 'Missing OAuth code.' }, returnOrigin)
    }
    if (!env.clientId || !env.clientSecret) {
      return oauthPopupHtml(
        'katana-google-tasks-oauth',
        { error: 'Google OAuth secrets not configured.' },
        returnOrigin,
      )
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.clientId,
        client_secret: env.clientSecret,
        redirect_uri: redirectUri(req),
        grant_type: 'authorization_code',
      }),
    })
    const tokenJson = (await tokenRes.json()) as Record<string, unknown>
    if (!tokenRes.ok) {
      return oauthPopupHtml(
        'katana-google-tasks-oauth',
        { error: String(tokenJson.error || 'Token exchange failed') },
        returnOrigin,
      )
    }
    return oauthPopupHtml(
      'katana-google-tasks-oauth',
      {
        tokens: {
          access_token: String(tokenJson.access_token || ''),
          refresh_token: String(tokenJson.refresh_token || ''),
          expiry_date: Date.now() + Number(tokenJson.expires_in || 3600) * 1000,
        },
      },
      returnOrigin,
    )
  }

  return new Response('Not found', { status: 404 })
}

export async function handleGoogleTasksSyncRequest(
  req: Request,
  env = readGoogleTasksOAuthEnv(),
): Promise<Response> {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST required' }), { status: 405 })
  if (!env.clientId || !env.clientSecret) {
    return new Response(JSON.stringify({ error: 'Google Tasks not configured' }), { status: 503 })
  }

  let body: { refresh_token?: string; access_token?: string; expiry_date?: number }
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
  if (!access || expiry <= Date.now() + 60_000) {
    const refreshed = await refreshGoogleToken(body.refresh_token, env)
    access = refreshed.access_token
    expiry = refreshed.expiry_date
  }

  const listRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    headers: { Authorization: `Bearer ${access}` },
  })
  const listJson = (await listRes.json()) as { items?: { id?: string }[]; error?: { message?: string } }
  if (!listRes.ok) {
    return new Response(JSON.stringify({ error: listJson.error?.message || 'Failed to list task lists' }), {
      status: 502,
    })
  }

  const tasks: ExternalTask[] = []
  for (const list of listJson.items || []) {
    if (!list.id) continue
    const url = new URL(`https://tasks.googleapis.com/tasks/v1/lists/${list.id}/tasks`)
    url.searchParams.set('showCompleted', 'false')
    url.searchParams.set('showHidden', 'false')
    url.searchParams.set('maxResults', '100')
    const taskRes = await fetch(url.toString(), { headers: { Authorization: `Bearer ${access}` } })
    const taskJson = (await taskRes.json()) as {
      items?: { id?: string; title?: string; notes?: string; due?: string; status?: string }[]
    }
    if (!taskRes.ok) continue
    for (const item of taskJson.items || []) {
      if (!item.id || !item.title?.trim()) continue
      if (item.status === 'completed') continue
      tasks.push({
        external_id: `${list.id}:${item.id}`,
        title: item.title.trim(),
        notes: item.notes || '',
        due_at: item.due ? new Date(item.due).toISOString() : null,
        status: 'todo',
      })
    }
  }

  return new Response(JSON.stringify({ tasks, access_token: access, expiry_date: expiry }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
