export const OAUTH_ORIGIN_COOKIE = 'katana_oauth_origin'
export const OAUTH_QUERY_PARAM = 'katana_oauth'

export function oauthPopupHtml(
  messageType: string,
  payload: Record<string, unknown>,
  returnOrigin?: string | null,
): Response {
  const body = `<!DOCTYPE html><html><body><p id="msg">Finishing connection…</p><script>
    (function () {
      var payload = ${JSON.stringify(payload)};
      var messageType = ${JSON.stringify(messageType)};
      var returnOrigin = ${JSON.stringify(returnOrigin || '')};
      var data = encodeURIComponent(JSON.stringify({
        type: messageType,
        tokens: payload.tokens || null,
        error: payload.error || null
      }));
      var msg = document.getElementById('msg');
      function showDone() {
        var err = payload.error ? String(payload.error) : '';
        var text = err
          ? (err + ' You can close this window and return to Katana.')
          : 'Connected. Return to Katana if this window does not close.';
        if (msg) msg.textContent = text;
        else document.body.textContent = text;
      }
      try {
        if (window.opener) {
          window.opener.postMessage({
            type: messageType,
            tokens: payload.tokens || null,
            error: payload.error || null
          }, '*');
          window.close();
          showDone();
          return;
        }
      } catch (e) {}
      if (returnOrigin) {
        var base = String(returnOrigin).replace(/\\/$/, '');
        // Custom URL schemes must use query params — iOS often strips hash fragments.
        if (/^https?:\\/\\//i.test(base)) {
          location.replace(base + '/settings/connections?katana_oauth=' + data);
        } else {
          location.replace(base + '?katana_oauth=' + data);
        }
        return;
      }
      showDone();
    })();
  </script></body></html>`
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export function requestBaseUrl(req: Request): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3001'
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  return `${proto}://${host}`
}

export function encodeOAuthState(payload: Record<string, string>): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function decodeOAuthState(raw: string): Record<string, string> | null {
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Record<string, string>
  } catch {
    return null
  }
}

/** Persist return origin so callbacks still work if the provider drops `state`. */
export function setOAuthOriginCookie(origin: string): string {
  const safe = encodeURIComponent(origin)
  return `${OAUTH_ORIGIN_COOKIE}=${safe}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
}

export function readOAuthOriginFromCookie(req: Request): string | null {
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${OAUTH_ORIGIN_COOKIE}=([^;]+)`))
  if (!match?.[1]) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export function resolveOAuthReturnOrigin(req: Request, stateOrigin?: string | null): string | null {
  if (stateOrigin && stateOrigin.trim()) return stateOrigin.trim()
  return readOAuthOriginFromCookie(req)
}

export function withOAuthOriginCookie(res: Response, origin: string): Response {
  const headers = new Headers(res.headers)
  headers.append('Set-Cookie', setOAuthOriginCookie(origin))
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}
