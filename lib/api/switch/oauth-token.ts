/**
 * Switch OAuth token endpoint — client credentials grant
 * POST /switch/oauth/token
 */

import { authenticateClientCredentials, issueAccessToken } from './switch-auth'
import { getKatanaApiBaseUrl, isSwitchOAuthConfigured } from './switch-config'
import { switchError, switchJson, withCors, corsHeaders } from './switch-errors'

export async function handleSwitchOAuthToken(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }

  if (req.method !== 'POST') {
    return withCors(switchError(405, 'INVALID_REQUEST', 'Method not allowed'))
  }

  if (!isSwitchOAuthConfigured()) {
    return withCors(
      switchError(
        503,
        'NOT_CONFIGURED',
        'Switch OAuth is not configured. Set SUPABASE_SERVICE_ROLE_KEY and run supabase-switch-integration-migration.sql. Optionally set SWITCH_OAUTH_CLIENT_ID, SWITCH_OAUTH_CLIENT_SECRET, SWITCH_DEFAULT_ORG_ID for env-based client.',
      ),
    )
  }

  let body: Record<string, unknown>
  const contentType = req.headers.get('content-type') || ''

  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text()
      const params = new URLSearchParams(text)
      body = {
        grant_type: params.get('grant_type'),
        client_id: params.get('client_id'),
        client_secret: params.get('client_secret'),
      }
    } else {
      body = (await req.json()) as Record<string, unknown>
    }
  } catch {
    return withCors(switchError(400, 'INVALID_REQUEST', 'Invalid request body'))
  }

  const grantType = String(body.grant_type ?? '')
  if (grantType !== 'client_credentials') {
    return withCors(switchError(400, 'VALIDATION_ERROR', 'grant_type must be client_credentials'))
  }

  const clientId = String(body.client_id ?? '').trim()
  const clientSecret = String(body.client_secret ?? '').trim()
  if (!clientId || !clientSecret) {
    return withCors(
      switchError(400, 'VALIDATION_ERROR', 'client_id and client_secret are required', {
        details: [{ message: 'Missing OAuth client credentials' }],
      }),
    )
  }

  const ctx = await authenticateClientCredentials(clientId, clientSecret)
  if (!ctx) {
    return withCors(switchError(401, 'UNAUTHORIZED', 'Invalid client credentials'))
  }

  const token = await issueAccessToken(ctx)
  if (!token) {
    return withCors(switchError(500, 'INTERNAL_ERROR', 'Failed to issue access token'))
  }

  return withCors(
    switchJson({
      ...token,
      api_base_url: getKatanaApiBaseUrl(req),
    }),
  )
}
