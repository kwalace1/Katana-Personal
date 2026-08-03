import { fetchWithTimeout, isAbortError, isTimeoutError } from '@/lib/office/fetch-timeout'
import { safeStorageGet, safeStorageSet, safeStorageRemove } from '@/lib/office/app/safe-storage'
import { sleep, hmrSingleton } from '@/lib/office/shared-utils'

const ACCESS_KEY_STORAGE = 'sc_access_key'
const DEFAULT_API_TIMEOUT_MS = 12_000
const DEFAULT_GET_RETRIES = 2
const RETRY_DELAY_BASE_MS = 300
const inflightGetRequests = hmrSingleton('apiClient_inflightGetRequests', () => new Map<string, Promise<unknown>>())

// Native Katana office: the access key ships via env (dev) or is injected
// server-side by the /api/office proxy (prod). localStorage remains a fallback
// so a manually-entered key still works.
const ENV_ACCESS_KEY = (import.meta.env.VITE_AGENT_OFFICE_ACCESS_KEY as string | undefined) || ''

export function getStoredAccessKey(): string {
  return ENV_ACCESS_KEY || safeStorageGet(ACCESS_KEY_STORAGE) || ''
}

export function setStoredAccessKey(key: string) {
  safeStorageSet(ACCESS_KEY_STORAGE, key)
}

export function clearStoredAccessKey() {
  safeStorageRemove(ACCESS_KEY_STORAGE)
}

function buildInflightGetKey(path: string, key: string): string {
  return `${key}::${path}`
}

// Katana tenant isolation: the host posts the signed-in user's Supabase JWT into
// the iframe; we keep it in sessionStorage (per-tab, not persisted) and forward
// it on every request so the office can query the DB as that user.
const KATANA_JWT_KEY = 'sc_katana_jwt'
const KATANA_ORG_KEY = 'sc_katana_org'

function sessionGet(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function setKatanaAuth(jwt: string, org: string | null) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(KATANA_JWT_KEY, jwt)
    if (org) window.sessionStorage.setItem(KATANA_ORG_KEY, org)
  } catch {
    /* sessionStorage unavailable */
  }
}

/**
 * Headers carrying the signed-in Katana user's identity. Spread into the raw
 * `fetch` calls used for SSE streaming (chat), which bypass the `api()` wrapper,
 * so RLS-enforced agents query the DB as the signed-in user.
 */
export function katanaAuthHeaders(): Record<string, string> {
  const jwt = sessionGet(KATANA_JWT_KEY)
  const org = sessionGet(KATANA_ORG_KEY)
  return {
    ...(jwt ? { 'X-Katana-Jwt': jwt } : {}),
    ...(org ? { 'X-Katana-Org': org } : {}),
  }
}

export async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  options?: { timeoutMs?: number; retries?: number },
): Promise<T> {
  const key = getStoredAccessKey()
  const timeoutMs = Math.max(1_000, Math.trunc(options?.timeoutMs ?? DEFAULT_API_TIMEOUT_MS))
  const upperMethod = method.toUpperCase()
  const retries = Math.max(0, Math.trunc(options?.retries ?? (upperMethod === 'GET' ? DEFAULT_GET_RETRIES : 0)))

  const katanaJwt = sessionGet(KATANA_JWT_KEY)
  const katanaOrg = sessionGet(KATANA_ORG_KEY)
  const requestInit: RequestInit = {
    method: upperMethod,
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { 'X-Access-Key': key } : {}),
      ...(katanaJwt ? { 'X-Katana-Jwt': katanaJwt } : {}),
      ...(katanaOrg ? { 'X-Katana-Org': katanaOrg } : {}),
    },
  }
  if (body) requestInit.body = JSON.stringify(body)

  const runRequest = async (): Promise<T> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const r = await fetchWithTimeout('/api/office' + path, requestInit, timeoutMs)

        if (r.status === 401) {
          // Clear stored key on auth failure, redirect to login
          clearStoredAccessKey()
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('sc_auth_required'))
          }
          throw new Error('Unauthorized — invalid access key')
        }

        const ct = r.headers.get('content-type') || ''

        if (!r.ok) {
          if (ct.includes('json')) {
            const payload = await r.json().catch(() => null) as { error?: unknown; message?: unknown } | null
            const msg =
              (typeof payload?.error === 'string' && payload.error.trim())
              || (typeof payload?.message === 'string' && payload.message.trim())
              || `Request failed (${r.status})`
            throw new Error(msg)
          }
          const text = (await r.text().catch(() => '')).trim()
          throw new Error(text || `Request failed (${r.status})`)
        }

        if (ct.includes('json')) return r.json() as Promise<T>
        return r.text() as unknown as T
      } catch (err) {
        const isLastAttempt = attempt >= retries
        const retryable =
          isAbortError(err)
          || isTimeoutError(err)
          || (err instanceof TypeError && !String(err.message || '').includes('Unauthorized'))
        if (isLastAttempt || !retryable) throw err
        await sleep(RETRY_DELAY_BASE_MS * (attempt + 1))
      }
    }
    throw new Error('Request failed')
  }

  if (upperMethod !== 'GET') {
    return runRequest()
  }

  const inflightKey = buildInflightGetKey(path, key)
  const existing = inflightGetRequests.get(inflightKey)
  if (existing) return existing as Promise<T>

  const requestPromise = runRequest().finally(() => {
    if (inflightGetRequests.get(inflightKey) === requestPromise) {
      inflightGetRequests.delete(inflightKey)
    }
  })
  inflightGetRequests.set(inflightKey, requestPromise)
  return requestPromise
}
