/**
 * KYI 2.0 ecosystem — shared global investor directory APIs.
 * Private fundraising work stays on kyi_investors; this layer is identity + discovery.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getOrganizationId } from '@/lib/auth-helpers'
import { assertCompanyInOrg } from '@/lib/kyi-org'
import {
  createInvestor,
  KYI_SEGMENT_TARGETED_INVESTOR,
  type KYIInvestor,
} from '@/lib/kyi-api'

function requireSupabase(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured')
  }
}

export type KyiCategoryFacet =
  | 'stage'
  | 'vehicle'
  | 'thesis'
  | 'mandate'
  | 'horizon'
  | 'geo_scope'

export interface KyiInvestorCategoryDef {
  id: number
  slug: string
  label: string
  facet: KyiCategoryFacet
  sort_order: number
}

export interface KYIGlobalInvestor {
  id: number
  entity_type: 'person' | 'firm'
  display_name: string
  firm: string | null
  title: string | null
  location: string | null
  industry: string | null
  website: string | null
  profile_url: string | null
  linkedin_url: string | null
  public_email: string | null
  public_phone: string | null
  investment_focus: string | null
  public_history: string | null
  firm_metadata: Record<string, unknown>
  geo_lat: number | null
  geo_lng: number | null
  dedupe_key: string
  source: string
  created_at: string | null
  updated_at: string | null
  categories?: KyiInvestorCategoryDef[]
  /** Aggregate only — number of Katana orgs that have associated this investor */
  tracked_by_org_count?: number
  /** True when current org already has a private association for this company */
  associated_for_company?: boolean
  associated_investor_id?: number | null
}

export interface SearchGlobalInvestorsParams {
  query?: string
  /** Category slugs to require (AND across facets if mixed; OR within same facet handled loosely) */
  categorySlugs?: string[]
  facet?: KyiCategoryFacet
  limit?: number
  offset?: number
  /** When set, annotate results with whether this company already associated */
  companyId?: number
}

export interface SearchGlobalInvestorsResponse {
  total_estimate: number
  investors: KYIGlobalInvestor[]
  categories: KyiInvestorCategoryDef[]
}

function mapGlobalRow(row: Record<string, unknown>): KYIGlobalInvestor {
  const meta = row.firm_metadata
  return {
    id: Number(row.id),
    entity_type: row.entity_type === 'firm' ? 'firm' : 'person',
    display_name: String(row.display_name ?? ''),
    firm: (row.firm as string) ?? null,
    title: (row.title as string) ?? null,
    location: (row.location as string) ?? null,
    industry: (row.industry as string) ?? null,
    website: (row.website as string) ?? null,
    profile_url: (row.profile_url as string) ?? null,
    linkedin_url: (row.linkedin_url as string) ?? null,
    public_email: (row.public_email as string) ?? null,
    public_phone: (row.public_phone as string) ?? null,
    investment_focus: (row.investment_focus as string) ?? null,
    public_history: (row.public_history as string) ?? null,
    firm_metadata: meta && typeof meta === 'object' && !Array.isArray(meta)
      ? (meta as Record<string, unknown>)
      : {},
    geo_lat: row.geo_lat != null ? Number(row.geo_lat) : null,
    geo_lng: row.geo_lng != null ? Number(row.geo_lng) : null,
    dedupe_key: String(row.dedupe_key ?? ''),
    source: String(row.source ?? 'platform'),
    created_at: (row.created_at as string) ?? null,
    updated_at: (row.updated_at as string) ?? null,
  }
}

/** Client-side dedupe key — mirrors SQL kyi_investor_dedupe_key */
export function investorDedupeKey(name: string, firm?: string | null): string {
  return `${(name ?? '').trim().toLowerCase()}|${(firm ?? '').trim().toLowerCase()}`
}

export async function getInvestorCategoryDefs(): Promise<KyiInvestorCategoryDef[]> {
  requireSupabase()
  const { data, error } = await supabase
    .from('kyi_investor_category_defs')
    .select('id, slug, label, facet, sort_order')
    .order('facet', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) {
    if ((error.message ?? '').includes('does not exist')) return []
    throw new Error(error.message || 'Failed to load investor categories')
  }

  return (data ?? []).map((row) => ({
    id: row.id as number,
    slug: row.slug as string,
    label: row.label as string,
    facet: row.facet as KyiCategoryFacet,
    sort_order: (row.sort_order as number) ?? 0,
  }))
}

async function attachCategories(
  investors: KYIGlobalInvestor[],
): Promise<KYIGlobalInvestor[]> {
  if (investors.length === 0) return investors
  const ids = investors.map((i) => i.id)
  const { data: links, error } = await supabase
    .from('kyi_global_investor_categories')
    .select('global_investor_id, category_id')
    .in('global_investor_id', ids)

  if (error || !links?.length) return investors

  const catIds = [...new Set(links.map((l) => l.category_id as number))]
  const { data: cats } = await supabase
    .from('kyi_investor_category_defs')
    .select('id, slug, label, facet, sort_order')
    .in('id', catIds)

  const catMap = new Map(
    (cats ?? []).map((c) => [
      c.id as number,
      {
        id: c.id as number,
        slug: c.slug as string,
        label: c.label as string,
        facet: c.facet as KyiCategoryFacet,
        sort_order: (c.sort_order as number) ?? 0,
      } satisfies KyiInvestorCategoryDef,
    ]),
  )

  const byGlobal = new Map<number, KyiInvestorCategoryDef[]>()
  for (const link of links) {
    const gid = link.global_investor_id as number
    const cat = catMap.get(link.category_id as number)
    if (!cat) continue
    const list = byGlobal.get(gid) ?? []
    list.push(cat)
    byGlobal.set(gid, list)
  }

  return investors.map((inv) => ({
    ...inv,
    categories: byGlobal.get(inv.id) ?? [],
  }))
}

async function attachOrgCounts(
  investors: KYIGlobalInvestor[],
): Promise<KYIGlobalInvestor[]> {
  if (investors.length === 0) return investors
  const ids = investors.map((i) => i.id)
  const { data, error } = await supabase.rpc('kyi_global_investor_org_counts', {
    p_ids: ids,
  })
  if (error || !data) return investors

  const counts = new Map<number, number>()
  for (const row of data as Array<{ global_investor_id: number; org_count: number }>) {
    counts.set(Number(row.global_investor_id), Number(row.org_count) || 0)
  }
  return investors.map((inv) => ({
    ...inv,
    tracked_by_org_count: counts.get(inv.id) ?? 0,
  }))
}

async function attachAssociationFlags(
  investors: KYIGlobalInvestor[],
  companyId: number,
): Promise<KYIGlobalInvestor[]> {
  if (investors.length === 0) return investors
  const orgId = await getOrganizationId()
  const ids = investors.map((i) => i.id)
  const { data } = await supabase
    .from('kyi_investors')
    .select('id, global_investor_id')
    .eq('organization_id', orgId)
    .eq('company_id', companyId)
    .in('global_investor_id', ids)

  const map = new Map<number, number>()
  for (const row of data ?? []) {
    if (row.global_investor_id != null) {
      map.set(Number(row.global_investor_id), Number(row.id))
    }
  }
  return investors.map((inv) => ({
    ...inv,
    associated_for_company: map.has(inv.id),
    associated_investor_id: map.get(inv.id) ?? null,
  }))
}

export async function searchGlobalInvestors(
  params: SearchGlobalInvestorsParams = {},
): Promise<SearchGlobalInvestorsResponse> {
  requireSupabase()
  const limit = Math.min(Math.max(params.limit ?? 40, 1), 100)
  const offset = Math.max(params.offset ?? 0, 0)
  const categories = await getInvestorCategoryDefs()

  let filteredIds: number[] | null = null
  if (params.categorySlugs?.length) {
    const wanted = categories.filter((c) => params.categorySlugs!.includes(c.slug))
    if (wanted.length === 0) {
      return { total_estimate: 0, investors: [], categories }
    }
    const { data: links, error } = await supabase
      .from('kyi_global_investor_categories')
      .select('global_investor_id, category_id')
      .in(
        'category_id',
        wanted.map((c) => c.id),
      )
    if (error) throw new Error(error.message || 'Failed to filter by category')

    // Require all selected categories (AND)
    const need = new Set(wanted.map((c) => c.id))
    const byInv = new Map<number, Set<number>>()
    for (const link of links ?? []) {
      const gid = link.global_investor_id as number
      const set = byInv.get(gid) ?? new Set()
      set.add(link.category_id as number)
      byInv.set(gid, set)
    }
    filteredIds = [...byInv.entries()]
      .filter(([, set]) => [...need].every((id) => set.has(id)))
      .map(([gid]) => gid)
    if (filteredIds.length === 0) {
      return { total_estimate: 0, investors: [], categories }
    }
  }

  let query = supabase
    .from('kyi_global_investors')
    .select('*', { count: 'exact' })
    .order('display_name', { ascending: true })
    .range(offset, offset + limit - 1)

  if (filteredIds) {
    query = query.in('id', filteredIds)
  }

  const q = params.query?.trim()
  if (q) {
    const safe = q.replace(/[%_,.()"'\\]/g, ' ').replace(/\s+/g, ' ').trim()
    if (safe) {
      const pattern = `"%${safe}%"`
      query = query.or(
        [
          `display_name.ilike.${pattern}`,
          `firm.ilike.${pattern}`,
          `industry.ilike.${pattern}`,
          `location.ilike.${pattern}`,
          `investment_focus.ilike.${pattern}`,
        ].join(','),
      )
    }
  }

  const { data, error, count } = await query
  if (error) {
    if ((error.message ?? '').includes('does not exist')) {
      return { total_estimate: 0, investors: [], categories }
    }
    throw new Error(error.message || 'Failed to search ecosystem investors')
  }

  let investors = (data ?? []).map((row) => mapGlobalRow(row as Record<string, unknown>))
  investors = await attachCategories(investors)
  investors = await attachOrgCounts(investors)
  if (params.companyId != null) {
    investors = await attachAssociationFlags(investors, params.companyId)
  }

  return {
    total_estimate: count ?? investors.length,
    investors,
    categories,
  }
}

export async function getGlobalInvestor(
  globalId: number,
  companyId?: number,
): Promise<KYIGlobalInvestor> {
  requireSupabase()
  const { data, error } = await supabase
    .from('kyi_global_investors')
    .select('*')
    .eq('id', globalId)
    .maybeSingle()

  if (error) throw new Error(error.message || 'Failed to load investor')
  if (!data) throw new Error('Global investor not found')

  let investor = mapGlobalRow(data as Record<string, unknown>)
  ;[investor] = await attachCategories([investor])
  ;[investor] = await attachOrgCounts([investor])
  if (companyId != null) {
    ;[investor] = await attachAssociationFlags([investor], companyId)
  }
  return investor
}

export interface UpsertGlobalInvestorInput {
  display_name: string
  firm?: string | null
  title?: string | null
  location?: string | null
  industry?: string | null
  website?: string | null
  profile_url?: string | null
  linkedin_url?: string | null
  public_email?: string | null
  public_phone?: string | null
  investment_focus?: string | null
  public_history?: string | null
  entity_type?: 'person' | 'firm'
  geo_lat?: number | null
  geo_lng?: number | null
  firm_metadata?: Record<string, unknown>
  source?: 'platform' | 'tenant' | 'enriched' | 'lead_import'
  categorySlugs?: string[]
}

/**
 * Find or create a global investor by dedupe key.
 * Only writes public-safe fields — never private notes/pipeline.
 */
export async function findOrCreateGlobalInvestor(
  input: UpsertGlobalInvestorInput,
): Promise<KYIGlobalInvestor> {
  requireSupabase()
  const name = input.display_name.trim()
  if (!name) throw new Error('Investor name is required')
  const firm = input.firm?.trim() || null
  const dedupe_key = investorDedupeKey(name, firm)

  const { data: existing } = await supabase
    .from('kyi_global_investors')
    .select('*')
    .eq('dedupe_key', dedupe_key)
    .maybeSingle()

  if (existing) {
    let inv = mapGlobalRow(existing as Record<string, unknown>)
    if (input.categorySlugs?.length) {
      await setGlobalInvestorCategories(inv.id, input.categorySlugs, 'tenant')
      ;[inv] = await attachCategories([inv])
    }
    return inv
  }

  let orgId: string | null = null
  try {
    orgId = await getOrganizationId()
  } catch {
    orgId = null
  }

  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {
    entity_type: input.entity_type ?? 'person',
    display_name: name,
    firm,
    title: input.title?.trim() || null,
    location: input.location?.trim() || null,
    industry: input.industry?.trim() || null,
    website: input.website?.trim() || null,
    profile_url: input.profile_url?.trim() || null,
    linkedin_url: input.linkedin_url?.trim() || null,
    public_email: input.public_email?.trim() || null,
    public_phone: input.public_phone?.trim() || null,
    investment_focus: input.investment_focus?.trim() || null,
    public_history: input.public_history?.trim() || null,
    firm_metadata: input.firm_metadata ?? {},
    geo_lat: input.geo_lat ?? null,
    geo_lng: input.geo_lng ?? null,
    dedupe_key,
    source: input.source ?? 'tenant',
    created_by_org_id: orgId,
    created_at: now,
    updated_at: now,
  }

  const { data: row, error } = await supabase
    .from('kyi_global_investors')
    .insert(payload)
    .select('*')
    .single()

  if (error || !row) {
    // Race: another org created the same key
    if ((error?.message ?? '').includes('duplicate') || error?.code === '23505') {
      const { data: again } = await supabase
        .from('kyi_global_investors')
        .select('*')
        .eq('dedupe_key', dedupe_key)
        .maybeSingle()
      if (again) return mapGlobalRow(again as Record<string, unknown>)
    }
    throw new Error(error?.message || 'Failed to create global investor')
  }

  let inv = mapGlobalRow(row as Record<string, unknown>)
  if (input.categorySlugs?.length) {
    await setGlobalInvestorCategories(inv.id, input.categorySlugs, 'tenant')
    ;[inv] = await attachCategories([inv])
  }
  return inv
}

/**
 * Enrich a shared profile with public-safe fields only.
 * Does not touch private notes / pipeline. Empty strings clear the field;
 * undefined leaves it unchanged.
 */
export async function updateGlobalInvestorPublicFields(
  globalId: number,
  patch: {
    title?: string | null
    firm?: string | null
    location?: string | null
    industry?: string | null
    website?: string | null
    profile_url?: string | null
    linkedin_url?: string | null
    public_email?: string | null
    investment_focus?: string | null
    public_history?: string | null
    categorySlugs?: string[]
  },
): Promise<KYIGlobalInvestor> {
  requireSupabase()
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const keys = [
    'title',
    'firm',
    'location',
    'industry',
    'website',
    'profile_url',
    'linkedin_url',
    'public_email',
    'investment_focus',
    'public_history',
  ] as const
  for (const k of keys) {
    if (k in patch) {
      const v = patch[k]
      payload[k] = typeof v === 'string' ? v.trim() || null : v ?? null
    }
  }

  // If firm changes, refresh dedupe_key using current display_name
  if ('firm' in patch) {
    const { data: cur } = await supabase
      .from('kyi_global_investors')
      .select('display_name')
      .eq('id', globalId)
      .maybeSingle()
    if (cur) {
      payload.dedupe_key = investorDedupeKey(
        String(cur.display_name ?? ''),
        typeof patch.firm === 'string' ? patch.firm : null,
      )
    }
  }

  const { data, error } = await supabase
    .from('kyi_global_investors')
    .update(payload)
    .eq('id', globalId)
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message || 'Failed to update shared profile')

  if (patch.categorySlugs) {
    await setGlobalInvestorCategories(globalId, patch.categorySlugs, 'tenant')
  }

  let inv = mapGlobalRow(data as Record<string, unknown>)
  ;[inv] = await attachCategories([inv])
  ;[inv] = await attachOrgCounts([inv])
  return inv
}

export interface KyiEcosystemStats {
  investor_count: number
  category_count: number
  contributing_org_estimate: number
}

export async function getEcosystemStats(): Promise<KyiEcosystemStats> {
  requireSupabase()
  const [{ count: investor_count }, { count: category_count }, { data: orgs }] = await Promise.all([
    supabase.from('kyi_global_investors').select('id', { count: 'exact', head: true }),
    supabase.from('kyi_investor_category_defs').select('id', { count: 'exact', head: true }),
    supabase
      .from('kyi_global_investors')
      .select('created_by_org_id')
      .not('created_by_org_id', 'is', null)
      .limit(5000),
  ])
  const orgSet = new Set(
    (orgs ?? [])
      .map((r) => r.created_by_org_id as string | null)
      .filter((id): id is string => !!id),
  )
  return {
    investor_count: investor_count ?? 0,
    category_count: category_count ?? 0,
    contributing_org_estimate: orgSet.size,
  }
}

/**
 * Client-side enrichment pass: fill sparse public focus/history from linked quality leads
 * and tenant investors. Safe to re-run; never overwrites non-empty fields.
 */
export async function enrichSparseGlobalProfiles(limit = 200): Promise<{ updated: number }> {
  requireSupabase()
  const { data: sparse, error } = await supabase
    .from('kyi_global_investors')
    .select('id, display_name, firm, industry, investment_focus, public_history, profile_url')
    .or('investment_focus.is.null,public_history.is.null,industry.is.null')
    .limit(limit)
  if (error) throw new Error(error.message || 'Failed to load sparse profiles')

  let updated = 0
  for (const row of sparse ?? []) {
    const id = Number(row.id)
    const { data: lead } = await supabase
      .from('kyi_investor_leads')
      .select('metadata, sources, display_name')
      .eq('global_investor_id', id)
      .limit(1)
      .maybeSingle()

    const { data: inv } = await supabase
      .from('kyi_investors')
      .select('firm, title, location, industry, profile_url')
      .eq('global_investor_id', id)
      .limit(1)
      .maybeSingle()

    const meta =
      lead?.metadata && typeof lead.metadata === 'object'
        ? (lead.metadata as Record<string, unknown>)
        : {}
    const sources = Array.isArray(lead?.sources) ? (lead!.sources as Array<{ source_name?: string; name?: string }>) : []
    const qualitySources = sources
      .map((s) => s.source_name || s.name || '')
      .filter((n) => /SEC|ADV|13F|WIKIDATA|FINRA|OPENCORPORATES|COMPANIES.?HOUSE/i.test(n))

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    let changed = false

    if (!row.industry) {
      const ind =
        (typeof meta.industry === 'string' && meta.industry) ||
        (typeof meta.sector === 'string' && meta.sector) ||
        (inv?.industry as string) ||
        null
      if (ind) {
        patch.industry = ind
        changed = true
      }
    }
    if (!row.investment_focus) {
      const focus =
        (typeof meta.investment_focus === 'string' && meta.investment_focus) ||
        (typeof meta.focus === 'string' && meta.focus) ||
        (typeof meta.thesis === 'string' && meta.thesis) ||
        (patch.industry ? `Industry focus: ${patch.industry}` : null) ||
        (row.industry ? `Industry focus: ${row.industry}` : null) ||
        (inv?.industry ? `Industry focus: ${inv.industry}` : null)
      if (focus) {
        patch.investment_focus = focus
        changed = true
      }
    }
    if (!row.public_history && qualitySources.length) {
      patch.public_history = `Public records: ${[...new Set(qualitySources)].join(', ')}`
      changed = true
    }
    if (!row.firm && (inv?.firm || meta.firm || meta.company)) {
      patch.firm = (inv?.firm as string) || String(meta.firm || meta.company)
      changed = true
    }
    if (!row.profile_url && inv?.profile_url) {
      patch.profile_url = inv.profile_url
      changed = true
    }

    if (!changed) continue
    const { error: upErr } = await supabase.from('kyi_global_investors').update(patch).eq('id', id)
    if (!upErr) updated++
  }
  return { updated }
}

export async function setGlobalInvestorCategories(
  globalId: number,
  slugs: string[],
  source: 'platform' | 'tenant' | 'auto' = 'tenant',
): Promise<void> {
  requireSupabase()
  const defs = await getInvestorCategoryDefs()
  const ids = defs.filter((d) => slugs.includes(d.slug)).map((d) => d.id)
  if (ids.length === 0) return

  const rows = ids.map((category_id) => ({
    global_investor_id: globalId,
    category_id,
    source,
  }))
  const { error } = await supabase
    .from('kyi_global_investor_categories')
    .upsert(rows, { onConflict: 'global_investor_id,category_id' })
  if (error) throw new Error(error.message || 'Failed to set categories')
}

/**
 * Associate a global investor with this company's private raise workspace
 * without duplicating the shared identity.
 */
export async function associateGlobalInvestor(params: {
  globalInvestorId: number
  companyId: number
  segmentType?: string
  notes?: string
}): Promise<KYIInvestor> {
  requireSupabase()
  await assertCompanyInOrg(params.companyId)
  const orgId = await getOrganizationId()
  const global = await getGlobalInvestor(params.globalInvestorId)

  const { data: existing } = await supabase
    .from('kyi_investors')
    .select('*')
    .eq('organization_id', orgId)
    .eq('company_id', params.companyId)
    .eq('global_investor_id', params.globalInvestorId)
    .maybeSingle()

  if (existing) {
    return {
      id: existing.id as number,
      full_name: existing.full_name as string,
      email: (existing.email as string) ?? null,
      phone: (existing.phone as string) ?? null,
      firm: (existing.firm as string) ?? null,
      title: (existing.title as string) ?? null,
      location: (existing.location as string) ?? null,
      industry: (existing.industry as string) ?? null,
      profile_url: (existing.profile_url as string) ?? null,
      notes: (existing.notes as string) ?? null,
      created_at: (existing.created_at as string) ?? null,
      updated_at: (existing.updated_at as string) ?? null,
      segment_type: (existing.segment_type as string) ?? null,
      source_lead_id: (existing.source_lead_id as number) ?? null,
      outreach_status: (existing.outreach_status as KYIInvestor['outreach_status']) ?? 'new',
      global_investor_id: params.globalInvestorId,
    }
  }

  return createInvestor({
    company_id: params.companyId,
    full_name: global.display_name,
    firm: global.firm ?? undefined,
    title: global.title ?? undefined,
    location: global.location ?? undefined,
    industry: global.industry ?? undefined,
    profile_url: global.profile_url ?? global.linkedin_url ?? undefined,
    email: global.public_email ?? undefined,
    phone: global.public_phone ?? undefined,
    notes: params.notes,
    user_role_classification: 'investor',
    added_via_orbit: true,
    segment_type: params.segmentType ?? KYI_SEGMENT_TARGETED_INVESTOR,
    global_investor_id: params.globalInvestorId,
  })
}

/**
 * Promote a private investor's public fields into the shared directory (and link).
 */
export async function promoteInvestorToGlobal(investorId: number): Promise<KYIGlobalInvestor> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const { data: row, error } = await supabase
    .from('kyi_investors')
    .select('*')
    .eq('id', investorId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (error) throw new Error(error.message || 'Failed to load investor')
  if (!row) throw new Error('Investor not found in your organization')

  if (row.global_investor_id) {
    return getGlobalInvestor(Number(row.global_investor_id))
  }

  const global = await findOrCreateGlobalInvestor({
    display_name: String(row.full_name),
    firm: (row.firm as string) ?? null,
    title: (row.title as string) ?? null,
    location: (row.location as string) ?? null,
    industry: (row.industry as string) ?? null,
    profile_url: (row.profile_url as string) ?? null,
    public_email: null, // never promote private email unless explicitly public
    source: 'tenant',
  })

  await supabase
    .from('kyi_investors')
    .update({ global_investor_id: global.id, updated_at: new Date().toISOString() })
    .eq('id', investorId)
    .eq('organization_id', orgId)

  return global
}

/** Sources allowed into the shared ecosystem directory */
export const KYI_ECOSYSTEM_QUALITY_SOURCES = new Set([
  'SEC_13F',
  'SEC_ADV',
  'SEC_FORM_D',
  'SEC_13D',
  'SEC_13G',
  'SEC_FORM3',
  'SEC_FORM4',
  'SEC_FORM5',
  'WIKIDATA',
  'FINRA',
  'OPENCORPORATES',
  'COMPANIES_HOUSE',
  'SEDAR',
])

const KYI_ECOSYSTEM_QUALITY_SIGNALS = [
  'sec_13f',
  'sec_adv',
  'sec_form_d',
  'sec_13d',
  'sec_13g',
  'sec_form3',
  'sec_form4',
  'sec_form5',
  'finra_brokercheck',
  'opencorporates',
  'companies_house',
  'sedar',
] as const

/** True when a lead is high-quality enough for the shared investor directory. */
export function isEcosystemQualityLead(lead: {
  display_name?: string | null
  sources?: Array<{ source_name?: string } | string> | null
  signals?: Record<string, unknown> | null
}): boolean {
  const name = (lead.display_name ?? '').trim()
  // Handle-like names (reddit/github) — reject even if mis-tagged
  if (name && /^[a-z0-9_.-]+$/i.test(name) && !name.includes(' ')) return false

  for (const s of lead.sources ?? []) {
    const sourceName =
      typeof s === 'string' ? s.trim().toUpperCase() : String(s?.source_name ?? '').trim().toUpperCase()
    if (sourceName && KYI_ECOSYSTEM_QUALITY_SOURCES.has(sourceName)) return true
  }

  const signals = lead.signals ?? {}
  for (const key of KYI_ECOSYSTEM_QUALITY_SIGNALS) {
    if (signals[key] === true) return true
  }
  return false
}

/**
 * Promote a lead (catalog or org) into the global directory and optionally associate.
 * Noisy sources (FEC / Reddit / GitHub / etc.) can still be added to a private raise,
 * but they are not written into the shared ecosystem directory.
 */
export async function promoteLeadToGlobal(params: {
  leadId: number
  companyId?: number
  associate?: boolean
}): Promise<{ global: KYIGlobalInvestor | null; investor?: KYIInvestor }> {
  requireSupabase()
  const { data: lead, error } = await supabase
    .from('kyi_investor_leads')
    .select('*')
    .eq('id', params.leadId)
    .maybeSingle()

  if (error) throw new Error(error.message || 'Failed to load lead')
  if (!lead) throw new Error('Lead not found')

  const meta = (lead.metadata && typeof lead.metadata === 'object'
    ? lead.metadata
    : {}) as Record<string, unknown>
  const firm =
    (typeof meta.firm === 'string' && meta.firm) ||
    (typeof meta.company === 'string' && meta.company) ||
    null
  const quality = isEcosystemQualityLead({
    display_name: String(lead.display_name ?? ''),
    sources: Array.isArray(lead.sources) ? (lead.sources as Array<{ source_name?: string }>) : [],
    signals:
      lead.signals && typeof lead.signals === 'object'
        ? (lead.signals as Record<string, unknown>)
        : {},
  })

  let global: KYIGlobalInvestor | null = null
  if (lead.global_investor_id) {
    global = await getGlobalInvestor(Number(lead.global_investor_id))
  } else if (quality) {
    global = await findOrCreateGlobalInvestor({
      display_name: String(lead.display_name),
      firm,
      title: typeof meta.title === 'string' ? meta.title : null,
      location: [lead.city, lead.state].filter(Boolean).join(', ') || null,
      industry: typeof meta.industry === 'string' ? meta.industry : null,
      profile_url:
        (typeof meta.profile_url === 'string' && meta.profile_url) ||
        (typeof meta.url === 'string' && meta.url) ||
        null,
      entity_type: lead.entity_type === 'firm' ? 'firm' : 'person',
      geo_lat: lead.lat != null ? Number(lead.lat) : null,
      geo_lng: lead.lng != null ? Number(lead.lng) : null,
      firm_metadata: {
        ...meta,
        sources: lead.sources ?? [],
        signals: lead.signals ?? {},
      },
      source: 'lead_import',
    })
    await supabase
      .from('kyi_investor_leads')
      .update({ global_investor_id: global.id, updated_at: new Date().toISOString() })
      .eq('id', params.leadId)
  }

  if (params.associate && params.companyId != null) {
    if (global) {
      const investor = await associateGlobalInvestor({
        globalInvestorId: global.id,
        companyId: params.companyId,
      })
      if (!investor.source_lead_id) {
        const orgId = await getOrganizationId()
        await supabase
          .from('kyi_investors')
          .update({ source_lead_id: params.leadId })
          .eq('id', investor.id)
          .eq('organization_id', orgId)
      }
      return { global, investor: { ...investor, source_lead_id: params.leadId } }
    }

    // Private-only path for noisy leads — do not pollute shared directory
    const investor = await createInvestor({
      company_id: params.companyId,
      full_name: String(lead.display_name),
      firm: firm ?? undefined,
      title: typeof meta.title === 'string' ? meta.title : undefined,
      location: [lead.city, lead.state].filter(Boolean).join(', ') || undefined,
      industry: typeof meta.industry === 'string' ? meta.industry : undefined,
      profile_url:
        (typeof meta.profile_url === 'string' && meta.profile_url) ||
        (typeof meta.url === 'string' && meta.url) ||
        undefined,
      user_role_classification: 'investor',
      added_via_orbit: true,
      segment_type: KYI_SEGMENT_TARGETED_INVESTOR,
      source_lead_id: params.leadId,
    })
    return { global: null, investor }
  }

  if (!global && !params.associate) {
    throw new Error(
      'This lead is from a low-quality public source (e.g. Reddit / FEC / GitHub) and is not added to the shared ecosystem. Add it to your raise instead.',
    )
  }

  return { global }
}

/** Suggest global investors for a company based on raise profile + categories. */
export async function suggestGlobalInvestorsForCompany(
  companyId: number,
  limit = 24,
): Promise<Array<KYIGlobalInvestor & { match_score: number; match_reasons: string[] }>> {
  requireSupabase()
  await assertCompanyInOrg(companyId)

  const { data: company } = await supabase
    .from('kyi_companies')
    .select('raise_stage, preferred_investor_types, sector_tags, industry, location')
    .eq('id', companyId)
    .maybeSingle()

  const sectorTags = Array.isArray(company?.sector_tags)
    ? (company!.sector_tags as string[])
    : []
  const preferred = Array.isArray(company?.preferred_investor_types)
    ? (company!.preferred_investor_types as string[])
    : []
  const raiseStage = (company?.raise_stage as string | null)?.toLowerCase() ?? ''
  const industry = (company?.industry as string | null)?.toLowerCase() ?? ''
  const companyLoc = (company?.location as string | null)?.toLowerCase() ?? ''

  const slugHints = new Set<string>()
  const text = [...sectorTags, ...preferred, industry, raiseStage].join(' ').toLowerCase()
  if (/\bai\b|artificial/.test(text)) slugHints.add('ai')
  if (/health|bio|pharma/.test(text)) slugHints.add('healthcare')
  if (/fintech|finance|payment/.test(text)) slugHints.add('fintech')
  if (/real.?estate|proptech/.test(text)) slugHints.add('real-estate')
  if (/manufactur/.test(text)) slugHints.add('manufacturing')
  if (/consumer|retail|cpg/.test(text)) slugHints.add('consumer-products')
  if (/esg|climate|sustain/.test(text)) slugHints.add('esg-environmental')
  if (/impact/.test(text)) slugHints.add('impact')
  if (/tech|software|saas/.test(text)) slugHints.add('technology')
  if (/seed|pre-?seed/.test(text)) slugHints.add('seed')
  if (/series\s*a/.test(text)) slugHints.add('series-a')
  if (/series\s*[b-z]|growth/.test(text)) slugHints.add('series-b-plus')
  if (/venture|\bvc\b/.test(text)) slugHints.add('venture-capital')
  if (/private equity|\bpe\b/.test(text)) slugHints.add('private-equity')
  if (/family office/.test(text)) slugHints.add('family-offices')
  if (/angel/.test(text)) slugHints.add('angel-investors')
  if (/long.?term/.test(text)) slugHints.add('long-term')
  if (/short.?term/.test(text)) slugHints.add('short-term')
  if (/international|global/.test(text)) slugHints.add('international')

  const result = await searchGlobalInvestors({
    categorySlugs: slugHints.size ? [...slugHints].slice(0, 4) : undefined,
    query: industry || sectorTags[0] || undefined,
    limit: Math.max(limit * 2, 40),
    companyId,
  })

  const scored = result.investors.map((inv) => {
    let match_score = 0
    const match_reasons: string[] = []
    const catSlugs = new Set((inv.categories ?? []).map((c) => c.slug))
    for (const slug of slugHints) {
      if (catSlugs.has(slug)) {
        match_score += 12
        const label = inv.categories?.find((c) => c.slug === slug)?.label
        if (label) match_reasons.push(`Matches ${label}`)
      }
    }
    const focus = `${inv.industry ?? ''} ${inv.investment_focus ?? ''}`.toLowerCase()
    if (industry && focus.includes(industry)) {
      match_score += 10
      match_reasons.push(`Industry overlap: ${company?.industry}`)
    }
    for (const tag of sectorTags.slice(0, 4)) {
      if (tag && focus.includes(tag.toLowerCase())) {
        match_score += 6
        match_reasons.push(`Sector: ${tag}`)
      }
    }
    if (companyLoc && (inv.location ?? '').toLowerCase().includes(companyLoc.split(',')[0]?.trim() ?? '')) {
      match_score += 5
      match_reasons.push('Geography overlap')
    }
    if ((inv.tracked_by_org_count ?? 0) > 0) {
      match_score += Math.min(15, (inv.tracked_by_org_count ?? 0) * 3)
      match_reasons.push(
        `Tracked by ${inv.tracked_by_org_count} Katana ${(inv.tracked_by_org_count ?? 0) === 1 ? 'company' : 'companies'}`,
      )
    }
    if (!inv.associated_for_company) match_score += 2
    else match_score -= 20
    if (match_reasons.length === 0) match_reasons.push('In shared ecosystem directory')
    return { ...inv, match_score, match_reasons: match_reasons.slice(0, 4) }
  })

  return scored
    .filter((s) => !s.associated_for_company)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, limit)
}
