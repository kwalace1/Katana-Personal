// Agent Office API proxy — forwards /api/office/* to the SwarmClaw engine
// (Fly.io) with the office access key injected server-side. Runs on the edge so
// SSE chat streams pass through without buffering.
//
// The upstream engine is a single shared instance that returns everything to
// whoever holds the access key, and it CANNOT be modified. This proxy is the
// only trust boundary between the public internet and that engine, so it must:
//   1. Authenticate callers. Every request except a tiny public allowlist and
//      the chat endpoints (which have their own per-user isolation) requires a
//      signed-in Katana user (Supabase JWT). This stops anonymous reads of agent
//      configs, settings, and — critically — provider/MCP credentials.
//   2. Never leak secrets. Responses from secret-bearing endpoints (mcp-servers,
//      providers, credentials, …) are deep-redacted so raw tokens (Supabase PATs,
//      GitHub PATs, API keys) can never reach a browser, even an authenticated one.
//   3. Enforce per-user chat isolation. Identity is the Supabase `sub` (ES256,
//      verified against the project JWKS); the proxy filters the chat list, guards
//      per-chat reads/writes, and stamps the owner id on new sessions.
export const config = { runtime: 'edge' }

const SWARMCLAW_URL = (process.env.SWARMCLAW_URL || process.env.VITE_AGENT_OFFICE_URL || '').replace(/\/$/, '')
const SWARMCLAW_ACCESS_KEY = process.env.SWARMCLAW_ACCESS_KEY || process.env.VITE_AGENT_OFFICE_ACCESS_KEY || ''
// Public Supabase project URL (host of the JWKS used to verify user tokens).
// Public value (also baked into the client bundle); the hardcoded fallback keeps
// auth working even if the env var isn't set in Vercel.
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://uhvmhzmxsvrkzqqesbli.supabase.co').replace(/\/$/, '')

// Request headers we forward to the office. Everything else (cookies for the
// Katana domain, Vercel platform headers) stays behind.
const FORWARD_REQUEST_HEADERS = [
  'accept',
  'content-type',
  'x-access-key',
  'x-katana-jwt',
  'x-katana-org',
  'last-event-id',
  'x-webhook-secret',
]

// Hop-by-hop / re-encoding headers that must not be copied onto our response.
const SKIP_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'set-cookie', // office auth cookie is meaningless on the Katana domain
])

// Endpoints that never require authentication (status/liveness + the auth probe,
// which is answered by this proxy itself below).
const PUBLIC_PATHS = new Set(['auth', 'healthz', 'health', 'version'])

// Endpoints whose responses can carry provider/credential secrets. These require
// a strictly-verified caller AND have their responses deep-redacted. The engine
// stores raw tokens (SUPABASE_ACCESS_TOKEN, GitHub PAT, API keys) in these
// objects; the browser only ever needs the non-secret structure (names, ids,
// types), never the secret material.
const SENSITIVE_PATH_RE = /^(mcp-servers|providers|credentials|connectors|gateways|secrets|wallets|external-agents)(\/|$)/

// Object keys whose (possibly nested) string values are secrets.
const SECRET_KEY_RE = /^(env|headers|apikey|api_key|apikeyenc|accesstoken|access_token|token|authorization|auth|secret|secretkey|password|passwd|credential|credentials|privatekey|private_key|clientsecret|client_secret|refreshtoken|refresh_token|bearer|key)$/i

// String values that look like secrets regardless of the key they sit under —
// a backstop so an unexpected response shape can never leak a live token.
const SECRET_VALUE_RE = /(sbp_[A-Za-z0-9]{8,}|sbs_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|sk-or-v1-[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,})/

const REDACTED = '***REDACTED***'

/** Recursively redact secret string leaves by key name or value shape. Preserves
 *  structure (ids, names, types, which env keys exist) so the admin UI still works. */
function redactSecrets(value: unknown, keyHint = ''): unknown {
  if (typeof value === 'string') {
    if (SECRET_KEY_RE.test(keyHint)) return value ? REDACTED : value
    if (SECRET_VALUE_RE.test(value)) return REDACTED
    return value
  }
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v, keyHint))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      // For a secret-named object/array (e.g. `env`, `headers`), redact every
      // string leaf inside it, not just direct string values.
      out[k] = SECRET_KEY_RE.test(k) ? redactBranch(v) : redactSecrets(v, k)
    }
    return out
  }
  return value
}

/** Redact every string leaf inside a subtree (used for secret-named branches). */
function redactBranch(value: unknown): unknown {
  if (typeof value === 'string') return value ? REDACTED : value
  if (Array.isArray(value)) return value.map(redactBranch)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = redactBranch(v)
    return out
  }
  return value
}

// ---------------------------------------------------------------------------
// Supabase JWT (ES256) identity — verified against the project's public JWKS
// ---------------------------------------------------------------------------

function b64urlToBytes(b64url: string): Uint8Array<ArrayBuffer> {
  let s = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4
  if (pad) s += '='.repeat(4 - pad)
  const bin = atob(s)
  const bytes = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function b64urlToJson(b64url: string): any {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(b64url)))
}

// Time-bound an outbound fetch so a slow/unreachable dependency can never hang
// the whole request (which would tie up the edge function and its connection).
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ac.signal })
  } finally {
    clearTimeout(timer)
  }
}

let jwksCache: { keys: any[]; at: number } | null = null
const JWKS_TTL_MS = 10 * 60 * 1000
const JWKS_FETCH_TIMEOUT_MS = 2500

async function getJwks(): Promise<any[]> {
  const now = Date.now()
  if (jwksCache && now - jwksCache.at < JWKS_TTL_MS) return jwksCache.keys
  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
    { headers: { accept: 'application/json' } },
    JWKS_FETCH_TIMEOUT_MS,
  )
  if (!res.ok) throw new Error(`jwks ${res.status}`)
  const data = await res.json()
  jwksCache = { keys: Array.isArray(data?.keys) ? data.keys : [], at: now }
  return jwksCache.keys
}

/** true = valid signature, false = definitively invalid, undefined = couldn't verify. */
async function verifyEs256(token: string): Promise<boolean | undefined> {
  const [h, p, sig] = token.split('.')
  let header: any
  try { header = b64urlToJson(h) } catch { return undefined }
  if (header?.alg !== 'ES256' || !header?.kid) return undefined
  let keys: any[]
  try { keys = await getJwks() } catch { return undefined }
  const jwk = keys.find((k) => k?.kid === header.kid)
  if (!jwk) return undefined
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )
    const data = new TextEncoder().encode(`${h}.${p}`)
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64urlToBytes(sig), data)
  } catch {
    return undefined
  }
}

function decodeSub(token: string | null): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const sub = b64urlToJson(parts[1])?.sub
    return typeof sub === 'string' && sub ? sub : null
  } catch {
    return null
  }
}

/**
 * The caller's Supabase user id, or null when it can't be trusted. A forged
 * signature (verified against a reachable JWKS) is rejected; a token that simply
 * can't be verified (JWKS/crypto hiccup, or a kid not yet in the cached set)
 * degrades to its decoded `sub` so real users are never locked out of chat.
 */
async function callerSub(req: Request): Promise<string | null> {
  const token = req.headers.get('x-katana-jwt')
  const sub = decodeSub(token)
  if (!sub) return null
  const verdict = await verifyEs256(token!)
  if (verdict === false) return null
  return sub
}

/**
 * Strict identity: only returns the `sub` when the signature is cryptographically
 * verified against the JWKS. Used to gate secret-bearing endpoints — a forged or
 * unverifiable token is rejected (fail closed) rather than degraded.
 */
async function callerSubStrict(req: Request): Promise<string | null> {
  const token = req.headers.get('x-katana-jwt')
  const sub = decodeSub(token)
  if (!sub) return null
  const verdict = await verifyEs256(token!)
  return verdict === true ? sub : null
}

// Short-lived cache of session ownership so the per-item guard doesn't add an
// upstream round-trip (the engine is slow) to every read/message-send.
const ownerCache = new Map<string, { user?: string; at: number }>()
const OWNER_TTL_MS = 5 * 60 * 1000

/** Owner (`user`) of a session, fetched from the engine with the server key. */
async function sessionOwner(id: string): Promise<{ found: boolean; user?: string }> {
  const cached = ownerCache.get(id)
  if (cached && Date.now() - cached.at < OWNER_TTL_MS) {
    return { found: true, user: cached.user }
  }
  try {
    const res = await fetchWithTimeout(
      `${SWARMCLAW_URL}/api/chats/${encodeURIComponent(id)}`,
      { headers: SWARMCLAW_ACCESS_KEY ? { 'x-access-key': SWARMCLAW_ACCESS_KEY } : {} },
      8000,
    )
    if (!res.ok) return { found: false }
    const data = await res.json()
    const user = typeof data?.user === 'string' ? data.user : undefined
    ownerCache.set(id, { user, at: Date.now() })
    return { found: true, user }
  } catch {
    return { found: false }
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function relay(upstream: Response): Response {
  const responseHeaders = new Headers()
  upstream.headers.forEach((value, key) => {
    if (!SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) responseHeaders.set(key, value)
  })
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

/** Fetch a secret-bearing endpoint and relay it with all secret values redacted. */
async function relayRedacted(target: string, init: RequestInit): Promise<Response> {
  let upstream: Response
  try {
    upstream = await fetch(target, init)
  } catch {
    return Response.json({ error: 'Agent Office is unreachable' }, { status: 502 })
  }
  const ct = upstream.headers.get('content-type') || ''
  if (!upstream.ok || !ct.includes('json')) return relay(upstream)
  let data: unknown
  try {
    data = await upstream.json()
  } catch {
    // Can't parse — refuse rather than risk relaying raw secret bytes.
    return jsonResponse({ error: 'Upstream returned an unreadable response' }, 502)
  }
  return jsonResponse(redactSecrets(data), upstream.status)
}

export default async function handler(req: Request): Promise<Response> {
  if (!SWARMCLAW_URL) {
    return Response.json(
      { error: 'Agent Office is not configured (missing SWARMCLAW_URL)' },
      { status: 503 },
    )
  }

  const url = new URL(req.url)
  const rest = url.pathname.replace(/^\/api\/office\/?/, '')
  const method = req.method.toUpperCase()
  const firstSegment = rest.split(/[/?]/)[0]

  // The office's GET /api/auth probe only validates its own session cookie,
  // which can never exist on the Katana domain. When a server key is configured,
  // answer the probe by validating that key upstream (POST /api/auth). Public.
  if (SWARMCLAW_ACCESS_KEY && method === 'GET' && rest === 'auth') {
    try {
      const upstream = await fetch(`${SWARMCLAW_URL}/api/auth`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: SWARMCLAW_ACCESS_KEY }),
      })
      return Response.json({ firstTime: false, authenticated: upstream.ok })
    } catch {
      return Response.json({ error: 'Agent Office is unreachable' }, { status: 502 })
    }
  }

  // Vercel's catch-all invocation appends its internal `...path` param — don't
  // leak it to the engine.
  url.searchParams.delete('...path')
  const target = `${SWARMCLAW_URL}/api/${rest}${url.search}`

  const headers = new Headers()
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = req.headers.get(name)
    if (value) headers.set(name, value)
  }
  // Server-side key injection: the browser never needs the office access key in
  // production. A client-provided key (dev/testing) is only used when no server
  // key is configured.
  if (SWARMCLAW_ACCESS_KEY) headers.set('x-access-key', SWARMCLAW_ACCESS_KEY)

  const isChatsRoot = rest === 'chats'
  const isChatItem = rest.startsWith('chats/')
  const isChat = isChatsRoot || isChatItem
  const isPublic = PUBLIC_PATHS.has(firstSegment)
  const isSensitive = SENSITIVE_PATH_RE.test(rest)

  // ----- Authentication gate (everything except chat + public allowlist) ------
  // Chat endpoints run their own per-user isolation below. Public endpoints are
  // status/liveness only. Everything else — agent configs, settings, eval, and
  // the secret-bearing endpoints — requires a signed-in Katana user. Secret
  // endpoints additionally require a strictly-verified signature (fail closed).
  if (!isChat && !isPublic) {
    const sub = isSensitive ? await callerSubStrict(req) : await callerSub(req)
    if (!sub) return jsonResponse({ error: 'Unauthorized' }, 401)
    if (isSensitive) {
      const init: RequestInit = {
        method,
        headers,
        body: method === 'GET' || method === 'HEAD' ? undefined : req.body,
        // @ts-expect-error — duplex is required for streaming request bodies on edge
        duplex: 'half',
        redirect: 'manual',
      }
      return relayRedacted(target, init)
    }
    // Non-sensitive authenticated admin request falls through to the generic proxy.
  }

  // ----- Per-user chat isolation ---------------------------------------------
  // Each user gets their own session per agent, created via POST /chats (which
  // honors the `user` field, unlike the engine's shared /agents/:id/thread).
  const isSessionCreate = method === 'POST' && isChatsRoot

  // Stamp the verified owner id onto new sessions so ownership is authoritative
  // (a client cannot create a chat under someone else's identity).
  if (isSessionCreate) {
    const sub = await callerSub(req)
    if (sub) {
      let bodyText = ''
      try { bodyText = await req.text() } catch { bodyText = '' }
      try {
        const obj = bodyText ? JSON.parse(bodyText) : {}
        obj.user = sub
        bodyText = JSON.stringify(obj)
      } catch { /* non-JSON body: forward as-is */ }
      headers.set('content-type', 'application/json')
      try {
        return relay(await fetch(target, { method, headers, body: bodyText, redirect: 'manual' }))
      } catch {
        return Response.json({ error: 'Agent Office is unreachable' }, { status: 502 })
      }
    }
    // No trusted identity — reject rather than create an unowned session.
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  // Guard every read/write on a specific chat by ownership.
  if (isChatItem) {
    const sub = await callerSub(req)
    if (!sub) return jsonResponse({ error: 'Forbidden' }, 403)
    const id = rest.split('/')[1]
    const owner = await sessionOwner(id)
    if (!owner.found) return jsonResponse({ error: 'Not found' }, 404)
    if (owner.user !== sub) return jsonResponse({ error: 'Forbidden' }, 403)
    // Owner confirmed — continue to the generic proxy below.
  }

  // Filter the chat list to the caller's own sessions.
  if (isChatsRoot && method === 'GET') {
    const sub = await callerSub(req)
    if (!sub) return jsonResponse({})
    let upstream: Response
    try {
      upstream = await fetch(target, { method, headers, redirect: 'manual' })
    } catch {
      return Response.json({ error: 'Agent Office is unreachable' }, { status: 502 })
    }
    const ct = upstream.headers.get('content-type') || ''
    if (!upstream.ok || !ct.includes('json')) return relay(upstream)
    let data: any
    try { data = await upstream.json() } catch { return jsonResponse({}) }
    const filtered: Record<string, unknown> = {}
    if (data && typeof data === 'object') {
      for (const [id, session] of Object.entries(data)) {
        if (session && typeof session === 'object' && (session as any).user === sub) {
          filtered[id] = session
        }
      }
    }
    return jsonResponse(filtered)
  }

  // Bulk delete: only allow removing sessions the caller owns.
  if (isChatsRoot && method === 'DELETE') {
    const sub = await callerSub(req)
    if (!sub) return jsonResponse({ error: 'Forbidden' }, 403)
    let bodyText = ''
    try { bodyText = await req.text() } catch { bodyText = '' }
    let ids: string[] = []
    try { ids = (JSON.parse(bodyText || '{}').ids as string[]) || [] } catch { ids = [] }
    for (const id of ids) {
      const owner = await sessionOwner(id)
      if (owner.found && owner.user !== sub) return jsonResponse({ error: 'Forbidden' }, 403)
    }
    headers.set('content-type', 'application/json')
    try {
      return relay(await fetch(target, { method, headers, body: bodyText, redirect: 'manual' }))
    } catch {
      return Response.json({ error: 'Agent Office is unreachable' }, { status: 502 })
    }
  }

  // ----- Generic proxy (agents, settings, and owner-checked chat items) -------
  const init: RequestInit = {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : req.body,
    // @ts-expect-error — duplex is required for streaming request bodies on edge
    duplex: 'half',
    redirect: 'manual',
  }

  try {
    return relay(await fetch(target, init))
  } catch {
    return Response.json({ error: 'Agent Office is unreachable' }, { status: 502 })
  }
}
