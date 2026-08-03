/**
 * Katana → Switch handoff proxy.
 * POST /api/switch/handoff
 *
 * Authenticates the Katana user, then POSTs the handoff envelope to Switch
 * with HTTP Basic credentials. Prefer SWITCH_HANDOFF_URL; else SWITCH_API_BASE_URL + /api/katana/handoff.
 *
 * Contract: Katana Switch/docs/KATANA_IMPORT_HANDOFF.md
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

function getSwitchBaseUrl(): string {
  return (process.env.SWITCH_API_BASE_URL || process.env.VITE_SWITCH_API_BASE_URL || '').replace(/\/$/, '')
}

/** Full Switch handoff endpoint (production: https://veyah.vercel.app/api/katana/handoff). */
export function getSwitchHandoffUrl(): string | null {
  const full = process.env.SWITCH_HANDOFF_URL?.trim()
  if (full) return full.replace(/\/$/, '')
  const base = getSwitchBaseUrl()
  if (!base) return null
  return `${base}/api/katana/handoff`
}

async function authenticateKatanaUser(
  req: Request,
): Promise<{ userId: string; orgId: string } | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ') || !SUPABASE_URL) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
  })
  if (!res.ok) return null
  const user = (await res.json()) as { id?: string }
  if (!user?.id) return null

  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${user.id}&select=organization_id`,
    { headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY } },
  )
  const profiles = (await profileRes.json()) as Array<{ organization_id?: string }>
  const orgId = profiles?.[0]?.organization_id
  if (!orgId) return null
  return { userId: user.id, orgId }
}

/**
 * Auth headers for Switch POST /api/katana/handoff.
 * Prefer Basic client_id:client_secret; Switch also accepts Bearer secret + X-Switch-Client-Id.
 */
function getSwitchHandoffAuthHeaders():
  | { headers: Record<string, string> }
  | { error: string } {
  const clientId = process.env.SWITCH_HANDOFF_CLIENT_ID?.trim()
  const clientSecret = process.env.SWITCH_HANDOFF_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    return {
      error:
        'Switch handoff not configured. Set SWITCH_HANDOFF_URL (or SWITCH_API_BASE_URL), SWITCH_HANDOFF_CLIENT_ID, and SWITCH_HANDOFF_CLIENT_SECRET.',
    }
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')
  return {
    headers: {
      Authorization: `Basic ${basic}`,
    },
  }
}

/** Switch binds org on the credential — actor.organization_id must match this UUID. */
function getSwitchHandoffOrganizationId(): string | null {
  return process.env.SWITCH_HANDOFF_ORGANIZATION_ID?.trim() || null
}

function validateEnvelope(body: Record<string, unknown>): string | null {
  if (typeof body.module !== 'string' || !body.module) return 'module is required'
  if (typeof body.entity_type !== 'string' || !body.entity_type) return 'entity_type is required'
  if (typeof body.source_label !== 'string' || !body.source_label) return 'source_label is required'
  if (typeof body.parsed !== 'boolean') return 'parsed must be a boolean'
  const actor = body.actor as { user_id?: string; organization_id?: string } | undefined
  if (!actor?.user_id || !actor?.organization_id) return 'actor.user_id and actor.organization_id are required'
  const hasFile = body.file != null && typeof body.file === 'object'
  const rows = body.rows
  const hasRows = Array.isArray(rows) && rows.length > 0
  if (!hasFile && !hasRows) return 'file and/or rows required'
  if (body.parsed === true && !hasRows) return 'rows required when parsed is true'
  return null
}

export async function handleSwitchHandoffOutbound(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }
  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
  }

  const auth = await authenticateKatanaUser(req)
  if (!auth) {
    return json(401, { ok: false, error: 'Valid Bearer token required', code: 'UNAUTHORIZED' })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body', code: 'INVALID_REQUEST' })
  }

  const validationError = validateEnvelope(body)
  if (validationError) {
    return json(400, { ok: false, error: validationError, code: 'VALIDATION_ERROR' })
  }

  // Bind actor to authenticated user/org (do not trust free-form mismatch)
  const actor = body.actor as { user_id: string; organization_id: string }
  if (actor.user_id !== auth.userId || actor.organization_id !== auth.orgId) {
    return json(403, {
      ok: false,
      error: 'actor must match authenticated user and organization',
      code: 'FORBIDDEN',
    })
  }

  const handoffUrl = getSwitchHandoffUrl()
  if (!handoffUrl) {
    return json(503, {
      ok: false,
      error: 'SWITCH_HANDOFF_URL or SWITCH_API_BASE_URL is not configured',
      code: 'NOT_CONFIGURED',
    })
  }

  const switchAuth = getSwitchHandoffAuthHeaders()
  if ('error' in switchAuth) {
    return json(503, { ok: false, error: switchAuth.error, code: 'NOT_CONFIGURED' })
  }

  const switchOrgId = getSwitchHandoffOrganizationId()
  if (!switchOrgId) {
    return json(503, {
      ok: false,
      error:
        'SWITCH_HANDOFF_ORGANIZATION_ID is not configured (must match Switch credential org to avoid ORG_MISMATCH)',
      code: 'NOT_CONFIGURED',
    })
  }

  // Forward envelope with Switch-bound org (Katana user id kept for audit)
  const outboundBody = {
    ...body,
    file: body.file ?? null,
    context: body.context ?? {},
    rows: body.rows ?? null,
    upsert_key: body.upsert_key ?? null,
    target: body.target ?? null,
    actor: {
      user_id: auth.userId,
      organization_id: switchOrgId,
    },
  }

  let switchRes: Response
  try {
    switchRes = await fetch(handoffUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...switchAuth.headers,
      },
      body: JSON.stringify(outboundBody),
      signal: AbortSignal.timeout(60_000),
    })
  } catch (e) {
    return json(502, {
      ok: false,
      error: e instanceof Error ? e.message : 'Failed to reach Switch handoff endpoint',
      code: 'SWITCH_UNREACHABLE',
      details: { url: handoffUrl },
    })
  }

  const text = await switchRes.text()
  let parsed: unknown
  try {
    parsed = text ? JSON.parse(text) : {}
  } catch {
    return json(502, {
      ok: false,
      error: `Switch returned non-JSON (${switchRes.status})`,
      code: 'SWITCH_BAD_RESPONSE',
      details: { status: switchRes.status, body: text.slice(0, 300) },
    })
  }

  if (!switchRes.ok) {
    return json(switchRes.status >= 400 && switchRes.status < 600 ? switchRes.status : 502, {
      ok: false,
      error:
        typeof parsed === 'object' && parsed && 'error' in parsed
          ? String((parsed as { error: unknown }).error)
          : `Switch handoff failed (${switchRes.status})`,
      code: 'SWITCH_HANDOFF_ERROR',
      details: parsed,
    })
  }

  // Strict contract check — if Switch differs, surface clearly for doc update
  const result = parsed as {
    ok?: boolean
    import_id?: string
    import_url?: string
    dataset_type?: string
    module?: string
  }
  if (
    result.ok !== true ||
    typeof result.import_id !== 'string' ||
    typeof result.import_url !== 'string'
  ) {
    return json(502, {
      ok: false,
      error:
        'Switch handoff response does not match KATANA_IMPORT_HANDOFF.md (expected ok, import_id, import_url). Update the shared doc with the Switch agent.',
      code: 'CONTRACT_MISMATCH',
      details: parsed,
    })
  }

  return json(200, {
    ok: true,
    import_id: result.import_id,
    import_url: result.import_url,
    dataset_type: result.dataset_type ?? String(body.module),
    module: result.module ?? String(body.module),
  })
}

/** Dev helper — optional service client (unused for now; reserved). */
export function getHandoffAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!SUPABASE_URL || !key) return null
  return createClient(SUPABASE_URL, key)
}
