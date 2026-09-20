import {
  decodeOAuthState,
  encodeOAuthState,
  oauthPopupHtml,
  requestBaseUrl,
  resolveOAuthReturnOrigin,
  withOAuthOriginCookie,
} from './shared/oauth-popup'
import type { ExternalTask } from './google-tasks-oauth-core'

export interface TodoistOAuthEnv {
  clientId: string
  clientSecret: string
}

const TODOIST_CLIENT_ID = process.env.TODOIST_CLIENT_ID || process.env.VITE_TODOIST_CLIENT_ID || ''
const TODOIST_CLIENT_SECRET = process.env.TODOIST_CLIENT_SECRET || ''

export function readTodoistOAuthEnv(): TodoistOAuthEnv {
  return { clientId: TODOIST_CLIENT_ID, clientSecret: TODOIST_CLIENT_SECRET }
}

function redirectUri(req: Request): string {
  return `${requestBaseUrl(req)}/api/integrations/todoist`
}

export async function handleTodoistOAuthRequest(
  req: Request,
  env = readTodoistOAuthEnv(),
): Promise<Response> {
  const url = new URL(req.url)
  let action = url.searchParams.get('action') || ''
  if (!action) action = url.searchParams.get('code') || url.searchParams.get('error') ? 'callback' : 'start'

  if (action === 'start') {
    if (!env.clientId) {
      return oauthPopupHtml('katana-todoist-oauth', { error: 'Todoist not configured (TODOIST_CLIENT_ID).' })
    }
    const origin = url.searchParams.get('origin') || requestBaseUrl(req)
    const state = encodeOAuthState({ origin, nonce: crypto.randomUUID() })
    const auth = new URL('https://todoist.com/oauth/authorize')
    auth.searchParams.set('client_id', env.clientId)
    auth.searchParams.set('scope', 'data:read')
    auth.searchParams.set('state', state)
    // Todoist uses redirect_uri registered on the app; include for clarity when supported.
    auth.searchParams.set('redirect_uri', redirectUri(req))
    return withOAuthOriginCookie(Response.redirect(auth.toString(), 302), origin)
  }

  if (action === 'callback') {
    const state = decodeOAuthState(url.searchParams.get('state') || '')
    const returnOrigin = resolveOAuthReturnOrigin(req, state?.origin || null)
    const err = url.searchParams.get('error')
    if (err) return oauthPopupHtml('katana-todoist-oauth', { error: err }, returnOrigin)
    const code = url.searchParams.get('code')
    if (!code) return oauthPopupHtml('katana-todoist-oauth', { error: 'Missing OAuth code.' }, returnOrigin)
    if (!env.clientId || !env.clientSecret) {
      return oauthPopupHtml(
        'katana-todoist-oauth',
        { error: 'Todoist OAuth secrets not configured.' },
        returnOrigin,
      )
    }

    const tokenRes = await fetch('https://todoist.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.clientId,
        client_secret: env.clientSecret,
        code,
      }),
    })
    const tokenJson = (await tokenRes.json()) as Record<string, unknown>
    if (!tokenRes.ok || !tokenJson.access_token) {
      return oauthPopupHtml(
        'katana-todoist-oauth',
        { error: String(tokenJson.error || 'Token exchange failed') },
        returnOrigin,
      )
    }
    const access = String(tokenJson.access_token)
    // Todoist access tokens are long-lived; mirror as refresh for our shared token shape.
    return oauthPopupHtml(
      'katana-todoist-oauth',
      {
        tokens: {
          access_token: access,
          refresh_token: access,
          expiry_date: Date.now() + 365 * 86400000,
        },
      },
      returnOrigin,
    )
  }

  return new Response('Not found', { status: 404 })
}

export async function handleTodoistSyncRequest(
  req: Request,
  env = readTodoistOAuthEnv(),
): Promise<Response> {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST required' }), { status: 405 })
  if (!env.clientId) {
    return new Response(JSON.stringify({ error: 'Todoist not configured' }), { status: 503 })
  }

  let body: { access_token?: string; refresh_token?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }
  const access = body.access_token || body.refresh_token
  if (!access) {
    return new Response(JSON.stringify({ error: 'access_token required' }), { status: 400 })
  }

  type TodoistTask = {
    id?: string
    content?: string
    description?: string
    due?: { datetime?: string; date?: string } | null
    checked?: boolean
    is_completed?: boolean
  }

  const items: TodoistTask[] = []
  let cursor: string | undefined
  do {
    const listUrl = new URL('https://api.todoist.com/api/v1/tasks')
    listUrl.searchParams.set('limit', '200')
    if (cursor) listUrl.searchParams.set('cursor', cursor)

    const res = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${access}` },
    })
    if (!res.ok) {
      const text = await res.text()
      return new Response(JSON.stringify({ error: text || 'Todoist sync failed' }), { status: 502 })
    }

    const json = (await res.json()) as { results?: TodoistTask[]; next_cursor?: string | null } | TodoistTask[]
    // API v1 returns { results, next_cursor }; tolerate a bare array if Todoist changes shape.
    if (Array.isArray(json)) {
      items.push(...json)
      cursor = undefined
    } else {
      items.push(...(json.results || []))
      cursor = json.next_cursor || undefined
    }
  } while (cursor)

  const tasks: ExternalTask[] = []
  for (const item of items) {
    if (!item.id || !item.content?.trim()) continue
    if (item.checked || item.is_completed) continue
    const dueRaw = item.due?.datetime || item.due?.date || null
    tasks.push({
      external_id: String(item.id),
      title: item.content.trim(),
      notes: item.description || '',
      due_at: dueRaw
        ? new Date(dueRaw.length === 10 ? `${dueRaw}T12:00:00.000Z` : dueRaw).toISOString()
        : null,
      status: 'todo',
    })
  }

  return new Response(
    JSON.stringify({
      tasks,
      access_token: access,
      refresh_token: access,
      expiry_date: Date.now() + 365 * 86400000,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}
