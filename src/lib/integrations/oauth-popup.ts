import type { OAuthTokens } from './types'
import { apiUrl } from '@/lib/api-origin'
import { isNativeShell } from '@/lib/native/platform'

export const OAUTH_HASH_PREFIX = 'katana_oauth='
export const OAUTH_EXPECT_KEY = 'katana-oauth-expect'

export type OAuthMessagePayload = {
  type: string
  tokens?: OAuthTokens | null
  error?: string | null
}

/** Popup on web; same-window redirect on native (WKWebView blocks window.open). */
export function openIntegrationOAuthPopup(
  path: string,
  messageType: string,
  windowName: string,
): Promise<OAuthTokens | { redirected: true }> {
  const startPath = `${path}?action=start&origin=${encodeURIComponent(window.location.origin)}`

  if (isNativeShell()) {
    try {
      sessionStorage.setItem(OAUTH_EXPECT_KEY, messageType)
    } catch {
      // ignore
    }
    window.location.assign(apiUrl(startPath))
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

export function isOAuthRedirect(result: OAuthTokens | { redirected: true }): result is { redirected: true } {
  return typeof result === 'object' && result !== null && 'redirected' in result && result.redirected === true
}

/** Read OAuth result from URL hash after native same-window redirect. */
export function consumeOAuthHashReturn(): OAuthMessagePayload | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash.startsWith(OAUTH_HASH_PREFIX)) return null

  const raw = hash.slice(OAUTH_HASH_PREFIX.length)
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as OAuthMessagePayload
    const path = `${window.location.pathname}${window.location.search}`
    window.history.replaceState(null, '', path)
    try {
      sessionStorage.removeItem(OAUTH_EXPECT_KEY)
    } catch {
      // ignore
    }
    if (!parsed?.type) return null
    return parsed
  } catch {
    return null
  }
}
