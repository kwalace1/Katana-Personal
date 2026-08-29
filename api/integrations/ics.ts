import { handleIcsFetchRequest } from './google-oauth-core'

export const config = { runtime: 'edge' }

/** POST /api/integrations/ics */
export default async function handler(req: Request): Promise<Response> {
  return handleIcsFetchRequest(req)
}
