import { handleSwitchOAuthToken } from '../../../lib/api/switch/oauth-token'

export default async function handler(req: Request): Promise<Response> {
  return handleSwitchOAuthToken(req)
}

export const config = { runtime: 'edge' }
