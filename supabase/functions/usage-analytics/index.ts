// usage-analytics — server-side OpenRouter credit/usage reporting for the
// "AI Usage & Credits" dashboard.
//
// Katana stores no per-call AI cost anywhere; the authoritative numbers live in
// OpenRouter. This function is the only place the OpenRouter key is used for
// reporting, so it must:
//   1. Authenticate the caller (Supabase user JWT; deployed with verify_jwt).
//   2. Gate to the operator org. ANY signed-in Katana user (across every tenant)
//      could otherwise read DW Growth Capital's total AI spend, so we look up the
//      caller's org with the service role and allow only operator-org members.
//   3. Never leak the key. The raw OpenRouter key never leaves this function; the
//      browser only ever receives aggregated numbers.
//
// Data source: OpenRouter GET /api/v1/activity (last 30 completed UTC days,
// grouped by model/provider) + GET /api/v1/credits (purchased vs used). Both
// require a provisioning/management key; an inference key is rejected, in which
// case we surface { status: 'key_unauthorized' } so the UI can prompt for one.
//
// Deploy: MCP deploy_edge_function (verify_jwt: true).
// Secrets: OPENROUTER_PROVISIONING_KEY (preferred) or OPENROUTER_API_KEY (fallback).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

// Operator-org gate — mirrors src/lib/platform-support-access.ts. Overridable via
// env for non-default deployments.
const DEFAULT_PLATFORM_EMAIL_DOMAINS = ['dwgrowthcapital.onmicrosoft.com', 'dwgrowth.onmicrosoft.com']

function platformEmailDomains(): string[] {
  const raw = (Deno.env.get('KATANA_PLATFORM_EMAIL_DOMAINS') ?? '').trim()
  if (!raw) return DEFAULT_PLATFORM_EMAIL_DOMAINS
  const list = raw.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
  return list.length ? list : DEFAULT_PLATFORM_EMAIL_DOMAINS
}

function domainMatches(domain: string, domains: string[]): boolean {
  const d = domain.trim().toLowerCase()
  if (!d) return false
  return domains.some((base) => d === base || d.endsWith(`.${base}`))
}

function emailDomainMatches(email: string, domains: string[]): boolean {
  const at = email.trim().toLowerCase().lastIndexOf('@')
  if (at < 0) return false
  return domainMatches(email.trim().toLowerCase().slice(at + 1), domains)
}

/** Is this caller a member of the operator org (DW Growth Capital)? Role-agnostic. */
function isOperatorOrgMember(args: {
  email: string
  orgName: string | null
  orgDomain: string | null
  orgId: string | null
}): boolean {
  const domains = platformEmailDomains()
  const name = (args.orgName ?? '').toLowerCase()
  if (name.includes('dw growth') && name.includes('capital')) return true

  const platformOrgId = (Deno.env.get('KATANA_PLATFORM_ORG_ID') ?? '').trim()
  if (platformOrgId && args.orgId === platformOrgId) return true

  if (args.orgDomain && domainMatches(args.orgDomain, domains)) return true
  if (emailDomainMatches(args.email, domains)) return true
  return false
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(n) ? (n as number) : 0
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

// Normalize one OpenRouter activity row into a stable shape. OpenRouter's exact
// field names have varied, so read defensively (prefer the documented names,
// fall back to older/alternate ones) and never trust a missing field.
interface UsageRow {
  date: string
  model: string
  provider: string | null
  usage: number // paid spend in USD (non-BYOK)
  byok_usage: number // spend routed through the user's own provider key (BYOK)
  requests: number
  prompt_tokens: number
  completion_tokens: number
  reasoning_tokens: number
}

function normalizeRow(raw: Record<string, unknown>): UsageRow {
  const provider = str(raw.provider_name) || str(raw.provider) || null
  return {
    date: str(raw.date) || str(raw.day) || '',
    model: str(raw.model) || str(raw.model_permaslug) || 'unknown',
    provider: provider || null,
    usage: num(raw.usage ?? raw.cost ?? raw.spend),
    byok_usage: num(raw.byok_usage_inference ?? raw.byok_usage ?? raw.byok),
    requests: num(raw.requests ?? raw.request_count ?? raw.count),
    prompt_tokens: num(raw.prompt_tokens ?? raw.tokens_prompt),
    completion_tokens: num(raw.completion_tokens ?? raw.tokens_completion),
    reasoning_tokens: num(raw.reasoning_tokens ?? raw.tokens_reasoning),
  }
}

async function fetchOpenRouter(path: string, key: string): Promise<Response> {
  return fetch(`${OPENROUTER_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': 'https://katana.dwgrowth.com',
      'X-Title': 'Katana Usage Dashboard',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const PROVISIONING = Deno.env.get('OPENROUTER_PROVISIONING_KEY') ?? ''
  const INFERENCE = Deno.env.get('OPENROUTER_API_KEY') ?? ''

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ error: 'missing authorization' }, 401)

  // ---- Identify the caller (verified user JWT) --------------------------------
  const authClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await authClient.auth.getUser()
  const user = userData?.user
  if (userErr || !user) return json({ error: 'unauthorized' }, 401)

  // ---- Operator-org gate (service role, bypasses RLS) -------------------------
  const admin = createClient(SUPABASE_URL, SERVICE)
  const { data: profile } = await admin
    .from('user_profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  let orgName: string | null = null
  let orgDomain: string | null = null
  const orgId: string | null = (profile?.organization_id as string | undefined) ?? null
  if (orgId) {
    const { data: org } = await admin
      .from('organizations')
      .select('name, domain')
      .eq('id', orgId)
      .maybeSingle()
    orgName = (org?.name as string | undefined) ?? null
    orgDomain = (org?.domain as string | undefined) ?? null
  }

  const allowed = isOperatorOrgMember({
    email: user.email ?? '',
    orgName,
    orgDomain,
    orgId,
  })
  if (!allowed) return json({ error: 'forbidden' }, 403)

  // ---- Choose the OpenRouter key ---------------------------------------------
  const key = PROVISIONING || INFERENCE
  const keyType = PROVISIONING ? 'provisioning' : INFERENCE ? 'inference' : 'none'
  if (!key) {
    return json({ status: 'no_key', message: 'No OpenRouter key configured on the server.' })
  }

  // ---- Fetch activity + credits ----------------------------------------------
  let activityRes: Response
  let creditsRes: Response
  try {
    ;[activityRes, creditsRes] = await Promise.all([
      fetchOpenRouter('/activity', key),
      fetchOpenRouter('/credits', key),
    ])
  } catch {
    return json({ status: 'openrouter_unreachable', message: 'OpenRouter is unreachable.' }, 502)
  }

  // An inference key can't read account activity → 401/403. Surface a clear
  // signal so the UI can prompt for a provisioning key instead of erroring.
  if (activityRes.status === 401 || activityRes.status === 403) {
    let detail = ''
    try {
      detail = str((await activityRes.json())?.error?.message)
    } catch { /* ignore */ }
    console.log(JSON.stringify({ fn: 'usage-analytics', result: 'key_unauthorized', keyType, activityStatus: activityRes.status }))
    return json({
      status: 'key_unauthorized',
      keyType,
      message:
        detail ||
        'OpenRouter rejected this key for the activity API. A provisioning (management) key is required.',
    })
  }

  if (!activityRes.ok) {
    return json(
      { status: 'openrouter_error', code: activityRes.status, message: `OpenRouter returned ${activityRes.status}.` },
      502,
    )
  }

  let activityJson: any = null
  try {
    activityJson = await activityRes.json()
  } catch {
    return json({ status: 'openrouter_error', message: 'Unreadable activity response.' }, 502)
  }

  const rawRows: Array<Record<string, unknown>> = Array.isArray(activityJson?.data)
    ? activityJson.data
    : Array.isArray(activityJson)
      ? activityJson
      : []
  const rows = rawRows.map(normalizeRow).filter((r) => r.date)

  // Credits are best-effort — a failure here should not blank the whole dashboard.
  let credits: { total_credits: number; total_usage: number; remaining: number } | null = null
  if (creditsRes.ok) {
    try {
      const cj = await creditsRes.json()
      const d = cj?.data ?? cj ?? {}
      const total_credits = num(d.total_credits)
      const total_usage = num(d.total_usage)
      credits = { total_credits, total_usage, remaining: total_credits - total_usage }
    } catch { /* leave credits null */ }
  }

  console.log(JSON.stringify({ fn: 'usage-analytics', result: 'ok', keyType, rowCount: rows.length, hasCredits: !!credits }))
  return json({
    status: 'ok',
    keyType,
    credits,
    rows,
    meta: {
      fetchedAt: new Date().toISOString(),
      rangeDays: 30,
      rowCount: rows.length,
    },
  })
})
