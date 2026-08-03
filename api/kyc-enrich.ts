/**
 * KYC enrichment API — POST /api/kyc-enrich
 * Fetches OpenCorporates + GDELT news for a customer account.
 */

import { createClient } from '@supabase/supabase-js'
import { enrichCompanyFromPublicSources } from '../src/lib/kyc-enrichment'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

async function authenticate(req: Request): Promise<{ userId: string; token: string } | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  if (!token || !SUPABASE_URL) return null

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
  })
  if (!res.ok) return null
  const user = await res.json()
  if (!user?.id) return null
  return { userId: user.id, token }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const auth = await authenticate(req)
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const companyName = String(body.company_name ?? '').trim()
  if (!companyName) {
    return Response.json({ error: 'company_name is required' }, { status: 400 })
  }

  const clientId = body.client_id ? String(body.client_id) : null

  try {
    const result = await enrichCompanyFromPublicSources({
      name: companyName,
      state: body.state ? String(body.state) : null,
      country: body.country ? String(body.country) : null,
    })

    if (clientId && SUPABASE_URL && SERVICE_KEY) {
      const admin = createClient(SUPABASE_URL, SERVICE_KEY)
      const now = new Date().toISOString()
      await admin
        .from('cs_clients')
        .update({
          external_signals: result.external_signals,
          external_enrichment: result.enrichment,
          last_external_refresh_at: now,
          updated_at: now,
        })
        .eq('id', clientId)

      await admin.from('cs_kyc_enrichment_log').insert({
        client_id: clientId,
        source: 'api',
        status: result.payload.errors.length > 0 ? 'partial' : 'success',
        signal_count: Object.values(result.external_signals).filter((v) => v === true).length,
        error_message: result.payload.errors.length > 0 ? result.payload.errors.join('; ') : null,
      })
    }

    return Response.json({
      external_signals: result.external_signals,
      enrichment: result.enrichment,
      payload: result.payload,
      persisted: Boolean(clientId && SERVICE_KEY),
    })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Enrichment failed' },
      { status: 500 },
    )
  }
}
