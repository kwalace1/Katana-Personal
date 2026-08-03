/**
 * Client-side wrapper for KYC executive summary generation + cache
 */

import { supabase } from './supabase'
import { getOrganizationId, getCurrentUserId } from './auth-helpers'
import type { Client } from './customer-success-api'
import type { ClientIntelligenceResult } from './kyc-client-scoring'
import {
  buildKycSummaryContext,
  buildSummaryContextHash,
  buildTemplateClientSummary,
  type KycSummarySource,
} from './kyc-client-summary'

export interface KycExecutiveSummaryResult {
  summary: string
  source: KycSummarySource
  generated_at: string | null
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function getCachedClientSummary(
  clientId: string,
  contextHash: string,
): Promise<KycExecutiveSummaryResult | null> {
  const { data, error } = await supabase
    .from('cs_client_intel')
    .select('ai_summary, summary_generated_at, summary_context_hash')
    .eq('client_id', clientId)
    .maybeSingle()

  if (error) {
    if (error.code === '42P01' || error.code === '42703' || error.message?.includes('does not exist')) {
      return null
    }
    console.error('getCachedClientSummary:', error)
    return null
  }

  if (!data?.ai_summary || data.summary_context_hash !== contextHash) return null

  return {
    summary: String(data.ai_summary),
    source: 'cached',
    generated_at: (data.summary_generated_at as string | null) ?? null,
  }
}

async function persistClientSummary(
  clientId: string,
  summary: string,
  contextHash: string,
  source: KycSummarySource,
): Promise<void> {
  const orgId = await getOrganizationId()
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  const { error } = await supabase.from('cs_client_intel').upsert(
    {
      client_id: clientId,
      organization_id: orgId,
      user_id: userId,
      ai_summary: summary,
      summary_generated_at: now,
      summary_context_hash: contextHash,
      updated_at: now,
    },
    { onConflict: 'client_id' },
  )

  if (error && error.code !== '42703') {
    console.error('persistClientSummary:', error)
  }
}

export async function generateClientExecutiveSummary(
  client: Client,
  intel: ClientIntelligenceResult,
  options?: { preferAi?: boolean; force?: boolean },
): Promise<KycExecutiveSummaryResult> {
  const context = buildKycSummaryContext(client, intel)
  const contextHash = buildSummaryContextHash(context)
  const template = buildTemplateClientSummary(context)

  if (!options?.force) {
    const cached = await getCachedClientSummary(client.id, contextHash)
    if (cached) return cached
  }

  const token = await getAccessToken()
  if (token) {
    try {
      const res = await fetch('/api/kyc-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          client_id: client.id,
          context,
          context_hash: contextHash,
          prefer_ai: options?.preferAi !== false,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as {
          summary: string
          source: 'template' | 'ai'
          generated_at: string
          persisted?: boolean
        }
        if (!data.persisted) {
          await persistClientSummary(client.id, data.summary, contextHash, data.source)
        }
        return {
          summary: data.summary,
          source: data.source,
          generated_at: data.generated_at,
        }
      }
    } catch {
      // fall through to template
    }
  }

  await persistClientSummary(client.id, template, contextHash, 'template')
  return {
    summary: template,
    source: 'template',
    generated_at: new Date().toISOString(),
  }
}
