import type { OAuthTokens } from './types'

export function openIntegrationOAuthPopup(
  path: string,
  messageType: string,
  windowName: string,
): Promise<OAuthTokens> {
  return new Promise((resolve, reject) => {
    const url = `${path}?action=start&origin=${encodeURIComponent(window.location.origin)}`
    const popup = window.open(url, windowName, 'width=520,height=720')
    if (!popup) {
      reject(new Error('Popup blocked — allow popups to connect.'))
      return
    }

    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('Sign-in timed out.'))
    }, 120_000)

    function onMessage(ev: MessageEvent) {
      const data = ev.data as { type?: string; tokens?: OAuthTokens; error?: string }
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
