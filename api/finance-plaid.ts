/**
 * Plaid bank feeds — server-side only
 * GET  /api/finance-plaid?action=status|link_token
 * POST /api/finance-plaid?action=exchange|sync|sync_item
 *
 * Env: PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV (sandbox|development|production)
 *      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
 */

import { handleFinancePlaidRequest } from '../lib/api/finance-plaid-handlers'

export default async function handler(req: Request): Promise<Response> {
  return handleFinancePlaidRequest(req)
}
