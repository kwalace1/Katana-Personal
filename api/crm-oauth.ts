/**
 * CRM OAuth — Gmail, Outlook, Google Calendar, Outlook Calendar
 * GET /api/crm-oauth?action=start&integration=gmail&return_to=/customer-success
 * GET /api/crm-oauth?action=callback&code=...&state=...
 *
 * Requires env:
 * - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (Gmail + Google Calendar)
 * - AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID (Outlook)
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (persist tokens)
 */

import { createClient } from '@supabase/supabase-js'

type Integration = 'gmail' | 'outlook' | 'google_calendar' | 'outlook_calendar'

interface OAuthState {
  integration: Integration
  returnTo: string
  orgId: string
  userId: string
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || process.env.VITE_AZURE_CLIENT_ID || ''
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || ''
const AZURE_TENANT = process.env.AZURE_TENANT_ID || 'common'

function baseUrl(req: Request): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000'
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  return `${proto}://${host}`
}

function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } })
}

function errorPage(message: string, returnTo: string): Response {
  const url = `${returnTo}${returnTo.includes('?') ? '&' : '?'}crm_oauth_error=${encodeURIComponent(message)}`
  return redirect(url)
}

async function authenticate(req: Request): Promise<{ userId: string; orgId: string; token: string } | null> {
  const authHeader = req.headers.get('Authorization')
  const url = new URL(req.url)
  const tokenFromQuery = url.searchParams.get('access_token')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : tokenFromQuery
  if (!token || !SUPABASE_URL) return null

  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anon },
  })
  if (!res.ok) return null
  const user = await res.json()
  if (!user?.id) return null

  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${user.id}&select=organization_id`,
    { headers: { Authorization: `Bearer ${token}`, apikey: anon } },
  )
  const profiles = await profileRes.json()
  const orgId = profiles?.[0]?.organization_id
  if (!orgId) return null

  return { userId: user.id, token, orgId }
}

function encodeState(state: OAuthState): string {
  return Buffer.from(JSON.stringify(state)).toString('base64url')
}

function decodeState(raw: string): OAuthState | null {
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as OAuthState
  } catch {
    return null
  }
}

function googleRedirectUri(origin: string): string {
  return `${origin}/api/crm-oauth?action=callback&vendor=google`
}

function microsoftRedirectUri(origin: string): string {
  return `${origin}/api/crm-oauth?action=callback&vendor=microsoft`
}

async function persistTokens(orgId: string, integration: Integration, tokens: Record<string, unknown>): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) return
  const admin = createClient(SUPABASE_URL, SERVICE_KEY)
  const isEmail = integration === 'gmail' || integration === 'outlook'
  const isGoogle = integration === 'gmail' || integration === 'google_calendar'

  const { data: existing } = await admin
    .from('cs_integration_settings')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle()

  const prevSettings = (existing?.settings as Record<string, unknown>) ?? {}
  const patch: Record<string, unknown> = {
    organization_id: orgId,
    updated_at: new Date().toISOString(),
    settings: {
      ...prevSettings,
      [integration]: { ...tokens, connected_at: new Date().toISOString() },
    },
  }

  if (isEmail) {
    patch.email_provider = isGoogle ? 'gmail' : 'outlook'
    patch.email_connected = true
  } else {
    patch.calendar_provider = isGoogle ? 'google' : 'outlook'
    patch.calendar_connected = true
  }

  await admin.from('cs_integration_settings').upsert(patch, { onConflict: 'organization_id' })
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  const origin = baseUrl(req)

  if (action === 'callback') {
    const code = url.searchParams.get('code')
    const stateRaw = url.searchParams.get('state')
    const vendor = url.searchParams.get('vendor')
    const state = stateRaw ? decodeState(stateRaw) : null
    const returnTo = state?.returnTo || '/customer-success'

    if (!code || !state) return errorPage('Invalid OAuth callback', returnTo)

    try {
      if (vendor === 'google') {
        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
          return errorPage('Google OAuth is not configured on the server', returnTo)
        }
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: googleRedirectUri(origin),
            grant_type: 'authorization_code',
          }),
        })
        const tokens = await tokenRes.json()
        if (!tokenRes.ok) throw new Error(tokens.error_description || 'Google token exchange failed')
        await persistTokens(state.orgId, state.integration, tokens)
      } else {
        if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
          return errorPage('Microsoft OAuth is not configured on the server', returnTo)
        }
        const tokenRes = await fetch(
          `https://login.microsoftonline.com/${AZURE_TENANT}/oauth2/v2.0/token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: AZURE_CLIENT_ID,
              client_secret: AZURE_CLIENT_SECRET,
              redirect_uri: microsoftRedirectUri(origin),
              grant_type: 'authorization_code',
            }),
          },
        )
        const tokens = await tokenRes.json()
        if (!tokenRes.ok) throw new Error(tokens.error_description || 'Microsoft token exchange failed')
        await persistTokens(state.orgId, state.integration, tokens)
      }

      return redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}crm_oauth=connected`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OAuth failed'
      return errorPage(msg, returnTo)
    }
  }

  if (action === 'start') {
    const integration = url.searchParams.get('integration') as Integration | null
    const returnTo = url.searchParams.get('return_to') || '/customer-success'
    if (!integration) return new Response('Missing integration', { status: 400 })

    const auth = await authenticate(req)
    if (!auth) {
      return new Response('Unauthorized — sign in and retry connect from Katana Customers', { status: 401 })
    }

    const state = encodeState({
      integration,
      returnTo,
      orgId: auth.orgId,
      userId: auth.userId,
    })

    const isGoogle = integration === 'gmail' || integration === 'google_calendar'
    if (isGoogle) {
      if (!GOOGLE_CLIENT_ID) return errorPage('GOOGLE_CLIENT_ID not configured', returnTo)
      const scope =
        integration === 'gmail'
          ? 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send'
          : 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events'
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
      authUrl.searchParams.set('redirect_uri', googleRedirectUri(origin))
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', scope)
      authUrl.searchParams.set('access_type', 'offline')
      authUrl.searchParams.set('prompt', 'consent')
      authUrl.searchParams.set('state', state)
      return redirect(authUrl.toString())
    }

    if (!AZURE_CLIENT_ID) return errorPage('AZURE_CLIENT_ID not configured', returnTo)
    const scope =
      integration === 'outlook'
        ? 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access'
        : 'https://graph.microsoft.com/Calendars.ReadWrite offline_access'
    const authUrl = new URL(`https://login.microsoftonline.com/${AZURE_TENANT}/oauth2/v2.0/authorize`)
    authUrl.searchParams.set('client_id', AZURE_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', microsoftRedirectUri(origin))
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', scope)
    authUrl.searchParams.set('state', state)
    return redirect(authUrl.toString())
  }

  return new Response('CRM OAuth endpoint', { status: 200 })
}

export const config = { runtime: 'nodejs' }
