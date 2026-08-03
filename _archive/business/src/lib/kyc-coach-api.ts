/**
 * Client-side wrapper for KYC account coach
 */

import { supabase } from './supabase'
import { getOrganizationId, getCurrentUserId } from './auth-helpers'
import type { Client } from './customer-success-api'
import type { ClientIntelligenceResult } from './kyc-client-scoring'
import {
  buildKycSummaryContext,
  buildSummaryContextHash,
  type KycSummaryContext,
} from './kyc-client-summary'
import {
  buildTemplateCoachResponse,
  formatCoachResponse,
  type KycCoachResponse,
} from './kyc-account-coach'

export interface KycCoachResult {
  response: KycCoachResponse
  formatted: string
  source: 'cached' | 'template' | 'ai'
  generated_at: string | null
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function getCachedCoachResponse(
  clientId: string,
  contextHash: string,
): Promise<KycCoachResult | null> {
  const { data, error } = await supabase
    .from('cs_client_intel')
    .select('coach_response, coach_generated_at, coach_context_hash')
    .eq('client_id', clientId)
    .maybeSingle()

  if (error) {
    if (error.code === '42P01' || error.code === '42703') return null
    console.error('getCachedCoachResponse:', error)
    return null
  }

  if (!data?.coach_response || data.coach_context_hash !== contextHash) return null

  const template = buildTemplateCoachResponse({} as KycSummaryContext)
  try {
    const parsed = JSON.parse(String(data.coach_response)) as KycCoachResponse
    return {
      response: parsed,
      formatted: formatCoachResponse(parsed),
      source: 'cached',
      generated_at: (data.coach_generated_at as string | null) ?? null,
    }
  } catch {
    return {
      response: { ...template, recommended_action: String(data.coach_response) },
      formatted: String(data.coach_response),
      source: 'cached',
      generated_at: (data.coach_generated_at as string | null) ?? null,
    }
  }
}

async function persistCoachResponse(
  clientId: string,
  response: KycCoachResponse,
  contextHash: string,
): Promise<void> {
  const orgId = await getOrganizationId()
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  const { error } = await supabase.from('cs_client_intel').upsert(
    {
      client_id: clientId,
      organization_id: orgId,
      user_id: userId,
      coach_response: JSON.stringify(response),
      coach_generated_at: now,
      coach_context_hash: contextHash,
      updated_at: now,
    },
    { onConflict: 'client_id' },
  )

  if (error && error.code !== '42703') {
    console.error('persistCoachResponse:', error)
  }
}

export async function generateAccountCoachGuidance(
  client: Client,
  intel: ClientIntelligenceResult,
  options?: { force?: boolean },
): Promise<KycCoachResult> {
  const context = buildKycSummaryContext(client, intel)
  const contextHash = buildSummaryContextHash(context)
  const template = buildTemplateCoachResponse(context)

  if (!options?.force) {
    const cached = await getCachedCoachResponse(client.id, contextHash)
    if (cached) return cached
  }

  const token = await getAccessToken()
  if (token) {
    try {
      const res = await fetch('/api/kyc-coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          client_id: client.id,
          context,
          context_hash: contextHash,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as {
          response: KycCoachResponse
          source: 'template' | 'ai'
          generated_at: string
          persisted?: boolean
        }
        if (!data.persisted) {
          await persistCoachResponse(client.id, data.response, contextHash)
        }
        return {
          response: data.response,
          formatted: formatCoachResponse(data.response),
          source: data.source,
          generated_at: data.generated_at,
        }
      }
    } catch {
      // fall through
    }
  }

  await persistCoachResponse(client.id, template, contextHash)
  return {
    response: template,
    formatted: formatCoachResponse(template),
    source: 'template',
    generated_at: new Date().toISOString(),
  }
}
