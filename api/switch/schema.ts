import { handleSwitchSchema } from '../../lib/api/switch/schema-handler'

export default async function handler(req: Request): Promise<Response> {
  return handleSwitchSchema(req)
}

export const config = { runtime: 'edge' }
