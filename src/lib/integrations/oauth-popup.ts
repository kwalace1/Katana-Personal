import type { OAuthTokens } from './types'
import { apiUrl } from '@/lib/api-origin'
import { isNativeShell } from '@/lib/native/platform'

export const OAUTH_HASH_PREFIX = 'katana_oauth='
export const OAUTH_QUERY_PARAM = 'katana_oauth'
export const OAUTH_EXPECT_KEY = 'katana-oauth-expect'

/** Deep link back into the iOS app after OAuth (must match Info.plist URL scheme). */
export const NATIVE_OAUTH_RETURN_ORIGIN = 'katanapersonal://oauth-return'

export type OAuthMessagePayload = {
  type: string
  tokens?: OAuthTokens | null
  error?: string | null
}

function oauthStartUrl(path: string): string {
  const origin = isNativeShell() ? NATIVE_OAUTH_RETURN_ORIGIN : window.location.origin
  return `${path}?action=start&origin=${encodeURIComponent(origin)}`
}

/** Popup on web; system browser + deep link on native (WKWebView cannot complete OAuth alone). */
export function openIntegrationOAuthPopup(
  path: string,
  messageType: string,
  windowName: string,
): Promise<OAuthTokens | { redirected: true }> {
  const startPath = oauthStartUrl(path)

  if (isNativeShell()) {
    try {
      sessionStorage.setItem(OAUTH_EXPECT_KEY, messageType)
    } catch {
      // ignore
    }
    void openNativeOAuthBrowser(apiUrl(startPath))
    return Promise.resolve({ redirected: true as const })
  }

  return new Promise((resolve, reject) => {
    const popup = window.open(startPath, windowName, 'width=520,height=720')
    if (!popup) {
      reject(new Error('Popup blocked — allow popups to connect.'))
      return
    }

    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('Sign-in timed out.'))
    }, 120_000)

    function onMessage(ev: MessageEvent) {
      const data = ev.data as OAuthMessagePayload
      if (data?.type !== messageType) return
      cleanup()
      if (data.error) reject(new Error(data.error))
      else if (data.tokens?.access_token) resolve(data.tokens)
      else reject(new Error('No OAuth tokens returned.'))
    }

    function cleanup() {
      window.clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
    }

    window.addEventListener('message', onMessage)
  })
}

async function openNativeOAuthBrowser(url: string) {
  try {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url, presentationStyle: 'fullscreen' })
  } catch {
    // Fallback: same-window navigation if Browser plugin is unavailable
    window.location.assign(url)
  }
}

export function isOAuthRedirect(result: OAuthTokens | { redirected: true }): result is { redirected: true } {
  return typeof result === 'object' && result !== null && 'redirected' in result && result.redirected === true
}

function parseOAuthPayload(raw: string): OAuthMessagePayload | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as OAuthMessagePayload
    if (!parsed?.type) return null
    return parsed
  } catch {
    return null
  }
}

/** Read OAuth result from query or hash after native deep link / redirect. */
export function consumeOAuthHashReturn(): OAuthMessagePayload | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const fromQuery = params.get(OAUTH_QUERY_PARAM)
  if (fromQuery) {
    const parsed = parseOAuthPayload(fromQuery)
    params.delete(OAUTH_QUERY_PARAM)
    const next = params.toString()
    const path = `${window.location.pathname}${next ? `?${next}` : ''}`
    window.history.replaceState(null, '', path)
    try {
      sessionStorage.removeItem(OAUTH_EXPECT_KEY)
    } catch {
      // ignore
    }
    return parsed
  }

  const hash = window.location.hash.replace(/^#/, '')
  if (!hash.startsWith(OAUTH_HASH_PREFIX)) return null

  const raw = hash.slice(OAUTH_HASH_PREFIX.length)
  const parsed = parseOAuthPayload(raw)
  const path = `${window.location.pathname}${window.location.search}`
  window.history.replaceState(null, '', path)
  try {
    sessionStorage.removeItem(OAUTH_EXPECT_KEY)
  } catch {
    // ignore
  }
  return parsed
}

/** Parse OAuth payload out of a deep-link URL (appUrlOpen). */
export function parseOAuthDeepLink(url: string): OAuthMessagePayload | null {
  try {
    const parsedUrl = new URL(url)
    const fromQuery = parsedUrl.searchParams.get(OAUTH_QUERY_PARAM)
    if (fromQuery) return parseOAuthPayload(fromQuery)
    const hash = parsedUrl.hash.replace(/^#/, '')
    if (hash.startsWith(OAUTH_HASH_PREFIX)) {
      return parseOAuthPayload(hash.slice(OAUTH_HASH_PREFIX.length))
    }
  } catch {
    // Custom schemes sometimes need manual parsing
    const bare = url.match(/[?&]katana_oauth=([^&]+)/)
    if (bare?.[1]) return parseOAuthPayload(bare[1])
  }
  return null
}

/** Pending payload stashed by the native deep-link handler. */
export function consumeOAuthPendingReturn(): OAuthMessagePayload | null {
  try {
    const raw = sessionStorage.getItem('katana-oauth-pending')
    if (!raw) return null
    sessionStorage.removeItem('katana-oauth-pending')
    const parsed = JSON.parse(raw) as OAuthMessagePayload
    return parsed?.type ? parsed : null
  } catch {
    return null
  }
}
