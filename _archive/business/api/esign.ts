/**
 * Public e-sign API — token packet / file / sign
 * GET  /api/esign?action=packet|file&token=...
 * POST /api/esign  { action: 'sign', token, ... }
 */
import { handleEsignRequest } from '../lib/api/esign-handlers'

export default async function handler(req: Request): Promise<Response> {
  return handleEsignRequest(req)
}
