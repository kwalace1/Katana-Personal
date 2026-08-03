/**
 * Public inbound lead capture — no auth required (uses Supabase RPC)
 */

import { supabase, isSupabaseConfigured } from './supabase'

export interface PublicOrgInfo {
  id: string
  name: string
  slug: string
}

export interface PublicLeadInput {
  orgSlug: string
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  companyName?: string
  accountType?: 'business' | 'individual'
  message?: string
  campaignId?: string | null
}

export async function getPublicOrgBySlug(slug: string): Promise<PublicOrgInfo | null> {
  if (!isSupabaseConfigured || !slug.trim()) return null
  const { data, error } = await supabase.rpc('get_public_org_by_slug', { p_slug: slug.trim() })
  if (error) {
    console.error('get_public_org_by_slug:', error)
    return null
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.id) return null
  return { id: row.id as string, name: row.name as string, slug: row.slug as string }
}

export async function submitPublicLead(input: PublicLeadInput): Promise<{ leadId: string | null; error?: string }> {
  if (!isSupabaseConfigured) {
    return { leadId: null, error: 'Lead capture is not configured. Contact the business directly.' }
  }

  const { data, error } = await supabase.rpc('submit_public_crm_lead', {
    p_org_slug: input.orgSlug.trim(),
    p_first_name: input.firstName.trim(),
    p_last_name: input.lastName?.trim() ?? '',
    p_email: input.email?.trim() ?? null,
    p_phone: input.phone?.trim() ?? null,
    p_company_name: input.companyName?.trim() ?? null,
    p_account_type: input.accountType ?? 'business',
    p_message: input.message?.trim() ?? '',
    p_campaign_id: input.campaignId ?? null,
  })

  if (error) {
    console.error('submit_public_crm_lead:', error)
    const msg = error.message?.includes('not found')
      ? 'This contact page is not available.'
      : 'Could not submit your request. Please try again.'
    return { leadId: null, error: msg }
  }

  return { leadId: (data as string) ?? null }
}

export function publicLeadCaptureUrl(orgSlug: string, campaignId?: string): string {
  const base = `${typeof window !== 'undefined' ? window.location.origin : ''}/contact/${encodeURIComponent(orgSlug)}`
  if (!campaignId) return base
  return `${base}?campaign=${encodeURIComponent(campaignId)}`
}
