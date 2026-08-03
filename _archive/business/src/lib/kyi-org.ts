/**
 * KYI organization ownership helpers.
 * Fail closed: callers must not proceed if the company/investor is not in the current org.
 * Default model: one primary company per org, named after the organization.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getCurrentUserId, getOrganizationId } from '@/lib/auth-helpers'

/** Seed / demo company names that must not leak across tenant orgs. */
export const KYI_CROSS_TENANT_DEMO_NAMES = [
  'katana business solutions',
  'swing',
] as const

function requireSupabase(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured')
  }
}

function normalizeCompanyName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** True when the company name is a known demo seed and not the current org name. */
export function isLeakedDemoCompanyName(companyName: string, orgName: string): boolean {
  const company = normalizeCompanyName(companyName)
  const org = normalizeCompanyName(orgName)
  if (!company || company === org) return false
  return KYI_CROSS_TENANT_DEMO_NAMES.some(
    (demo) => company === demo || company.startsWith(`${demo} `),
  )
}

/**
 * Ensure the company belongs to the signed-in user's organization.
 * @returns organization id
 */
export async function assertCompanyInOrg(companyId: number): Promise<string> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('kyi_companies')
    .select('id')
    .eq('id', companyId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to verify company access')
  }
  if (!data) {
    throw new Error('Company not found in your organization')
  }
  return orgId
}

/**
 * Ensure the investor belongs to the signed-in user's organization.
 * @returns orgId and companyId (nullable if investor has no company)
 */
export async function assertInvestorInOrg(
  investorId: number,
): Promise<{ orgId: string; companyId: number | null }> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('kyi_investors')
    .select('id, company_id')
    .eq('id', investorId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to verify investor access')
  }
  if (!data) {
    throw new Error('Investor not found in your organization')
  }
  const companyId =
    data.company_id == null || data.company_id === undefined
      ? null
      : Number(data.company_id)
  return { orgId, companyId: Number.isFinite(companyId) ? companyId : null }
}

export type EnsuredOrganizationCompany = {
  id: number
  name: string
  organization_id: string
  created: boolean
}

/**
 * Ensure the signed-in org has a KYI company named after the organization.
 * Does not delete extra companies — use the ownership cleanup SQL for that.
 */
export async function ensureOrganizationCompany(): Promise<EnsuredOrganizationCompany> {
  requireSupabase()
  const orgId = await getOrganizationId()

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name, settings')
    .eq('id', orgId)
    .maybeSingle()

  if (orgErr) {
    throw new Error(orgErr.message || 'Failed to load organization')
  }
  if (!org?.name?.trim()) {
    throw new Error('Organization name is required for KYI')
  }

  const orgName = (org.name as string).trim()
  const settings =
    org.settings && typeof org.settings === 'object'
      ? (org.settings as Record<string, unknown>)
      : {}
  const location =
    typeof settings.location === 'string'
      ? settings.location
      : typeof settings.hq_location === 'string'
        ? settings.hq_location
        : null
  const industry =
    typeof settings.industry === 'string'
      ? settings.industry
      : typeof settings.sector === 'string'
        ? settings.sector
        : null

  const { data: existingRows, error: listErr } = await supabase
    .from('kyi_companies')
    .select('id, name, organization_id')
    .eq('organization_id', orgId)
    .order('id', { ascending: true })

  if (listErr) {
    throw new Error(listErr.message || 'Failed to load KYI companies')
  }

  const rows = existingRows ?? []
  const orgNorm = normalizeCompanyName(orgName)
  const match = rows.find((r) => normalizeCompanyName(String(r.name ?? '')) === orgNorm)
  if (match) {
    return {
      id: match.id as number,
      name: match.name as string,
      organization_id: orgId,
      created: false,
    }
  }

  const userId = await getCurrentUserId()
  const { data: inserted, error: insertErr } = await supabase
    .from('kyi_companies')
    .insert({
      name: orgName,
      location,
      industry,
      user_id: userId,
      organization_id: orgId,
      description: `${orgName} — Know Your Investor workspace`,
    })
    .select('id, name, organization_id')
    .single()

  if (insertErr || !inserted) {
    throw new Error(insertErr?.message || 'Failed to create organization KYI company')
  }

  try {
    const { seedCompanyNorthstarDefaults } = await import('@/lib/kyi-northstar')
    await seedCompanyNorthstarDefaults(inserted.id as number)
  } catch {
    // Customization tables may not exist until migration is run
  }

  return {
    id: inserted.id as number,
    name: inserted.name as string,
    organization_id: (inserted.organization_id as string) ?? orgId,
    created: true,
  }
}
