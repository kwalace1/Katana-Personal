import { handleFitbitOAuthRequest } from '../health-oauth-core'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  if (!url.searchParams.get('action')) {
    url.searchParams.set('action', url.searchParams.get('code') ? 'callback' : 'start')
  }
  return handleFitbitOAuthRequest(new Request(url.toString(), req))
}
