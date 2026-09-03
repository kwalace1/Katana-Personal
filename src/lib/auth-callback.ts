export const CLOUD_AUTH_CALLBACK_PATH = '/auth/callback'

export type AuthCallbackParams = {
  code: string | null
  tokenHash: string | null
  type: string | null
  error: string | null
  accessToken: string | null
}

function hashParams(hash: string): URLSearchParams {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  return new URLSearchParams(raw)
}

/** Query + hash params Supabase puts on the confirmation / magic-link return URL. */
export function getAuthCallbackParams(
  search = typeof window === 'undefined' ? '' : window.location.search,
  hash = typeof window === 'undefined' ? '' : window.location.hash,
): AuthCallbackParams {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const h = hashParams(hash)
  const error =
    q.get('error_description') ||
    h.get('error_description') ||
    q.get('error') ||
    h.get('error')
  return {
    code: q.get('code') || h.get('code'),
    tokenHash: q.get('token_hash') || h.get('token_hash'),
    type: q.get('type') || h.get('type'),
    error,
    accessToken: h.get('access_token'),
  }
}

export function isAuthCallbackLocation(
  search?: string,
  hash?: string,
): boolean {
  const p = getAuthCallbackParams(search, hash)
  return Boolean(p.code || p.tokenHash || p.accessToken || p.error)
}

export function cloudEmailRedirectTo(): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}${CLOUD_AUTH_CALLBACK_PATH}`
}

export function mapCloudAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Couldn’t sign in'
  const msg = raw.toLowerCase()
  if (msg.includes('email not confirmed')) {
    return 'Confirm your email first — open the link we sent, then sign in. If you don’t see it in your inbox, check your spam.'
  }
  if (msg.includes('invalid login credentials')) {
    return 'Email or password doesn’t match. Try Sign in, or Create if you’re new.'
  }
  if (msg.includes('user already registered')) {
    return 'This email already has an account. Use Sign in instead.'
  }
  if (msg.includes('row-level security') || msg.includes('not authenticated')) {
    return 'Confirm your email first — open the link we sent, then come back. If you don’t see it in your inbox, check your spam.'
  }
  return raw
}
