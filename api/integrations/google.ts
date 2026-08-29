import { handleGoogleOAuthRequest } from './google-oauth-core'

export const config = { runtime: 'edge' }

/** GET /api/integrations/google?action=start|callback */
export default async function handler(req: Request): Promise<Response> {
  return handleGoogleOAuthRequest(req)
}
