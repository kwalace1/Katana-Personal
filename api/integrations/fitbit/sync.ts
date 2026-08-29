import { handleFitbitSyncRequest } from '../health-oauth-core'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  return handleFitbitSyncRequest(req)
}
