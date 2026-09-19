export function oauthPopupHtml(
  messageType: string,
  payload: Record<string, unknown>,
  returnOrigin?: string | null,
): Response {
  const body = `<!DOCTYPE html><html><body><script>
    (function () {
      var payload = ${JSON.stringify(payload)};
      var messageType = ${JSON.stringify(messageType)};
      var returnOrigin = ${JSON.stringify(returnOrigin || '')};
      try {
        if (window.opener) {
          window.opener.postMessage({
            type: messageType,
            tokens: payload.tokens || null,
            error: payload.error || null
          }, '*');
          window.close();
          document.body.textContent = payload.error ? 'Connection failed. You can close this window.' : 'Connected. You can close this window.';
          return;
        }
      } catch (e) {}
      if (returnOrigin) {
        var data = encodeURIComponent(JSON.stringify({
          type: messageType,
          tokens: payload.tokens || null,
          error: payload.error || null
        }));
        var base = String(returnOrigin).replace(/\\/$/, '');
        location.replace(base + '/settings/connections#katana_oauth=' + data);
        return;
      }
      document.body.textContent = payload.error ? 'Connection failed. You can close this window.' : 'Connected. You can close this window.';
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
