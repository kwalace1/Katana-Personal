import { handleGoogleOAuthRequest } from '../google-oauth-core'

export const config = { runtime: 'edge' }

/** GET /api/integrations/google?action=start|callback */
export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  if (!url.searchParams.get('action')) {
    url.searchParams.set(
      'action',
      url.searchParams.get('code') || url.searchParams.get('error') ? 'callback' : 'start',
    )
  }
  return handleGoogleOAuthRequest(new Request(url.toString(), req))
}
