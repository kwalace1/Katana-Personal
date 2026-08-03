/**
 * Canonical entity schema for Switch mapping
 * GET /switch/schema
 */

import { exportCanonicalSchema } from './canonical-entities'
import { getKatanaApiBaseUrl } from './switch-config'
import { switchJson, withCors, corsHeaders } from './switch-errors'

export async function handleSwitchSchema(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }

  if (req.method !== 'GET') {
    return withCors(Response.json({ error: 'Method not allowed', code: 'INVALID_REQUEST' }, { status: 405 }))
  }

  return withCors(
    switchJson({
      api_base_url: getKatanaApiBaseUrl(req),
      ...exportCanonicalSchema(),
    }),
  )
}
