/**
 * Client-side wrapper for KYC external enrichment API + persistence
 */

import { supabase } from './supabase'
import { getOrganizationId } from './auth-helpers'
import type { Client } from './customer-success-api'
import {
  enrichCompanyFromPublicSources,
  type EnrichmentPayload,
  type KycExternalSignals,
} from './kyc-enrichment'

export interface EnrichmentRefreshResult {
  external_signals: KycExternalSignals
  enrichment: Record<string, unknown>
  payload: EnrichmentPayload
  persisted: boolean
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function refreshClientExternalEnrichment(client: Client): Promise<EnrichmentRefreshResult> {
  const token = await getAccessToken()

  if (token) {
    try {
      const res = await fetch('/api/kyc-enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          client_id: client.id,
          company_name: client.name,
          state: client.state,
          country: client.country,
          website: client.website,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as EnrichmentRefreshResult
        if (data.persisted) return data
        return persistEnrichment(client.id, data)
      }
    } catch {
      // fall through to direct fetch (local dev / missing API route)
    }
  }

  const result = await enrichCompanyFromPublicSources({
    name: client.name,
    state: client.state,
    country: client.country,
  })

  return persistEnrichment(client.id, {
    external_signals: result.external_signals,
    enrichment: result.enrichment,
    payload: result.payload,
    persisted: false,
  })
}

async function persistEnrichment(
  clientId: string,
  data: EnrichmentRefreshResult,
): Promise<EnrichmentRefreshResult> {
  const orgId = await getOrganizationId()
  const now = new Date().toISOString()

  const mergedSignals = {
    ...(data.external_signals as Record<string, unknown>),
  }

  const { error: clientError } = await supabase
    .from('cs_clients')
    .update({
      external_signals: mergedSignals,
      external_enrichment: data.enrichment,
      last_external_refresh_at: now,
      updated_at: now,
    })
    .eq('id', clientId)

  if (clientError && clientError.code !== '42703') {
    console.error('persistEnrichment client update:', clientError)
    return { ...data, persisted: false }
  }

  await supabase.from('cs_kyc_enrichment_log').insert({
    client_id: clientId,
    organization_id: orgId,
    source: 'manual',
    status: data.payload.errors.length > 0 ? 'partial' : 'success',
    signal_count: Object.values(data.external_signals).filter((v) => v === true).length,
    error_message: data.payload.errors.length > 0 ? data.payload.errors.join('; ') : null,
  })

  return { ...data, persisted: !clientError || clientError.code === '42703' ? true : false }
}

export async function getClientExternalEnrichment(clientId: string): Promise<{
  external_signals: KycExternalSignals
  enrichment: Record<string, unknown>
  last_external_refresh_at: string | null
}> {
  const { data, error } = await supabase
    .from('cs_clients')
    .select('external_signals, external_enrichment, last_external_refresh_at')
    .eq('id', clientId)
    .maybeSingle()

  if (error || !data) {
    return { external_signals: {}, enrichment: {}, last_external_refresh_at: null }
  }

  return {
    external_signals: (data.external_signals as KycExternalSignals) ?? {},
    enrichment: (data.external_enrichment as Record<string, unknown>) ?? {},
    last_external_refresh_at: (data.last_external_refresh_at as string | null) ?? null,
  }
}
