import { handleGoogleSyncRequest } from './google-oauth-core'

export const config = { runtime: 'edge' }

/** POST /api/integrations/google/sync */
export default async function handler(req: Request): Promise<Response> {
  return handleGoogleSyncRequest(req)
}
