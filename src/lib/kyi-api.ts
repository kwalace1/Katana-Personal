/**
 * Know Your Investor (KYI) API client.
 *
 * Primary implementation: Supabase tables (org-scoped). Pilot paths fail closed when
 * Supabase is not configured — no silent legacy Flask fallback.
 *
 * Leads: organization_id = current org (writable) OR organization_id IS NULL
 * (read-only platform catalog). client_id may still be PLATFORM_CLIENT_ID for
 * legacy NOT NULL constraints; prefer organization_id for tenancy.
 * Company geo filters which leads appear as local targets.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getCurrentUserId, getOrganizationId } from './auth-helpers'
import {
  assertCompanyInOrg,
  assertInvestorInOrg,
  ensureOrganizationCompany,
  isLeakedDemoCompanyName,
} from '@/lib/kyi-org'
import { getEmployeeByEmail } from '@/lib/hr-api'

export {
  assertCompanyInOrg,
  assertInvestorInOrg,
  ensureOrganizationCompany,
  isLeakedDemoCompanyName,
} from '@/lib/kyi-org'
import {
  computeLeadScore,
  getLeadScoreBreakdown,
  leadMatchesFilterPresets,
  leadMatchesSector,
  leadScoreToFitPercent,
  type KyiLeadFilterPresetId,
  type LeadScoreBreakdownItem,
  type LeadScoreOpts,
  type RaiseContext,
} from '@/lib/kyi-lead-scoring'

// Legacy KYI Flask app base URL.
// - When VITE_KYI_APP_URL is set (e.g. http://localhost:5000), we call its `/api/...` endpoints directly.
// - Otherwise we fall back to `/api/kyi`, which can be proxied by the host environment if needed.
const KYI_APP_URL =
  typeof import.meta !== 'undefined' &&
  (import.meta as { env?: { VITE_KYI_APP_URL?: string } }).env?.VITE_KYI_APP_URL

const LEGACY_BASE = KYI_APP_URL ? `${KYI_APP_URL.replace(/\/$/, '')}/api` : '/api/kyi'

/**
 * Legacy client_id used when kyi_investor_leads.client_id is NOT NULL.
 * Org tenancy is via organization_id; do not treat this as a shared data pool.
 */
export const PLATFORM_CLIENT_ID = 1

function requireSupabase(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured')
  }
}

/** Signal key → human-readable label for UI badges and filters. */
export const KYI_SIGNAL_LABELS: Record<string, { label: string; category: string; color: string }> = {
  // Investor ownership
  sec_13f: { label: '13F', category: 'Ownership', color: 'blue' },
  sec_form_d: { label: 'Form D', category: 'Ownership', color: 'blue' },
  sec_13d: { label: '13D', category: 'Ownership', color: 'blue' },
  sec_13g: { label: '13G', category: 'Ownership', color: 'blue' },
  sec_form4: { label: 'Form 4', category: 'Insider', color: 'purple' },
  sec_form3: { label: 'Form 3', category: 'Insider', color: 'purple' },
  sec_form5: { label: 'Form 5', category: 'Insider', color: 'purple' },
  // Company disclosures
  sec_10k: { label: '10-K', category: 'Disclosure', color: 'green' },
  sec_10q: { label: '10-Q', category: 'Disclosure', color: 'green' },
  sec_8k: { label: '8-K', category: 'Disclosure', color: 'green' },
  sec_def14a: { label: 'DEF 14A', category: 'Disclosure', color: 'green' },
  sec_20f: { label: '20-F', category: 'Disclosure', color: 'green' },
  sec_6k: { label: '6-K', category: 'Disclosure', color: 'green' },
  // Capital & M&A
  sec_s1: { label: 'S-1', category: 'Capital', color: 'orange' },
  sec_s3: { label: 'S-3', category: 'Capital', color: 'orange' },
  sec_s4: { label: 'S-4', category: 'M&A', color: 'orange' },
  sec_f1: { label: 'F-1', category: 'Capital', color: 'orange' },
  sec_schedule_to: { label: 'Schedule TO', category: 'M&A', color: 'orange' },
  // Enforcement & structure
  sec_enforcement: { label: 'Enforcement', category: 'Legal', color: 'red' },
  sec_subsidiary: { label: 'Subsidiary', category: 'Structure', color: 'gray' },
  sec_adv: { label: 'Form ADV', category: 'Adviser', color: 'indigo' },
  // External
  fec_donor: { label: 'FEC Donor', category: 'Political', color: 'rose' },
  finra_brokercheck: { label: 'FINRA', category: 'Regulatory', color: 'indigo' },
  uspto_patent: { label: 'Patent', category: 'IP', color: 'teal' },
  opencorporates: { label: 'Corp Registry', category: 'Entity', color: 'gray' },
  companies_house: { label: 'UK Filing', category: 'International', color: 'sky' },
  lobbying_disclosure: { label: 'Lobbying', category: 'Political', color: 'rose' },
  press_release: { label: 'Press', category: 'Media', color: 'amber' },
  news_sentiment: { label: 'News', category: 'Media', color: 'amber' },
  sedar: { label: 'SEDAR+', category: 'International', color: 'sky' },
  business_registry: { label: 'Registry', category: 'Entity', color: 'gray' },
}

/**
 * @deprecated Dead path for pilot — do not call from live exporters.
 * Kept only for resolveLegacyCompanyIdByName / optional non-pilot tooling.
 */
async function fetchJsonLegacy<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${LEGACY_BASE}${path}`, {
    headers: { Accept: 'application/json', ...(options?.headers as Record<string, string>) },
    ...options,
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || res.statusText || 'KYI API error')
  }
  return res.json() as Promise<T>
}

// Minimal legacy company shape used for name-based mapping.
interface LegacyCompanyRef {
  id: number
  name: string
}

/** Resolve a legacy KYI company id by (case-insensitive) company name. */
async function resolveLegacyCompanyIdByName(companyName: string): Promise<number | null> {
  const trimmed = (companyName ?? '').trim()
  if (!trimmed) return null
  try {
    const companies = await fetchJsonLegacy<LegacyCompanyRef[]>('/companies')
    if (!Array.isArray(companies) || companies.length === 0) return null
    const target = trimmed.toLowerCase()
    const exact = companies.find((c) => (c.name ?? '').trim().toLowerCase() === target)
    if (exact) return exact.id
    const partial = companies.find((c) => (c.name ?? '').trim().toLowerCase().includes(target))
    return partial?.id ?? null
  } catch {
    return null
  }
}

// Simple haversine implementation for geo filtering (miles)
const EARTH_RADIUS_MILES = 3958.8

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Haversine distance in miles (exported for tests). */
export function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_MILES * c
}

export interface GeoCircle {
  centerLat: number
  centerLng: number
  radiusMiles: number
}

function isValidGeoCircle(circle: GeoCircle): boolean {
  return (
    Number.isFinite(circle.centerLat) &&
    Number.isFinite(circle.centerLng) &&
    Number.isFinite(circle.radiusMiles) &&
    circle.radiusMiles > 0
  )
}

function geoCircleKey(circle: GeoCircle): string {
  return `${circle.centerLat.toFixed(4)}|${circle.centerLng.toFixed(4)}|${circle.radiusMiles.toFixed(1)}`
}

function appendGeoCircle(circles: GeoCircle[], seen: Set<string>, row: {
  center_lat?: unknown
  center_lng?: unknown
  radius_miles?: unknown
}): void {
  const centerLat = typeof row.center_lat === 'number' ? row.center_lat : Number(row.center_lat)
  const centerLng = typeof row.center_lng === 'number' ? row.center_lng : Number(row.center_lng)
  const radiusRaw = row.radius_miles
  const radiusMiles =
    typeof radiusRaw === 'number' && Number.isFinite(radiusRaw)
      ? radiusRaw
      : Number(radiusRaw) || 50
  const circle: GeoCircle = { centerLat, centerLng, radiusMiles }
  if (!isValidGeoCircle(circle)) return
  const key = geoCircleKey(circle)
  if (seen.has(key)) return
  seen.add(key)
  circles.push(circle)
}

export type KyiOutreachStatus = 'new' | 'contacted' | 'meeting' | 'passed'

export interface KyiLeadSnapshot {
  lead_id: number
  fit_percent: number
  raw_score: number
  top_signals: string[]
  entity_type: string
  display_name: string
}

/**
 * Paginated fetch – Supabase caps .select() at 1 000 rows by default.
 * Returns org-owned leads plus null-org platform catalog (read-only).
 */
async function fetchAllLeads(): Promise<Record<string, unknown>[]> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const PAGE = 1000
  const all: Record<string, unknown>[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('kyi_investor_leads')
      .select('*')
      .or(`organization_id.eq.${orgId},organization_id.is.null`)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message || 'Failed to load leads')
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

function leadScoreOptsFromRow(
  row: Record<string, unknown>,
  raise?: RaiseContext | null,
): LeadScoreOpts {
  const lat = (row.lat as number | null) ?? null
  const lng = (row.lng as number | null) ?? null
  const meta = row.metadata as Record<string, unknown> | null | undefined
  return {
    hasCoordinates: lat != null && lng != null,
    raise: raise ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : undefined,
    metadata: meta && typeof meta === 'object' ? meta : undefined,
  }
}

function normalizeLeadScores(lead: KYILead, scoreOpts?: LeadScoreOpts): KYILead {
  const opts: LeadScoreOpts = {
    hasCoordinates: lead.lat != null && lead.lng != null,
    raise: scoreOpts?.raise ?? null,
    tags: lead.tags,
    metadata: lead.metadata,
  }
  const raw_score = computeLeadScore(lead.signals, opts)
  return { ...lead, raw_score, fit_percent: leadScoreToFitPercent(raw_score) }
}

function mapLeadRow(row: Record<string, unknown>, raise?: RaiseContext | null): KYILead {
  const signals = (row.signals as KYILead['signals']) ?? undefined
  const lat = (row.lat as number | null) ?? null
  const lng = (row.lng as number | null) ?? null
  const scoreOpts = leadScoreOptsFromRow(row, raise)
  const raw_score = computeLeadScore(signals, scoreOpts)
  const meta = row.metadata as Record<string, unknown> | null | undefined

  return {
    id: row.id as number,
    client_id: row.client_id as number,
    entity_type: (row.entity_type as 'person' | 'firm') ?? 'person',
    display_name: row.display_name as string,
    city: (row.city as string | null) ?? null,
    state: (row.state as string | null) ?? null,
    zip_code: (row.zip_code as string | null) ?? null,
    lat,
    lng,
    raw_score,
    fit_percent: leadScoreToFitPercent(raw_score),
    investor_type_id: (row.investor_type_id as number | null) ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : undefined,
    metadata: meta && typeof meta === 'object' ? meta : undefined,
    signals,
    sources: Array.isArray(row.sources)
      ? (row.sources as KYILead['sources'])
      : undefined,
  }
}

function normalizeLeadSources(
  value: unknown,
): Array<{ source_name: string; url?: string; date_observed?: string; confidence?: number; [key: string]: unknown }> {
  if (!Array.isArray(value)) return []
  const out: Array<{ source_name: string; url?: string; date_observed?: string; confidence?: number; [key: string]: unknown }> = []
  for (const item of value) {
    if (typeof item === 'string') {
      const source_name = item.trim()
      if (source_name) out.push({ source_name })
      continue
    }
    if (!item || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    const source_name = typeof raw.source_name === 'string' ? raw.source_name.trim() : ''
    if (!source_name) continue
    out.push({
      ...raw,
      source_name,
      url: typeof raw.url === 'string' ? raw.url : undefined,
      date_observed: typeof raw.date_observed === 'string' ? raw.date_observed : undefined,
      confidence: typeof raw.confidence === 'number' ? raw.confidence : undefined,
    })
  }
  return out
}

function mergeLeadRows(
  primary: Record<string, unknown>,
  secondary: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...primary }

  const pSignals =
    primary.signals && typeof primary.signals === 'object'
      ? ({ ...(primary.signals as Record<string, unknown>) } as Record<string, unknown>)
      : {}
  const sSignals =
    secondary.signals && typeof secondary.signals === 'object'
      ? (secondary.signals as Record<string, unknown>)
      : {}

  for (const [key, value] of Object.entries(sSignals)) {
    if (typeof value === 'boolean') {
      pSignals[key] = Boolean(pSignals[key]) || value
      continue
    }
    if (key === 'signal_dates' && value && typeof value === 'object') {
      const left =
        pSignals.signal_dates && typeof pSignals.signal_dates === 'object'
          ? (pSignals.signal_dates as Record<string, unknown>)
          : {}
      const right = value as Record<string, unknown>
      pSignals.signal_dates = { ...left, ...right }
      continue
    }
    if (!(key in pSignals)) pSignals[key] = value
  }
  merged.signals = pSignals

  const tagSet = new Set<string>()
  for (const tag of Array.isArray(primary.tags) ? (primary.tags as unknown[]) : []) {
    if (typeof tag === 'string' && tag.trim()) tagSet.add(tag)
  }
  for (const tag of Array.isArray(secondary.tags) ? (secondary.tags as unknown[]) : []) {
    if (typeof tag === 'string' && tag.trim()) tagSet.add(tag)
  }
  merged.tags = [...tagSet]

  const sourceMap = new Map<string, { source_name: string; url?: string; date_observed?: string; confidence?: number; [key: string]: unknown }>()
  for (const src of normalizeLeadSources(primary.sources)) {
    const key = `${src.source_name.toLowerCase()}|${(src.url ?? '').toLowerCase()}|${(src.date_observed ?? '').toLowerCase()}`
    sourceMap.set(key, src)
  }
  for (const src of normalizeLeadSources(secondary.sources)) {
    const key = `${src.source_name.toLowerCase()}|${(src.url ?? '').toLowerCase()}|${(src.date_observed ?? '').toLowerCase()}`
    const existing = sourceMap.get(key)
    if (!existing) {
      sourceMap.set(key, src)
      continue
    }
    sourceMap.set(key, {
      ...existing,
      ...src,
      confidence:
        typeof existing.confidence === 'number' || typeof src.confidence === 'number'
          ? Math.max(
              typeof existing.confidence === 'number' ? existing.confidence : 0,
              typeof src.confidence === 'number' ? src.confidence : 0,
            )
          : undefined,
    })
  }
  merged.sources = [...sourceMap.values()]

  if (merged.lat == null && secondary.lat != null) merged.lat = secondary.lat
  if (merged.lng == null && secondary.lng != null) merged.lng = secondary.lng
  if (!merged.city && secondary.city) merged.city = secondary.city
  if (!merged.state && secondary.state) merged.state = secondary.state
  if (!merged.zip_code && secondary.zip_code) merged.zip_code = secondary.zip_code
  if (!merged.investor_type_id && secondary.investor_type_id) merged.investor_type_id = secondary.investor_type_id

  const pMeta = primary.metadata && typeof primary.metadata === 'object' ? (primary.metadata as Record<string, unknown>) : null
  const sMeta = secondary.metadata && typeof secondary.metadata === 'object' ? (secondary.metadata as Record<string, unknown>) : null
  if (pMeta || sMeta) merged.metadata = { ...(sMeta ?? {}), ...(pMeta ?? {}) }

  return merged
}

export type { LeadScoreBreakdownItem, KyiLeadFilterPresetId, RaiseContext }
export { getLeadScoreBreakdown, KYI_LEAD_FILTER_PRESETS } from '@/lib/kyi-lead-scoring'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInvestorRow(row: any): KYIInvestor {
  const snap = row.lead_snapshot as KyiLeadSnapshot | null | undefined
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email ?? null,
    phone: row.phone ?? null,
    firm: row.firm ?? null,
    title: row.title ?? null,
    location: row.location ?? null,
    industry: row.industry ?? null,
    profile_url: row.profile_url ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    investor_type: row.investor_type ?? null,
    user_role_classification: row.user_role_classification ?? null,
    added_via_orbit: row.added_via_orbit ?? null,
    segment_type: row.segment_type ?? null,
    source_lead_id: row.source_lead_id ?? null,
    outreach_status: (row.outreach_status as KyiOutreachStatus) ?? 'new',
    lead_snapshot: snap && typeof snap === 'object' ? snap : null,
    northstar_tier: row.northstar_tier ?? null,
    northstar_pipeline_stage: row.northstar_pipeline_stage ?? null,
    northstar_probability: row.northstar_probability ?? null,
    northstar_warm_intro: row.northstar_warm_intro ?? null,
    northstar_last_contact_at: row.northstar_last_contact_at ?? null,
    northstar_next_step: row.northstar_next_step ?? null,
    northstar_scorecard: row.northstar_scorecard ?? null,
    northstar_category_fields: row.northstar_category_fields ?? null,
    northstar_due_diligence: row.northstar_due_diligence ?? null,
    global_investor_id:
      row.global_investor_id != null ? Number(row.global_investor_id) : null,
    internal_rating:
      row.internal_rating != null ? Number(row.internal_rating) : null,
    assigned_team_member: (row.assigned_team_member as string) ?? null,
  }
}

/** PostgREST error when a selected column does not exist (migration not applied yet). */
function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42703' || (error.message ?? '').includes('does not exist')
}

/** Merge optional company columns from separate selects so missing migrations do not break the page. */
async function fetchOptionalCompanyColumns(
  companyId: number,
  orgId: string,
  columnGroups: string[],
): Promise<Record<string, unknown>> {
  const merged: Record<string, unknown> = {}
  for (const sel of columnGroups) {
    const { data, error } = await supabase
      .from('kyi_companies')
      .select(sel)
      .eq('id', companyId)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (!error && data && typeof data === 'object') {
      Object.assign(merged, data as Record<string, unknown>)
    }
  }
  return merged
}

async function loadCompanyRaiseContext(companyId: number): Promise<RaiseContext | null> {
  if (!isSupabaseConfigured) return null
  const orgId = await assertCompanyInOrg(companyId)
  const { data: base, error: baseErr } = await supabase
    .from('kyi_companies')
    .select('industry')
    .eq('id', companyId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (baseErr && !isMissingColumnError(baseErr)) return null
  const extra = await fetchOptionalCompanyColumns(companyId, orgId, [
    'raise_stage, preferred_investor_types, sector_tags',
  ])
  const row: Record<string, unknown> = {
    ...(base && typeof base === 'object' ? (base as Record<string, unknown>) : {}),
    ...extra,
  }
  if (Object.keys(row).length === 0) return null
  const preferred = row.preferred_investor_types
  const sector = row.sector_tags
  return {
    stage: (row.raise_stage as string | null) ?? null,
    industry: (row.industry as string | null) ?? null,
    preferredTypes: Array.isArray(preferred) ? (preferred as string[]) : [],
    sectorTags: Array.isArray(sector) ? (sector as string[]) : [],
  }
}

/**
 * Load geo circles for lead filtering.
 * Primary market: kyi_client_geo_settings (company target location + radius).
 * Additional roadshow markets: kyi_company_geo_targets with sort_order > 0 only.
 */
async function loadGeoCirclesForCompany(companyId: number): Promise<GeoCircle[]> {
  if (!isSupabaseConfigured) return []
  const orgId = await assertCompanyInOrg(companyId)
  const circles: GeoCircle[] = []
  const seen = new Set<string>()

  const { data: geoRow, error: geoError } = await supabase
    .from('kyi_client_geo_settings')
    .select('center_lat, center_lng, radius_miles')
    .eq('client_id', companyId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!geoError && geoRow) {
    appendGeoCircle(circles, seen, geoRow)
  }

  try {
    const { data: multi, error: multiErr } = await supabase
      .from('kyi_company_geo_targets')
      .select('center_lat, center_lng, radius_miles, sort_order, is_active')
      .eq('company_id', companyId)
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .gt('sort_order', 0)
      .order('sort_order', { ascending: true })
    if (!multiErr && multi) {
      for (const row of multi) {
        appendGeoCircle(circles, seen, row)
      }
    }
  } catch {
    /* table may not exist yet */
  }

  return circles
}

/** True when lead coordinates fall within any configured geo circle (exported for tests). */
export function leadInAnyGeoCircle(lead: Pick<KYILead, 'lat' | 'lng'>, circles: GeoCircle[]): boolean {
  if (circles.length === 0) return false
  if (lead.lat == null || lead.lng == null) return false
  return circles.some(
    (c) =>
      isValidGeoCircle(c) &&
      distanceMiles(lead.lat!, lead.lng!, c.centerLat, c.centerLng) <= c.radiusMiles,
  )
}

export function buildLeadSnapshotFromLead(lead: KYILead): KyiLeadSnapshot {
  const breakdown = getLeadScoreBreakdown(lead.signals, {
    hasCoordinates: lead.lat != null && lead.lng != null,
    tags: lead.tags,
    metadata: lead.metadata,
  })
  return {
    lead_id: lead.id,
    fit_percent: lead.fit_percent,
    raw_score: lead.raw_score,
    top_signals: breakdown.map((b) => b.key),
    entity_type: lead.entity_type,
    display_name: lead.display_name,
  }
}

// Geocoding: Open-Meteo only (CORS-supported in browser). Do not use Nominatim from the
// client — it blocks cross-origin requests, which causes "Geocode now" to fail in the console.
const OPEN_METEO_GEOCODE = 'https://geocoding-api.open-meteo.com'

const US_STATE_ABBREVS: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
  CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',
  KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',
  MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',
  MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',
  NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',
  OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',
  VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
  DC:'District of Columbia',PR:'Puerto Rico',VI:'Virgin Islands',GU:'Guam',
}

const US_STATE_NAMES_TO_ABBREV: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATE_ABBREVS).map(([abbrev, full]) => [full.toLowerCase(), abbrev]),
)

/** Rough bounding boxes for validating stored lat/lng against a lead's claimed US state. */
const US_STATE_BOUNDS: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  AL: { minLat: 30.14, maxLat: 35.01, minLng: -88.47, maxLng: -84.89 },
  AK: { minLat: 51.0, maxLat: 71.5, minLng: -179.0, maxLng: -130.0 },
  AZ: { minLat: 31.33, maxLat: 37.0, minLng: -114.82, maxLng: -109.04 },
  AR: { minLat: 33.0, maxLat: 36.5, minLng: -94.62, maxLng: -89.64 },
  CA: { minLat: 32.53, maxLat: 42.01, minLng: -124.41, maxLng: -114.13 },
  CO: { minLat: 36.99, maxLat: 41.0, minLng: -109.06, maxLng: -102.04 },
  CT: { minLat: 40.98, maxLat: 42.05, minLng: -73.73, maxLng: -71.79 },
  DE: { minLat: 38.45, maxLat: 39.84, minLng: -75.79, maxLng: -75.05 },
  FL: { minLat: 24.52, maxLat: 31.0, minLng: -87.63, maxLng: -80.03 },
  GA: { minLat: 30.36, maxLat: 35.0, minLng: -85.61, maxLng: -80.84 },
  HI: { minLat: 18.91, maxLat: 22.24, minLng: -160.25, maxLng: -154.81 },
  ID: { minLat: 41.99, maxLat: 49.0, minLng: -117.24, maxLng: -111.04 },
  IL: { minLat: 36.97, maxLat: 42.51, minLng: -91.51, maxLng: -87.02 },
  IN: { minLat: 37.77, maxLat: 41.76, minLng: -88.1, maxLng: -84.78 },
  IA: { minLat: 40.38, maxLat: 43.5, minLng: -96.64, maxLng: -90.14 },
  KS: { minLat: 36.99, maxLat: 40.0, minLng: -102.05, maxLng: -94.59 },
  KY: { minLat: 36.5, maxLat: 39.15, minLng: -89.57, maxLng: -81.96 },
  LA: { minLat: 28.93, maxLat: 33.02, minLng: -94.04, maxLng: -88.82 },
  ME: { minLat: 43.06, maxLat: 47.46, minLng: -71.08, maxLng: -66.95 },
  MD: { minLat: 37.91, maxLat: 39.72, minLng: -79.49, maxLng: -75.05 },
  MA: { minLat: 41.24, maxLat: 42.89, minLng: -73.51, maxLng: -69.93 },
  MI: { minLat: 41.7, maxLat: 48.3, minLng: -90.42, maxLng: -82.41 },
  MN: { minLat: 43.5, maxLat: 49.38, minLng: -97.24, maxLng: -89.49 },
  MS: { minLat: 30.17, maxLat: 34.99, minLng: -91.66, maxLng: -88.1 },
  MO: { minLat: 35.99, maxLat: 40.61, minLng: -95.77, maxLng: -89.1 },
  MT: { minLat: 44.36, maxLat: 49.0, minLng: -116.05, maxLng: -104.04 },
  NE: { minLat: 39.99, maxLat: 43.0, minLng: -104.06, maxLng: -95.31 },
  NV: { minLat: 35.0, maxLat: 42.0, minLng: -120.01, maxLng: -114.04 },
  NH: { minLat: 42.7, maxLat: 45.31, minLng: -72.56, maxLng: -70.61 },
  NJ: { minLat: 38.93, maxLat: 41.36, minLng: -75.56, maxLng: -73.89 },
  NM: { minLat: 31.33, maxLat: 37.0, minLng: -109.05, maxLng: -103.0 },
  NY: { minLat: 40.5, maxLat: 45.02, minLng: -79.76, maxLng: -71.86 },
  NC: { minLat: 33.84, maxLat: 36.59, minLng: -84.32, maxLng: -75.46 },
  ND: { minLat: 45.94, maxLat: 49.0, minLng: -104.05, maxLng: -96.55 },
  OH: { minLat: 38.4, maxLat: 42.0, minLng: -84.82, maxLng: -80.52 },
  OK: { minLat: 33.62, maxLat: 37.0, minLng: -103.0, maxLng: -94.43 },
  OR: { minLat: 41.99, maxLat: 46.29, minLng: -124.57, maxLng: -116.46 },
  PA: { minLat: 39.72, maxLat: 42.27, minLng: -80.52, maxLng: -74.69 },
  RI: { minLat: 41.15, maxLat: 42.02, minLng: -71.86, maxLng: -71.12 },
  SC: { minLat: 32.05, maxLat: 35.22, minLng: -83.35, maxLng: -78.54 },
  SD: { minLat: 42.48, maxLat: 45.94, minLng: -104.06, maxLng: -96.44 },
  TN: { minLat: 34.98, maxLat: 36.68, minLng: -90.31, maxLng: -81.65 },
  TX: { minLat: 25.84, maxLat: 36.5, minLng: -106.65, maxLng: -93.51 },
  UT: { minLat: 36.99, maxLat: 42.0, minLng: -114.05, maxLng: -109.04 },
  VT: { minLat: 42.73, maxLat: 45.02, minLng: -73.44, maxLng: -71.46 },
  VA: { minLat: 36.54, maxLat: 39.47, minLng: -83.68, maxLng: -75.24 },
  WA: { minLat: 45.54, maxLat: 49.0, minLng: -124.76, maxLng: -116.92 },
  WV: { minLat: 37.2, maxLat: 40.64, minLng: -82.64, maxLng: -77.72 },
  WI: { minLat: 42.49, maxLat: 47.08, minLng: -92.89, maxLng: -86.25 },
  WY: { minLat: 40.99, maxLat: 45.01, minLng: -111.06, maxLng: -104.05 },
  DC: { minLat: 38.79, maxLat: 39.0, minLng: -77.12, maxLng: -76.91 },
  PR: { minLat: 17.88, maxLat: 18.52, minLng: -67.27, maxLng: -65.22 },
}

function normalizeLeadStateAbbrev(state: string | null | undefined): string | null {
  const raw = (state ?? '').trim()
  if (!raw) return null
  const upper = raw.toUpperCase()
  if (upper in US_STATE_BOUNDS) return upper
  const fromName = US_STATE_NAMES_TO_ABBREV[raw.toLowerCase()]
  return fromName ?? null
}

/**
 * True when lat/lng fall inside the lead's claimed US state (or state is unknown).
 * Catches stale geocodes like "Hillsborough, CA" pinned to Hillsborough, NC coords.
 */
export function leadCoordinatesMatchState(
  lead: Pick<KYILead, 'lat' | 'lng' | 'state'>,
): boolean {
  if (lead.lat == null || lead.lng == null) return true
  const abbrev = normalizeLeadStateAbbrev(lead.state)
  if (!abbrev) return true
  const bounds = US_STATE_BOUNDS[abbrev]
  if (!bounds) return true
  const pad = 0.2
  return (
    lead.lat >= bounds.minLat - pad &&
    lead.lat <= bounds.maxLat + pad &&
    lead.lng >= bounds.minLng - pad &&
    lead.lng <= bounds.maxLng + pad
  )
}

/** Radius + state consistency — both must pass for a lead to appear in localized results. */
export function leadInGeoTargetingArea(
  lead: Pick<KYILead, 'lat' | 'lng' | 'state'>,
  circles: GeoCircle[],
): boolean {
  return leadInAnyGeoCircle(lead, circles) && leadCoordinatesMatchState(lead)
}

/**
 * Open-Meteo geocoding with country-aware filtering.
 *
 * Pitfalls discovered empirically:
 * - "City, ST" combined queries return empty — Open-Meteo only understands city names.
 * - count=1 + countryCode=US is buggy: the country filter applies AFTER the limit,
 *   so popular non-US cities (e.g. Birmingham UK) eat the single slot → empty result.
 *
 * Fix: request count=20, filter client-side by country_code in the response.
 * IMPORTANT: when countryCode is specified and no matching result is found, return null
 * rather than falling back to a non-US city — this prevents wrong-location bugs where
 * e.g. "Birmingham" returns Birmingham UK coordinates and all leads appear there.
 */
async function geocodeLocationLabel(
  label: string,
  countryCode?: string
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = (label ?? '').trim().replace(/^,\s*|\s*,$/g, '').trim()
  if (trimmed.length < 3) return null
  try {
    const params = new URLSearchParams({
      name: trimmed,
      count: '20',
      language: 'en',
      format: 'json',
    })
    const url = `${OPEN_METEO_GEOCODE}/v1/search?${params.toString()}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as {
      results?: Array<{ latitude?: number; longitude?: number; country_code?: string; admin1?: string }>
    }
    if (!Array.isArray(data.results) || data.results.length === 0) return null

    if (countryCode) {
      // Filter client-side by country code. Never fall back to a non-matching country —
      // returning null lets the caller try a better query rather than pinning to the wrong country.
      const cc = countryCode.toUpperCase()
      const countryMatch = data.results.find(
        (r) => (r.country_code ?? '').toUpperCase() === cc && r.latitude != null && r.longitude != null,
      )
      if (!countryMatch) return null
      return { lat: countryMatch.latitude!, lng: countryMatch.longitude! }
    }

    const first = data.results[0]
    if (first?.latitude == null || first?.longitude == null) return null
    return { lat: first.latitude, lng: first.longitude }
  } catch {
    return null
  }
}

/** Expand common US city abbreviations that Open-Meteo doesn't recognize. */
function normalizeCityName(raw: string): string {
  let name = raw.trim()

  // Strip embedded state: "CHICAGO, IL" -> "CHICAGO"
  const commaIdx = name.indexOf(',')
  if (commaIdx > 0) name = name.substring(0, commaIdx).trim()

  // Directional prefixes (handle both "N CHICAGO" and "N. CHICAGO")
  name = name.replace(/^N\.?\s+/i, 'North ')
  name = name.replace(/^S\.?\s+/i, 'South ')
  name = name.replace(/^E\.?\s+/i, 'East ')
  name = name.replace(/^W\.?\s+/i, 'West ')
  name = name.replace(/^NE\.?\s+/i, 'Northeast ')
  name = name.replace(/^NW\.?\s+/i, 'Northwest ')
  name = name.replace(/^SE\.?\s+/i, 'Southeast ')
  name = name.replace(/^SW\.?\s+/i, 'Southwest ')

  // Common suffix abbreviations
  const SUFFIX_MAP: Record<string, string> = {
    MT: 'Mountain', MTS: 'Mountains', HLS: 'Hills', HTS: 'Heights',
    SPGS: 'Springs', SPG: 'Springs', JCT: 'Junction', CTR: 'Center',
    VLG: 'Village', HBR: 'Harbor', BCH: 'Beach', PK: 'Park',
    FLS: 'Falls', STA: 'Station', FT: 'Fort', ST: 'Saint',
    PT: 'Point', TWP: 'Township', BRG: 'Bridge', BRK: 'Brook',
    BRKS: 'Brooks', CRK: 'Creek', XING: 'Crossing', EST: 'Estates',
    FRK: 'Fork', FRKS: 'Forks', GLN: 'Glen', GRV: 'Grove',
    IS: 'Island', ISS: 'Islands', LK: 'Lake', LKS: 'Lakes',
    LNDG: 'Landing', MDW: 'Meadow', MDWS: 'Meadows', ML: 'Mill',
    MLS: 'Mills', MNR: 'Manor', PLN: 'Plain', PLNS: 'Plains',
    PLZ: 'Plaza', PRT: 'Port', RDG: 'Ridge', RIV: 'River',
    SHR: 'Shore', SHRS: 'Shores', SMT: 'Summit', VW: 'View',
    VLY: 'Valley', VLGS: 'Villages', HVN: 'Haven', HOLW: 'Hollow',
    RNCH: 'Ranch', BLF: 'Bluff', CLF: 'Cliff', CLFS: 'Cliffs',
  }
  for (const [abbr, full] of Object.entries(SUFFIX_MAP)) {
    const re = new RegExp(`\\b${abbr}\\b`, 'i')
    if (re.test(name)) {
      name = name.replace(re, full)
      break
    }
  }

  return name.trim()
}

/**
 * Geocode by city + state with state-aware matching.
 * Normalizes city names (expands abbreviations, strips embedded state),
 * then picks the result whose admin1 matches the state.
 */
async function geocodeCityState(city: string | null, state: string | null): Promise<{ lat: number; lng: number } | null> {
  let c = (city ?? '').trim()
  let s = (state ?? '').trim()
  if (!c && !s) return null

  // If city contains "CITY, ST", extract state from it when state param is empty
  if (c.includes(',')) {
    const parts = c.split(',').map((p) => p.trim())
    c = parts[0]
    if (!s && parts[1] && parts[1].length === 2) s = parts[1]
  }

  c = normalizeCityName(c)

  const query = c || s
  if (query.length < 3) return null

  try {
    const params = new URLSearchParams({
      name: query,
      count: '20',
      language: 'en',
      format: 'json',
    })
    const url = `${OPEN_METEO_GEOCODE}/v1/search?${params.toString()}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as {
      results?: Array<{ latitude?: number; longitude?: number; country_code?: string; admin1?: string }>
    }
    if (!Array.isArray(data.results) || data.results.length === 0) return null

    // Prefer: US result whose admin1 matches the state → any US result → null
    // Never fall back to a non-US result — leads are US-based and a wrong-country
    // coordinate would silently mis-place every geocoded lead.
    const usResults = data.results.filter(
      (r) => (r.country_code ?? '').toUpperCase() === 'US' && r.latitude != null && r.longitude != null,
    )

    if (s && usResults.length > 0) {
      const sUpper = s.toUpperCase()
      const fullState = US_STATE_ABBREVS[sUpper] ?? s
      const fullLower = fullState.toLowerCase()
      const stateMatch = usResults.find((r) => {
        const admin = (r.admin1 ?? '').toLowerCase()
        return admin === fullLower
      })
      if (stateMatch) return { lat: stateMatch.latitude!, lng: stateMatch.longitude! }
      // State was provided but no admin1 match — do not guess (wrong coords leak into radius)
      return null
    }

    if (usResults.length > 0) return { lat: usResults[0].latitude!, lng: usResults[0].longitude! }

    // No US result found — return null so the caller can try a better query
    return null
  } catch {
    return null
  }
}

/** Parse US-style address to city, state, ZIP for fallback geocoding (Open-Meteo prefers city/postal over full street). */
function parseAddressForGeocode(address: string): { city?: string; state?: string; zip?: string } {
  const parts = (address ?? '')
    .trim()
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length < 2) return {}
  const last = parts[parts.length - 1]
  const stateZip = last.match(/^([A-Za-z]{2})\s+(\d{5}(-\d{4})?)\s*$/) ?? last.match(/^([A-Za-z]{2})\s*$/)
  if (stateZip) {
    const state = stateZip[1]?.toUpperCase()
    const zip = stateZip[2]
    const city = parts[parts.length - 2]
    return { city, state, zip }
  }
  const city = parts[parts.length - 2]
  const statePart = last
  const abbrev = US_STATE_NAMES_TO_ABBREV[statePart.toLowerCase()]
  return { city, state: abbrev ?? statePart }
}

/** Geocode a free-form location (full address or "City, ST"). Tries city+state first (Open-Meteo rejects "City, ST" combined queries). */
async function geocodeAddressOrLabel(label: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = (label ?? '').trim()
  if (trimmed.length < 3) return null

  const { city, state, zip } = parseAddressForGeocode(trimmed)
  if (city && state) {
    const cityState = await geocodeCityState(city, state)
    if (cityState) return cityState
  }

  const commaParts = trimmed.split(',').map((p) => p.trim()).filter(Boolean)
  if (commaParts.length === 2 && commaParts[1].length > 2 && !commaParts[1].match(/^\d/)) {
    const cityState = await geocodeCityState(commaParts[0], commaParts[1])
    if (cityState) return cityState
  }

  let result = await geocodeLocationLabel(trimmed, 'US')
  if (result) return result
  if (city) result = await geocodeLocationLabel(normalizeCityName(city), 'US')
  if (!result && zip) result = await geocodeLocationLabel(zip, 'US')
  return result
}

export interface KYICompany {
  id: number
  name: string
  location: string | null
  industry: string | null
  website: string | null
  logo_url: string | null
  investor_count: number
}

export interface KYIInvestor {
  id: number
  full_name: string
  email: string | null
  phone: string | null
  firm: string | null
  title: string | null
  location: string | null
  industry: string | null
  profile_url: string | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
  investor_type?: string | null
  user_role_classification?: string | null
  added_via_orbit?: boolean | null
  segment_type?: string | null
  source_lead_id?: number | null
  outreach_status?: KyiOutreachStatus | null
  lead_snapshot?: KyiLeadSnapshot | null
  northstar_tier?: number | null
  northstar_pipeline_stage?: string | null
  northstar_probability?: number | null
  northstar_warm_intro?: boolean | null
  northstar_last_contact_at?: string | null
  northstar_next_step?: string | null
  northstar_scorecard?: Record<string, number> | null
  northstar_category_fields?: Record<string, string> | null
  northstar_due_diligence?: Record<string, string> | null
  /** Link to shared KYI 2.0 global investor identity (nullable until promoted/associated) */
  global_investor_id?: number | null
  /** Private org rating 1–5 (never shared to ecosystem) */
  internal_rating?: number | null
  assigned_team_member?: string | null
}

export interface KYICompanyDetail extends KYICompany {
  description: string | null
  created_at: string | null
  linkedin_url?: string | null
  twitter_url?: string | null
  tags?: string[] | null
  raise_stage?: string | null
  raise_target_amount?: number | null
  preferred_investor_types?: string[] | null
  sector_tags?: string[] | null
}

// ---------------------------------------------------------------------------
// Companies & investors
// ---------------------------------------------------------------------------

/** Segment for investors added from Access Map / geo targeting picks */
export const KYI_SEGMENT_TARGETED_INVESTOR = 'targeted_investor'
/** Personal connection upload — private to org; may optionally contribute identity to ecosystem */
export const KYI_SEGMENT_PERSONAL_NETWORK = 'personal_network'

/** Deep-link to add a person to Targeted Investors from Access Map or leads */
export function buildTargetedInvestorAddUrl(
  companyId: number,
  name: string,
  location?: string | null,
  leadId?: number | null,
): string {
  const params = new URLSearchParams({
    tab: 'contacts',
    segment: 'targeted',
    addName: name,
    targeted: '1',
  })
  if (location?.trim()) params.set('addLocation', location.trim())
  if (leadId != null) params.set('addLeadId', String(leadId))
  return `/kyi/companies/${companyId}?${params.toString()}`
}

export async function getCompanies(): Promise<KYICompany[]> {
  requireSupabase()
  const orgId = await getOrganizationId()

  const { data: orgRow } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle()
  const orgName = ((orgRow?.name as string | undefined) ?? '').trim()

  // Prefer base table with org filter (view may lag migrations).
  const { data, error } = await supabase
    .from('kyi_companies')
    .select('id, name, location, industry, website, logo_url')
    .eq('organization_id', orgId)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Failed to load KYI companies')
  }

  const rows = (data ?? []).filter((row) => {
    const name = String(row.name ?? '')
    if (!orgName) return true
    return !isLeakedDemoCompanyName(name, orgName)
  })
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id as number)
  const { data: invRows, error: invErr } = await supabase
    .from('kyi_investors')
    .select('company_id')
    .eq('organization_id', orgId)
    .in('company_id', ids)

  if (invErr) {
    throw new Error(invErr.message || 'Failed to load KYI investor counts')
  }

  const counts = new Map<number, number>()
  for (const row of invRows ?? []) {
    const cid = row.company_id as number
    counts.set(cid, (counts.get(cid) ?? 0) + 1)
  }

  return rows.map((row) => ({
    id: row.id as number,
    name: row.name as string,
    location: (row.location as string | null) ?? null,
    industry: (row.industry as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    logo_url: (row.logo_url as string | null) ?? null,
    investor_count: counts.get(row.id as number) ?? 0,
  }))
}

export async function getRecentKyiCompanies(
  limit: number = 50,
): Promise<Array<{ id: number; name: string; created_at: string; updated_at: string | null }>> {
  requireSupabase()
  const orgId = await getOrganizationId()

  const { data, error } = await supabase
    .from('kyi_companies')
    .select('id, name, created_at, updated_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message || 'Failed to load recent KYI companies')
  }

  return (data ?? []).map((row) => ({
    id: row.id as number,
    name: row.name as string,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
    updated_at: (row.updated_at as string | null) ?? null,
  }))
}

export async function createCompany(data: {
  name: string
  location?: string
  industry?: string
  website?: string
  description?: string
}): Promise<KYICompany> {
  requireSupabase()

  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const payload = {
    name: data.name.trim(),
    location: data.location?.trim() || null,
    industry: data.industry?.trim() || null,
    website: data.website?.trim() || null,
    description: data.description?.trim() || null,
    user_id: userId,
    organization_id: orgId,
  }

  const { data: row, error } = await supabase
    .from('kyi_companies')
    .insert(payload)
    .select('id, name, location, industry, website, logo_url, description, created_at')
    .single()

  if (error || !row) {
    throw new Error(error?.message || 'Failed to create KYI company')
  }

  try {
    const { seedCompanyNorthstarDefaults } = await import('@/lib/kyi-northstar')
    await seedCompanyNorthstarDefaults(row.id as number)
  } catch {
    // Customization tables may not exist until migration is run
  }

  return {
    id: row.id as number,
    name: row.name as string,
    location: (row.location as string | null) ?? null,
    industry: (row.industry as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    logo_url: (row.logo_url as string | null) ?? null,
    investor_count: 0,
  }
}

export async function updateCompany(
  companyId: number,
  data: {
    name?: string
    location?: string | null
    industry?: string | null
    website?: string | null
    description?: string | null
  },
): Promise<void> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const payload: Record<string, unknown> = {}
  if (data.name !== undefined) payload.name = data.name.trim()
  if (data.location !== undefined) payload.location = data.location?.trim() || null
  if (data.industry !== undefined) payload.industry = data.industry?.trim() || null
  if (data.website !== undefined) payload.website = data.website?.trim() || null
  if (data.description !== undefined) payload.description = data.description?.trim() || null
  if (Object.keys(payload).length === 0) return

  const { error } = await supabase
    .from('kyi_companies')
    .update(payload)
    .eq('id', companyId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message || 'Failed to update company')
}

export async function deleteCompany(companyId: number): Promise<{ success: boolean }> {
  requireSupabase()
  const orgId = await getOrganizationId()

  // Ensure company belongs to current org (fail closed — no cross-tenant delete)
  const { data: company, error: findErr } = await supabase
    .from('kyi_companies')
    .select('id')
    .eq('id', companyId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (findErr) {
    throw new Error(findErr.message || 'Failed to verify company')
  }
  if (!company) {
    throw new Error('Company not found in your organization')
  }

  const { error: invErr } = await supabase
    .from('kyi_investors')
    .delete()
    .eq('company_id', companyId)
    .eq('organization_id', orgId)

  if (invErr) {
    throw new Error(invErr.message || 'Failed to delete company investors')
  }

  const { error: deleteError } = await supabase
    .from('kyi_companies')
    .delete()
    .eq('id', companyId)
    .eq('organization_id', orgId)
  if (deleteError) {
    throw new Error(deleteError.message || 'Failed to delete company')
  }

  return { success: true }
}

export async function deleteInvestor(investorId: number): Promise<{ success: boolean }> {
  requireSupabase()
  const orgId = await getOrganizationId()

  const { error } = await supabase
    .from('kyi_investors')
    .delete()
    .eq('id', investorId)
    .eq('organization_id', orgId)
  if (error) {
    throw new Error(error.message || 'Failed to delete investor')
  }

  return { success: true }
}

export async function getCompany(companyId: number): Promise<KYICompanyDetail> {
  requireSupabase()
  const orgId = await getOrganizationId()

  const { data: baseRow, error: baseErr } = await supabase
    .from('kyi_companies')
    .select('id, name, location, industry, website, description, logo_url, created_at')
    .eq('id', companyId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (baseErr) {
    throw new Error(baseErr.message || 'Failed to load KYI company')
  }
  if (!baseRow) {
    throw new Error('Company not found')
  }

  const optional = await fetchOptionalCompanyColumns(companyId, orgId, [
    'raise_stage, raise_target_amount, preferred_investor_types, sector_tags',
    'linkedin_url, twitter_url, tags',
  ])
  const row = { ...(baseRow as Record<string, unknown>), ...optional }

  const { count } = await supabase
    .from('kyi_investors')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('organization_id', orgId)

  const preferred = row.preferred_investor_types
  const sector = row.sector_tags

  return {
    id: row.id as number,
    name: row.name as string,
    location: (row.location as string | null) ?? null,
    industry: (row.industry as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    logo_url: (row.logo_url as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    investor_count: count ?? 0,
    linkedin_url: (row.linkedin_url as string | null) ?? null,
    twitter_url: (row.twitter_url as string | null) ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : null,
    raise_stage: (row.raise_stage as string | null) ?? null,
    raise_target_amount: (row.raise_target_amount as number | null) ?? null,
    preferred_investor_types: Array.isArray(preferred) ? (preferred as string[]) : null,
    sector_tags: Array.isArray(sector) ? (sector as string[]) : null,
  }
}

export async function getCompanyInvestors(
  companyId: number,
  opts?: { segmentTypes?: string[] },
): Promise<KYIInvestor[]> {
  requireSupabase()
  const orgId = await getOrganizationId()

  const { data, error } = await supabase
    .from('kyi_investors')
    .select('*')
    .eq('company_id', companyId)
    .eq('organization_id', orgId)
    .order('full_name', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Failed to load investors')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows = (data as any[] ?? []).map((row: any) => mapInvestorRow(row))

  const seg = opts?.segmentTypes?.filter(Boolean)
  if (seg && seg.length > 0) {
    rows = rows.filter((r) => {
      const st = (r.segment_type ?? 'current_investor').toLowerCase()
      return seg!.some((s) => s.toLowerCase() === st)
    })
  }
  return rows
}

export async function createInvestor(data: {
  company_id: number
  full_name: string
  email?: string
  phone?: string
  location?: string
  industry?: string
  firm?: string
  title?: string
  profile_url?: string
  notes?: string
  user_role_classification?: 'employee' | 'investor'
  added_via_orbit?: boolean
  segment_type?: string
  admin_override_investor_role?: boolean
  source_lead_id?: number | null
  lead_snapshot?: KyiLeadSnapshot | null
  outreach_status?: KyiOutreachStatus
  /** Associate with shared ecosystem identity (KYI 2.0) */
  global_investor_id?: number | null
  /**
   * When false, skip auto-contribute to the shared ecosystem.
   * Defaults to true for investors unless segment is personal_network (caller should opt in).
   */
  contribute_to_ecosystem?: boolean
}): Promise<KYIInvestor> {
  requireSupabase()

  const classification = data.user_role_classification ?? 'employee'
  if (classification === 'investor') {
    if (!data.added_via_orbit && !data.admin_override_investor_role) {
      throw new Error(
        'Investor classification is only available when added via Investor Orbit, or use an admin override.',
      )
    }
  }
  const emailTrim = data.email?.trim()
  if (emailTrim) {
    const emp = await getEmployeeByEmail(emailTrim)
    if (emp?.status === 'Active' && classification === 'investor' && !data.admin_override_investor_role) {
      throw new Error(
        'This email matches an active employee. Set role to Employee or use an admin override for investor.',
      )
    }
  }

  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {
    company_id: data.company_id,
    full_name: data.full_name.trim(),
    email: emailTrim || null,
    phone: data.phone?.trim() || null,
    location: data.location?.trim() || null,
    industry: data.industry?.trim() || null,
    firm: data.firm?.trim() || null,
    title: data.title?.trim() || null,
    profile_url: data.profile_url?.trim() || null,
    notes: data.notes?.trim() || null,
    created_at: now,
    updated_at: now,
    user_id: userId,
    organization_id: orgId,
    user_role_classification: classification,
    added_via_orbit: !!(data.added_via_orbit ?? false),
    segment_type: data.segment_type ?? 'current_investor',
  }
  if (data.source_lead_id != null) payload.source_lead_id = data.source_lead_id
  if (data.lead_snapshot) payload.lead_snapshot = data.lead_snapshot
  if (data.global_investor_id != null) payload.global_investor_id = data.global_investor_id
  const seg = (data.segment_type ?? 'current_investor').toLowerCase()
  payload.outreach_status =
    data.outreach_status ?? (seg === 'targeted_investor' ? 'new' : 'new')

  let { data: row, error } = await supabase.from('kyi_investors').insert(payload).select('*').single()

  // Migration not applied yet — retry without global_investor_id
  if (error && data.global_investor_id != null && isMissingColumnError(error)) {
    delete payload.global_investor_id
    ;({ data: row, error } = await supabase.from('kyi_investors').insert(payload).select('*').single())
  }

  if (error || !row) {
    throw new Error(error?.message || 'Failed to create investor')
  }

  // Contribute public fields to shared directory for real investors.
  // Skip auto-contribute for low-quality lead imports (FEC/Reddit/GitHub/etc.).
  // Personal network uploads only contribute when contribute_to_ecosystem is explicitly true.
  const segmentLower = String(payload.segment_type ?? '').toLowerCase()
  const isPersonalNetwork = segmentLower === KYI_SEGMENT_PERSONAL_NETWORK
  const shouldContribute =
    data.contribute_to_ecosystem === true ||
    (data.contribute_to_ecosystem !== false && !isPersonalNetwork)

  if (data.global_investor_id == null && classification === 'investor' && shouldContribute) {
    try {
      let allowContribute = true
      if (data.source_lead_id != null) {
        const { data: leadRow } = await supabase
          .from('kyi_investor_leads')
          .select('display_name, sources, signals')
          .eq('id', data.source_lead_id)
          .maybeSingle()
        const { isEcosystemQualityLead } = await import('@/lib/kyi-ecosystem')
        allowContribute = isEcosystemQualityLead({
          display_name: (leadRow?.display_name as string) ?? String(row.full_name),
          sources: Array.isArray(leadRow?.sources)
            ? (leadRow!.sources as Array<{ source_name?: string }>)
            : [],
          signals:
            leadRow?.signals && typeof leadRow.signals === 'object'
              ? (leadRow.signals as Record<string, unknown>)
              : {},
        })
      }
      // Personal network: require firm or profile URL so bare name dumps don't pollute the directory.
      if (isPersonalNetwork) {
        const firm = String(row.firm ?? '').trim()
        const profile = String(row.profile_url ?? '').trim()
        const email = String(row.email ?? '').trim()
        allowContribute = allowContribute && (!!firm || !!profile || !!email)
      }
      if (allowContribute) {
        const { findOrCreateGlobalInvestor } = await import('@/lib/kyi-ecosystem')
        const global = await findOrCreateGlobalInvestor({
          display_name: String(row.full_name),
          firm: (row.firm as string) ?? null,
          title: (row.title as string) ?? null,
          location: (row.location as string) ?? null,
          industry: (row.industry as string) ?? null,
          profile_url: (row.profile_url as string) ?? null,
          public_email: isPersonalNetwork ? ((row.email as string) ?? null) : null,
          source: isPersonalNetwork ? 'tenant' : 'tenant',
        })
        const { error: linkErr } = await supabase
          .from('kyi_investors')
          .update({ global_investor_id: global.id })
          .eq('id', row.id)
          .eq('organization_id', orgId)
        if (!linkErr) {
          row = { ...row, global_investor_id: global.id }
        }
      }
    } catch (promoErr) {
      console.warn('[kyi-api] Global directory contribute skipped:', promoErr)
    }
  }

  try {
    const { data: companyRow } = await supabase
      .from('kyi_companies')
      .select('name')
      .eq('id', data.company_id)
      .eq('organization_id', orgId)
      .maybeSingle()

    const { notifyKyiInvestorAdded } = await import('@/lib/notification-modules')
    void notifyKyiInvestorAdded({
      companyId: data.company_id as number,
      companyName: (companyRow?.name as string) ?? null,
      investorId: row.id as number,
      investorName: row.full_name as string,
      segmentType: (row.segment_type as string) ?? data.segment_type,
      sourceLeadId: (row.source_lead_id as number | null) ?? data.source_lead_id ?? null,
      addedViaOrbit: !!(row.added_via_orbit ?? data.added_via_orbit),
    })
  } catch (notifyErr) {
    console.warn('[kyi-api] Investor notification skipped:', notifyErr)
  }

  return mapInvestorRow(row)
}

/** Reference API: suggestion shape (REFERENCE_Suggested_Investors.md) */
export interface SuggestedInvestorRef {
  name: string
  position?: string
  location?: string
  score?: number
  source?: string
  sources?: string[]
  signals?: string[]
  reasons?: string[]
  profile_url?: string
  firm?: string
  related_investors: Array<{ id: number; name: string; firm?: string; reasons?: string[] }>
}

/** Reference API: existing_investors shape */
export interface ExistingInvestorRef {
  id: number
  full_name: string
  firm?: string
  title?: string
  location?: string
  industry?: string
}

/** Reference API: response shape (REFERENCE_Suggested_Investors.md) */
export interface SuggestedInvestorsResponseRef {
  company_name: string
  existing_investors: ExistingInvestorRef[]
  suggested_count: number
  multi_investor_count: number
  firms: Record<string, SuggestedInvestorRef[]>
  suggestions: SuggestedInvestorRef[]
  investor_suggestions?: Record<string, { investor: ExistingInvestorRef; count: number; suggestions: SuggestedInvestorRef[] }>
}

/** Legacy shape (for backward compatibility); normalized to Ref in getSuggestedInvestors */
export interface SuggestedInvestor {
  name: string
  firm?: string
  position?: string
  location?: string
  score?: number
  reasons?: string[]
  sources?: string[]
  signals?: string[]
  related_investors?: Array<{ name: string; id?: number; reasons?: string[]; firm?: string }>
}

export interface SuggestedInvestorsResponse {
  company_name?: string
  investors?: Array<{ id: number; name: string; full_name?: string; firm?: string; label?: string }>
  existing_investors?: ExistingInvestorRef[]
  suggestions: SuggestedInvestor[] | SuggestedInvestorRef[]
  suggested_count?: number
  multi_investor_count?: number
  firms?: Record<string, SuggestedInvestor[] | SuggestedInvestorRef[]>
  investor_suggestions?: Record<string, { count: number; suggestions: SuggestedInvestor[] }>
}

export async function getSuggestedInvestors(companyId: number): Promise<SuggestedInvestorsResponseRef> {
  requireSupabase()

  const company = await getCompany(companyId)
  const investors = await getCompanyInvestors(companyId)

  const existing_investors: ExistingInvestorRef[] = (investors ?? []).map((inv) => ({
    id: inv.id,
    full_name: inv.full_name,
    firm: inv.firm ?? undefined,
    title: inv.title ?? undefined,
    location: inv.location ?? undefined,
    industry: inv.industry ?? undefined,
  }))

  try {
    const { suggestGlobalInvestorsForCompany } = await import('@/lib/kyi-ecosystem')
    const suggested = await suggestGlobalInvestorsForCompany(companyId, 30)
    const suggestions: SuggestedInvestorRef[] = suggested
      .filter((g) => !g.associated_for_company)
      .map((g) => ({
        name: g.display_name,
        position: g.title ?? undefined,
        location: g.location ?? undefined,
        firm: g.firm ?? undefined,
        profile_url: g.profile_url ?? g.linkedin_url ?? undefined,
        score: g.match_score ?? g.tracked_by_org_count ?? 0,
        source: 'ecosystem',
        sources: ['kyi_ecosystem'],
        signals: (g.categories ?? []).map((c) => c.slug),
        reasons: g.match_reasons?.length
          ? g.match_reasons
          : [
              ...(g.categories ?? []).slice(0, 3).map((c) => c.label),
              ...(g.tracked_by_org_count && g.tracked_by_org_count > 0
                ? [
                    `Tracked by ${g.tracked_by_org_count} Katana ${
                      g.tracked_by_org_count === 1 ? 'company' : 'companies'
                    }`,
                  ]
                : []),
            ],
        related_investors: [],
      }))

    const firms: Record<string, SuggestedInvestorRef[]> = {}
    for (const s of suggestions) {
      const key = s.firm?.trim() || 'Independent'
      if (!firms[key]) firms[key] = []
      firms[key].push(s)
    }

    return {
      company_name: company.name,
      existing_investors,
      suggested_count: suggestions.length,
      multi_investor_count: 0,
      firms,
      suggestions,
    }
  } catch (err) {
    console.warn('[kyi-api] Ecosystem suggestions unavailable:', err)
    return {
      company_name: company.name,
      existing_investors,
      suggested_count: 0,
      multi_investor_count: 0,
      firms: {},
      suggestions: [],
    }
  }
}

// Investor overlap (Overlap View)
export interface InvestorOverlapConnection {
  name: string
  id?: number
  reasons?: string[]
}

export interface MultiInvestorSuggestion {
  label: string
  name?: string
  firm?: string
  position?: string
  location?: string
  score?: number
  connection_count: number
  connected_to: InvestorOverlapConnection[]
}

export interface InvestorOverlapResponse {
  investors: Array<{ id: number; label: string; name?: string; node_type?: string }>
  multi_investor_suggestions: MultiInvestorSuggestion[]
  matrix?: Record<string, number[]>
}

export async function getInvestorOverlap(companyId: number): Promise<InvestorOverlapResponse> {
  requireSupabase()
  const orgId = await getOrganizationId()

  const { data: investors, error } = await supabase
    .from('kyi_investors')
    .select('id, full_name, firm, global_investor_id')
    .eq('company_id', companyId)
    .eq('organization_id', orgId)

  if (error) {
    throw new Error(error.message || 'Failed to load investors for overlap')
  }

  const investorList = (investors ?? []).map((inv) => ({
    id: inv.id as number,
    label: inv.full_name as string,
    name: inv.full_name as string,
  }))

  const globalIds = (investors ?? [])
    .map((i) => i.global_investor_id as number | null)
    .filter((id): id is number => id != null)

  if (globalIds.length === 0) {
    return { investors: investorList, multi_investor_suggestions: [] }
  }

  try {
    const { data: links } = await supabase
      .from('kyi_global_investor_categories')
      .select('global_investor_id, category_id')
      .in('global_investor_id', globalIds)

    const catIds = [...new Set((links ?? []).map((l) => l.category_id as number))]
    if (catIds.length === 0) {
      return { investors: investorList, multi_investor_suggestions: [] }
    }

    const { data: cats } = await supabase
      .from('kyi_investor_category_defs')
      .select('id, label, slug')
      .in('id', catIds)

    const catLabel = new Map((cats ?? []).map((c) => [c.id as number, c.label as string]))
    const ourCatSet = new Set(catIds)
    const { data: peerLinks } = await supabase
      .from('kyi_global_investor_categories')
      .select('global_investor_id, category_id')
      .in('category_id', catIds)

    const ourGlobalSet = new Set(globalIds)
    const peerScore = new Map<number, Set<number>>()
    for (const link of peerLinks ?? []) {
      const gid = link.global_investor_id as number
      if (ourGlobalSet.has(gid)) continue
      const set = peerScore.get(gid) ?? new Set()
      if (ourCatSet.has(link.category_id as number)) set.add(link.category_id as number)
      peerScore.set(gid, set)
    }

    const topPeers = [...peerScore.entries()]
      .filter(([, catsShared]) => catsShared.size >= 1)
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 15)

    if (topPeers.length === 0) {
      return { investors: investorList, multi_investor_suggestions: [] }
    }

    const { data: peerRows } = await supabase
      .from('kyi_global_investors')
      .select('id, display_name, firm, title, location')
      .in(
        'id',
        topPeers.map(([id]) => id),
      )

    const peerMap = new Map((peerRows ?? []).map((p) => [p.id as number, p]))
    const multi_investor_suggestions: MultiInvestorSuggestion[] = []
    for (const [gid, shared] of topPeers) {
      const peer = peerMap.get(gid)
      if (!peer) continue
      const reasons = [...shared].map((cid) => catLabel.get(cid) ?? 'Shared focus').filter(Boolean)
      multi_investor_suggestions.push({
        label: peer.display_name as string,
        name: peer.display_name as string,
        firm: (peer.firm as string) || undefined,
        position: (peer.title as string) || undefined,
        location: (peer.location as string) || undefined,
        score: shared.size,
        connection_count: shared.size,
        connected_to: reasons.map((r) => ({ name: r, reasons: [r] })),
      })
    }

    return { investors: investorList, multi_investor_suggestions }
  } catch (err) {
    console.warn('[kyi-api] Overlap suggestions unavailable:', err)
    return { investors: investorList, multi_investor_suggestions: [] }
  }
}

// Geo targeting
export const GEO_LEVEL_TO_MILES: Record<string, number> = {
  national: 500,
  regional: 150,
  local: 50,
}

function normalizeGeoSegmentLevel(levelRaw: string | null | undefined): string {
  return (levelRaw ?? '').toLowerCase().trim()
}

function milesFromGeoSegmentLevel(level: string): number | null {
  if (!level) return null
  const miles = GEO_LEVEL_TO_MILES[level]
  return miles === undefined ? null : miles
}

/**
 * Prefer explicit radius from the form (slider); otherwise preset miles for the segment level.
 * Fixes `'' ?? miles` never falling through when `level && …` evaluated to `''` (investor geo had no level).
 */
function resolveGeoRadiusMiles(data: {
  radius_miles?: number | null
  geo_segment_level?: string | null
}): number {
  const explicit = data.radius_miles
  if (
    explicit != null &&
    typeof explicit === 'number' &&
    Number.isFinite(explicit) &&
    explicit > 0
  ) {
    return Math.round(explicit)
  }
  const level = normalizeGeoSegmentLevel(data.geo_segment_level)
  return milesFromGeoSegmentLevel(level) ?? 50
}

export interface GeoSettings {
  location_label: string
  center_lat: number
  center_lng: number
  radius_miles: number
  bbox_min_lat: number
  bbox_max_lat: number
  bbox_min_lng: number
  bbox_max_lng: number
  updated_at: string
  /** Preset from migration: national | regional | local */
  geo_segment_level?: string | null
}

export interface GeoSettingsResponse {
  configured: boolean
  client_id: number
  client_name: string
  message?: string
  settings?: GeoSettings
}

export async function getGeoSettings(clientId: number): Promise<GeoSettingsResponse> {
  requireSupabase()
  const orgId = await getOrganizationId()

  const [{ data: company, error: companyError }, { data: settingsRow, error: settingsError }] = await Promise.all([
    supabase
      .from('kyi_companies')
      .select('id, name')
      .eq('id', clientId)
      .eq('organization_id', orgId)
      .maybeSingle(),
    supabase
      .from('kyi_client_geo_settings')
      .select('*')
      .eq('client_id', clientId)
      .eq('organization_id', orgId)
      .maybeSingle(),
  ])

  if (companyError) {
    throw new Error(companyError.message || 'Failed to load KYI company')
  }

  const client_name = (company?.name as string) ?? ''

  if (settingsError && settingsError.code !== 'PGRST116') {
    throw new Error(settingsError.message || 'Failed to load geo settings')
  }

  if (!settingsRow) {
    return {
      configured: false,
      client_id: clientId,
      client_name,
      message: 'Geo targeting not configured.',
    }
  }

  const settings: GeoSettings = {
    location_label: settingsRow.location_label as string,
    center_lat: settingsRow.center_lat as number,
    center_lng: settingsRow.center_lng as number,
    radius_miles: settingsRow.radius_miles as number,
    bbox_min_lat: settingsRow.bbox_min_lat as number,
    bbox_max_lat: settingsRow.bbox_max_lat as number,
    bbox_min_lng: settingsRow.bbox_min_lng as number,
    bbox_max_lng: settingsRow.bbox_max_lng as number,
    updated_at: (settingsRow.updated_at as string) ?? new Date().toISOString(),
    geo_segment_level: (settingsRow.geo_segment_level as string | null) ?? 'local',
  }

  return {
    configured: true,
    client_id: clientId,
    client_name,
    settings,
  }
}

export async function updateGeoSettings(
  clientId: number,
  data: { location_label: string; radius_miles?: number; geo_segment_level?: string },
): Promise<{
  success: boolean
  settings: GeoSettings
}> {
  requireSupabase()

  const locationLabel = data.location_label.trim()
  if (!locationLabel) {
    throw new Error('Location is required')
  }

  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()

  const level = normalizeGeoSegmentLevel(data.geo_segment_level)
  const radius = resolveGeoRadiusMiles(data)
  const geo_segment_level = level || 'local'

  const coords = await geocodeAddressOrLabel(locationLabel)
  if (!coords) {
    throw new Error('Could not geocode location. Try a different city/state or address.')
  }

  const center_lat = coords.lat
  const center_lng = coords.lng

  const latDelta = radius / 69 // ~69 miles per degree latitude
  const cosLat = Math.cos(toRadians(center_lat))
  const lngDenom = Math.max(1e-6, Math.abs(cosLat) * 69)
  const lngDelta = radius / lngDenom

  const bbox_min_lat = center_lat - latDelta
  const bbox_max_lat = center_lat + latDelta
  const bbox_min_lng = center_lng - lngDelta
  const bbox_max_lng = center_lng + lngDelta

  const now = new Date().toISOString()

  const upsertRow: Record<string, unknown> = {
    client_id: clientId,
    user_id: userId,
    organization_id: orgId,
    location_label: locationLabel,
    center_lat,
    center_lng,
    radius_miles: radius,
    bbox_min_lat,
    bbox_max_lat,
    bbox_min_lng,
    bbox_max_lng,
    updated_at: now,
    geo_segment_level,
  }

  const { data: row, error } = await supabase
    .from('kyi_client_geo_settings')
    .upsert(upsertRow, { onConflict: 'client_id' })
    .select('*')
    .single()

  if (error || !row) {
    throw new Error(error?.message || 'Failed to save geo settings')
  }

  const settings: GeoSettings = {
    location_label: locationLabel,
    center_lat,
    center_lng,
    radius_miles: radius,
    bbox_min_lat,
    bbox_max_lat,
    bbox_min_lng,
    bbox_max_lng,
    updated_at: now,
    geo_segment_level: (row.geo_segment_level as string) ?? geo_segment_level,
  }

  return { success: true, settings }
}

// Per-investor geo settings
export async function getInvestorGeoSettings(investorId: number): Promise<GeoSettingsResponse> {
  requireSupabase()
  const orgId = await getOrganizationId()

  const { data: settingsRow, error } = await supabase
    .from('kyi_investor_geo_settings')
    .select('*')
    .eq('investor_id', investorId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message || 'Failed to load investor geo settings')
  }

  if (!settingsRow) {
    return {
      configured: false,
      client_id: investorId,
      client_name: '',
      message: 'Geo targeting not configured for this investor.',
    }
  }

  return {
    configured: true,
    client_id: investorId,
    client_name: '',
    settings: {
      location_label: settingsRow.location_label as string,
      center_lat: settingsRow.center_lat as number,
      center_lng: settingsRow.center_lng as number,
      radius_miles: settingsRow.radius_miles as number,
      bbox_min_lat: settingsRow.bbox_min_lat as number,
      bbox_max_lat: settingsRow.bbox_max_lat as number,
      bbox_min_lng: settingsRow.bbox_min_lng as number,
      bbox_max_lng: settingsRow.bbox_max_lng as number,
      updated_at: (settingsRow.updated_at as string) ?? new Date().toISOString(),
      geo_segment_level: (settingsRow.geo_segment_level as string | null) ?? 'local',
    },
  }
}

export async function updateInvestorGeoSettings(
  investorId: number,
  data: { location_label: string; radius_miles?: number; geo_segment_level?: string },
): Promise<{ success: boolean; settings: GeoSettings }> {
  requireSupabase()

  const locationLabel = data.location_label.trim()
  if (!locationLabel) throw new Error('Location is required')

  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()

  const level = normalizeGeoSegmentLevel(data.geo_segment_level)
  const radius = resolveGeoRadiusMiles(data)
  const geo_segment_level = level || 'local'
  const coords = await geocodeAddressOrLabel(locationLabel)
  if (!coords) throw new Error('Could not geocode location. Try a different city/state or address.')

  const center_lat = coords.lat
  const center_lng = coords.lng
  const latDelta = radius / 69
  const cosLat = Math.cos(toRadians(center_lat))
  const lngDenom = Math.max(1e-6, Math.abs(cosLat) * 69)
  const lngDelta = radius / lngDenom
  const now = new Date().toISOString()

  const { data: row, error } = await supabase
    .from('kyi_investor_geo_settings')
    .upsert(
      {
        investor_id: investorId,
        user_id: userId,
        organization_id: orgId,
        location_label: locationLabel,
        center_lat,
        center_lng,
        radius_miles: radius,
        bbox_min_lat: center_lat - latDelta,
        bbox_max_lat: center_lat + latDelta,
        bbox_min_lng: center_lng - lngDelta,
        bbox_max_lng: center_lng + lngDelta,
        updated_at: now,
        geo_segment_level,
      },
      { onConflict: 'investor_id' },
    )
    .select('*')
    .single()

  if (error) throw new Error(error.message || 'Failed to save investor geo settings')

  return {
    success: true,
    settings: {
      location_label: locationLabel,
      center_lat,
      center_lng,
      radius_miles: radius,
      bbox_min_lat: center_lat - latDelta,
      bbox_max_lat: center_lat + latDelta,
      bbox_min_lng: center_lng - lngDelta,
      bbox_max_lng: center_lng + lngDelta,
      updated_at: now,
      geo_segment_level: (row?.geo_segment_level as string | null) ?? geo_segment_level,
    },
  }
}

// Leads (localized leads)
export interface KYILead {
  id: number
  client_id: number
  entity_type: 'person' | 'firm'
  display_name: string
  city: string | null
  state: string | null
  zip_code: string | null
  lat: number | null
  lng: number | null
  raw_score: number
  /** 0–100 fit meter for UI (derived from raw_score). */
  fit_percent: number
  investor_type_id?: number | null
  tags?: string[]
  metadata?: Record<string, unknown>
  signals?: {
    // Investor ownership & activity
    sec_13f?: boolean
    sec_form_d?: boolean
    sec_13d?: boolean
    sec_13g?: boolean
    sec_form4?: boolean
    sec_form3?: boolean
    sec_form5?: boolean
    // Company disclosures
    sec_10k?: boolean
    sec_10q?: boolean
    sec_8k?: boolean
    sec_def14a?: boolean
    sec_20f?: boolean
    sec_6k?: boolean
    // Capital formation & M&A
    sec_s1?: boolean
    sec_s3?: boolean
    sec_s4?: boolean
    sec_f1?: boolean
    sec_schedule_to?: boolean
    // Enforcement & structure
    sec_enforcement?: boolean
    sec_subsidiary?: boolean
    sec_adv?: boolean
    // External sources
    fec_donor?: boolean
    finra_brokercheck?: boolean
    uspto_patent?: boolean
    opencorporates?: boolean
    companies_house?: boolean
    lobbying_disclosure?: boolean
    press_release?: boolean
    news_sentiment?: boolean
    sedar?: boolean
    business_registry?: boolean
    [key: string]: unknown
  }
  sources?: Array<{
    source_name: string
    url?: string
    date_observed?: string
    confidence?: number
    [key: string]: unknown
  }>
}

export interface LeadsListResponse {
  client_id: number
  total_count: number
  filtered_count: number
  displayed_count: number
  needs_geocoding_count: number
  thinning_mode: string
  leads: KYILead[]
}

export interface KyiDataCategory {
  id: number
  name: string
  slug: string
  organization_id: string
}

export async function getKyiDataCategories(organizationId: string): Promise<KyiDataCategory[]> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const scopedOrg = organizationId || orgId
  const { data, error } = await supabase
    .from('kyi_data_categories')
    .select('id, name, slug, organization_id')
    .eq('organization_id', scopedOrg)
    .order('name', { ascending: true })
  if (error) {
    throw new Error(error.message || 'Failed to load KYI data categories')
  }
  return (data as Record<string, unknown>[] ?? []).map((r) => ({
    id: r.id as number,
    name: r.name as string,
    slug: r.slug as string,
    organization_id: r.organization_id as string,
  }))
}

export async function createKyiDataCategory(
  organizationId: string,
  name: string,
  slug: string,
): Promise<KyiDataCategory | null> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const scopedOrg = organizationId || orgId
  const s = slug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  if (!name.trim() || !s) return null
  const { data, error } = await supabase
    .from('kyi_data_categories')
    .insert({ organization_id: scopedOrg, name: name.trim(), slug: s })
    .select('id, name, slug, organization_id')
    .single()
  if (error || !data) {
    throw new Error(error?.message || 'Failed to create KYI data category')
  }
  const r = data as Record<string, unknown>
  return {
    id: r.id as number,
    name: r.name as string,
    slug: r.slug as string,
    organization_id: r.organization_id as string,
  }
}

/** Lead row is missing coordinates but has enough location text to geocode */
export function leadNeedsGeocoding(l: Pick<KYILead, 'lat' | 'lng' | 'city' | 'state' | 'zip_code'>): boolean {
  const hasHint =
    !!(l.city && String(l.city).trim()) ||
    !!(l.state && String(l.state).trim()) ||
    !!(l.zip_code && String(l.zip_code).trim())
  if (!hasHint) return false
  if (l.lat == null || l.lng == null) return true
  if (l.state && String(l.state).trim() && !leadCoordinatesMatchState(l)) return true
  return false
}

/** One note row per (investor, lead); see supabase-kyi-lead-notes.sql */
export interface KYILeadNote {
  id: number
  lead_id: number
  investor_id: number
  body: string
  created_at: string
  updated_at: string
}

function mapLeadNoteRow(row: Record<string, unknown>): KYILeadNote {
  return {
    id: row.id as number,
    lead_id: row.lead_id as number,
    investor_id: row.investor_id as number,
    body: (row.body as string) ?? '',
    created_at: (row.created_at as string) ?? '',
    updated_at: (row.updated_at as string) ?? '',
  }
}

/** Load the note for this investor + lead, or null if none / table missing. */
export async function getLeadNoteForPair(investorId: number, leadId: number): Promise<KYILeadNote | null> {
  requireSupabase()
  await assertInvestorInOrg(investorId)
  const { data, error } = await supabase
    .from('kyi_lead_notes')
    .select('id, lead_id, investor_id, body, created_at, updated_at')
    .eq('investor_id', investorId)
    .eq('lead_id', leadId)
    .maybeSingle()
  if (error) {
    if (error.code === 'PGRST116' || error.message?.includes('does not exist') || error.code === '42P01') {
      return null
    }
    throw new Error(error.message || 'Failed to load lead note')
  }
  if (!data) return null
  return mapLeadNoteRow(data as Record<string, unknown>)
}

/** Create or replace the note body for this investor + lead. */
export async function upsertLeadNote(investorId: number, leadId: number, body: string): Promise<KYILeadNote> {
  requireSupabase()
  await assertInvestorInOrg(investorId)
  const trimmed = body.trim()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('kyi_lead_notes')
    .upsert(
      {
        lead_id: leadId,
        investor_id: investorId,
        body: trimmed,
        updated_at: now,
      },
      { onConflict: 'lead_id,investor_id' },
    )
    .select('id, lead_id, investor_id, body, created_at, updated_at')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to save lead note')
  }
  return mapLeadNoteRow(data as Record<string, unknown>)
}

function levenshtein(a: string, b: string): number {
  const s = a.trim().toLowerCase()
  const t = b.trim().toLowerCase()
  const m = s.length
  const n = t.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

function applyFuzzyLeadDedupe(leads: KYILead[]): KYILead[] {
  const sorted = [...leads].sort((x, y) => y.raw_score - x.raw_score)
  const out: KYILead[] = []
  const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase()
  for (const l of sorted) {
    const isDup = out.some(
      (o) =>
        norm(o.city) === norm(l.city) &&
        norm(o.state) === norm(l.state) &&
        levenshtein(norm(o.display_name), norm(l.display_name)) <= 1,
    )
    if (!isDup) out.push(l)
  }
  return out
}

export async function getLeads(
  clientId: number,
  opts?: {
    thinning?: string
    min_score?: number | null
    dataCategorySlug?: string | null
    fuzzyDedup?: boolean
    sectorRelevantOnly?: boolean
    filterPresets?: KyiLeadFilterPresetId[]
  },
): Promise<LeadsListResponse> {
  requireSupabase()

  const thinningMode = opts?.thinning || 'top_10_percent'
  const minScore = typeof opts?.min_score === 'number' ? opts.min_score : null
  const categorySlug = (opts?.dataCategorySlug ?? '').trim().toLowerCase()
  const raiseContext = await loadCompanyRaiseContext(clientId)

  // Org-owned leads + null-org platform catalog; geo filters to company markets
  let leadsRaw = await fetchAllLeads()

  // Deduplicate leads by normalized name + city + state (keep highest score)
  const dedupMap = new Map<string, Record<string, unknown>>()
  for (const row of leadsRaw) {
    const name = ((row.display_name as string) ?? '').trim().toLowerCase()
    const city = ((row.city as string | null) ?? '').trim().toLowerCase()
    const state = ((row.state as string | null) ?? '').trim().toLowerCase()
    const key = `${name}|${city}|${state}`
    const existing = dedupMap.get(key)
    const existingScore = existing
      ? computeLeadScore(existing.signals as KYILead['signals'], leadScoreOptsFromRow(existing, raiseContext))
      : -1
    const rowScore = computeLeadScore(row.signals as KYILead['signals'], leadScoreOptsFromRow(row, raiseContext))
    if (!existing || rowScore > existingScore) dedupMap.set(key, mergeLeadRows(row, existing ?? {}))
    else dedupMap.set(key, mergeLeadRows(existing, row))
  }

  let leads: KYILead[] = [...dedupMap.values()].map((row) => mapLeadRow(row, raiseContext))

  if (opts?.filterPresets?.length) {
    leads = leads.filter((l) => leadMatchesFilterPresets(l, opts.filterPresets!))
  }

  if (opts?.sectorRelevantOnly && raiseContext) {
    leads = leads.filter((l) => leadMatchesSector(l, raiseContext))
  }

  if (categorySlug) {
    leads = leads.filter((l) => {
      const tags = (l.tags ?? []).map((t) => t.toLowerCase())
      if (tags.includes(categorySlug)) return true
      const slug =
        (l.metadata?.data_category_slug as string | undefined) ||
        (l.metadata?.category_slug as string | undefined)
      return (slug ?? '').toLowerCase() === categorySlug
    })
  }

  if (opts?.fuzzyDedup) {
    leads = applyFuzzyLeadDedupe(leads)
  }

  const total_count = leads.length
  const needs_geocoding_count = leads.filter((l) => leadNeedsGeocoding(l)).length

  const geoCircles = await loadGeoCirclesForCompany(clientId)
  let geoFiltered: KYILead[]
  if (geoCircles.length > 0) {
    geoFiltered = leads.filter((l) => leadInGeoTargetingArea(l, geoCircles))
  } else {
    // Geo not configured — do not show the entire national pool as localized leads
    geoFiltered = []
  }

  // Apply min_score
  let scored = geoFiltered
  if (minScore != null) {
    scored = scored.filter((l) => l.raw_score >= minScore)
  }

  // Sort by score desc
  scored = [...scored].sort((a, b) => b.raw_score - a.raw_score)

  // Thinning
  let displayed = scored
  if (thinningMode !== 'all') {
    const total = scored.length
    let percentCount = total
    if (thinningMode === 'top_10_percent') {
      percentCount = Math.max(1, Math.floor(total * 0.1))
    } else if (thinningMode === 'top_25_percent') {
      percentCount = Math.max(1, Math.floor(total * 0.25))
    } else if (thinningMode === 'top_50_percent') {
      percentCount = Math.max(1, Math.floor(total * 0.5))
    }
    const minimumCount = 50
    const cutoff = Math.max(percentCount, minimumCount)
    displayed = scored.slice(0, cutoff)
  }

  return {
    client_id: clientId,
    total_count,
    filtered_count: scored.length,
    displayed_count: displayed.length,
    needs_geocoding_count,
    thinning_mode: thinningMode,
    leads: displayed,
  }
}

export async function getLeadsForInvestor(
  investorId: number,
  opts?: { thinning?: string; min_score?: number | null },
): Promise<LeadsListResponse> {
  requireSupabase()
  const { orgId } = await assertInvestorInOrg(investorId)

  const thinningMode = opts?.thinning || 'top_10_percent'
  const minScore = typeof opts?.min_score === 'number' ? opts.min_score : null

  const leadsRaw = await fetchAllLeads()

  // Deduplicate leads by normalized name + city + state
  const dedupMap2 = new Map<string, Record<string, unknown>>()
  for (const row of leadsRaw) {
    const name = ((row.display_name as string) ?? '').trim().toLowerCase()
    const city = ((row.city as string | null) ?? '').trim().toLowerCase()
    const state = ((row.state as string | null) ?? '').trim().toLowerCase()
    const key = `${name}|${city}|${state}`
    const existing = dedupMap2.get(key)
    if (!existing || ((row.raw_score as number) ?? 0) > ((existing.raw_score as number) ?? 0)) {
      dedupMap2.set(key, mergeLeadRows(row, existing ?? {}))
    } else {
      dedupMap2.set(key, mergeLeadRows(existing, row))
    }
  }

  const leads: KYILead[] = [...dedupMap2.values()].map((row) => mapLeadRow(row))

  const total_count = leads.length
  const needs_geocoding_count = leads.filter((l) => leadNeedsGeocoding(l)).length

  let geoFiltered = leads
  const { data: geoRow, error: geoError } = await supabase
    .from('kyi_investor_geo_settings')
    .select('*')
    .eq('investor_id', investorId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (geoError && geoError.code !== 'PGRST116') {
    // eslint-disable-next-line no-console
    console.warn('Failed to load investor geo settings for leads:', geoError)
  }

  if (geoRow) {
    const centerLat = geoRow.center_lat as number
    const centerLng = geoRow.center_lng as number
    const radius = (geoRow.radius_miles as number) ?? 50
    geoFiltered = leads.filter(
      (l) => l.lat != null && l.lng != null && distanceMiles(l.lat, l.lng, centerLat, centerLng) <= radius,
    )
  }

  let scored = geoFiltered
  if (minScore != null) scored = scored.filter((l) => l.raw_score >= minScore)
  scored = [...scored].sort((a, b) => b.raw_score - a.raw_score)

  let displayed = scored
  if (thinningMode !== 'all') {
    const total = scored.length
    let percentCount = total
    if (thinningMode === 'top_10_percent') percentCount = Math.max(1, Math.floor(total * 0.1))
    else if (thinningMode === 'top_25_percent') percentCount = Math.max(1, Math.floor(total * 0.25))
    else if (thinningMode === 'top_50_percent') percentCount = Math.max(1, Math.floor(total * 0.5))
    displayed = scored.slice(0, Math.max(percentCount, 50))
  }

  return {
    client_id: investorId,
    total_count,
    filtered_count: scored.length,
    displayed_count: displayed.length,
    needs_geocoding_count,
    thinning_mode: thinningMode,
    leads: displayed,
  }
}

export interface LeadsByTypeGroup {
  type_id: number
  type_name: string
  count: number
  leads: KYILead[]
}

export async function getLeadsByInvestorType(
  investorId: number,
  typeId: number,
): Promise<{ leads: KYILead[]; count: number }> {
  requireSupabase()
  const { orgId } = await assertInvestorInOrg(investorId)

  let leadsRaw = await fetchAllLeads()

  const leads: KYILead[] = leadsRaw
    .filter((row) => (row.investor_type_id as number | null) === typeId)
    .map((row) => mapLeadRow(row))

  const { data: geoRow } = await supabase
    .from('kyi_investor_geo_settings')
    .select('*')
    .eq('investor_id', investorId)
    .eq('organization_id', orgId)
    .maybeSingle()

  let filtered = leads
  if (geoRow) {
    const centerLat = geoRow.center_lat as number
    const centerLng = geoRow.center_lng as number
    const radius = (geoRow.radius_miles as number) ?? 50
    filtered = leads.filter(
      (l) => l.lat != null && l.lng != null && distanceMiles(l.lat!, l.lng!, centerLat, centerLng) <= radius,
    )
  }

  filtered.sort((a, b) => b.raw_score - a.raw_score)

  return { leads: filtered, count: filtered.length }
}

export async function getLeadsCountByType(
  investorId: number,
): Promise<{ type_id: number; count: number }[]> {
  requireSupabase()
  const { orgId } = await assertInvestorInOrg(investorId)

  const leadsRaw = await fetchAllLeads()

  const { data: geoRow } = await supabase
    .from('kyi_investor_geo_settings')
    .select('*')
    .eq('investor_id', investorId)
    .eq('organization_id', orgId)
    .maybeSingle()

  let filtered = leadsRaw
  if (geoRow) {
    const centerLat = geoRow.center_lat as number
    const centerLng = geoRow.center_lng as number
    const radius = (geoRow.radius_miles as number) ?? 50
    filtered = leadsRaw.filter((row) => {
      const lat = row.lat as number | null
      const lng = row.lng as number | null
      return lat != null && lng != null && distanceMiles(lat, lng, centerLat, centerLng) <= radius
    })
  }

  const counts = new Map<number, number>()
  for (const row of filtered) {
    const tid = row.investor_type_id as number | null
    if (tid != null) counts.set(tid, (counts.get(tid) ?? 0) + 1)
  }

  return Array.from(counts.entries()).map(([type_id, count]) => ({ type_id, count }))
}

export async function triggerRefreshNow(): Promise<{ success: boolean; message?: string }> {
  requireSupabase()

  return {
    success: true,
    message:
      'In-app refresh does not run the import pipeline. Use `npm run kyi:refresh` (or your hosted job) to fetch and import new leads into Supabase, then reload this page.',
  }
}

// Prevent multiple geocode runs at once (e.g. double-click or Strict Mode)
let geocodeRunInProgress = false

/** UI reads this: processed = attempted, updated = saved; geocoded = Open-Meteo returned coords */
export const kyiGeocodeProgress = { processed: 0, updated: 0, geocoded: 0, batchSize: 0, done: false }

const GEOCODE_PAGE_SIZE = 500
const GEOCODE_DELAY_MS = 80

function leadRowForGeocodeCheck(row: Record<string, unknown>): Pick<KYILead, 'lat' | 'lng' | 'city' | 'state' | 'zip_code'> {
  return {
    city: (row.city as string | null) ?? null,
    state: (row.state as string | null) ?? null,
    zip_code: (row.zip_code as string | null) ?? null,
    lat: (row.lat as number | null) ?? null,
    lng: (row.lng as number | null) ?? null,
  }
}

async function countLeadsNeedingGeocode(): Promise<number> {
  const orgId = await getOrganizationId()
  let count = 0
  let lastId = 0
  while (true) {
    // Only org-owned leads (never mutate null-org platform catalog)
    const { data: batch, error } = await supabase
      .from('kyi_investor_leads')
      .select('id, city, state, zip_code, lat, lng')
      .eq('organization_id', orgId)
      .gt('id', lastId)
      .or('city.not.is.null,state.not.is.null,zip_code.not.is.null')
      .order('id', { ascending: true })
      .limit(GEOCODE_PAGE_SIZE)
    if (error) throw new Error(error.message || 'Failed to count leads needing geocode')
    if (!batch || batch.length === 0) break
    for (const row of batch) {
      if (leadNeedsGeocoding(leadRowForGeocodeCheck(row as Record<string, unknown>))) count += 1
    }
    lastId = batch[batch.length - 1].id as number
    if (batch.length < GEOCODE_PAGE_SIZE) break
  }
  return count
}

export async function triggerGeocodeNow(clientId: number): Promise<{ success: boolean; message?: string }> {
  requireSupabase()
  const orgId = await getOrganizationId()
  void clientId

  if (geocodeRunInProgress) {
    return {
      success: false,
      message: 'A geocode run is already in progress. Wait for it to finish.',
    }
  }

  geocodeRunInProgress = true

  // Count total needing geocode (missing coords OR coords inconsistent with stated state)
  let totalLeads = 0
  try {
    totalLeads = await countLeadsNeedingGeocode()
  } catch (e) {
    geocodeRunInProgress = false
    throw e instanceof Error ? e : new Error('Failed to count leads needing geocode')
  }

  kyiGeocodeProgress.processed = 0
  kyiGeocodeProgress.updated = 0
  kyiGeocodeProgress.geocoded = 0
  kyiGeocodeProgress.batchSize = totalLeads
  kyiGeocodeProgress.done = false

  const emit = (processed: number, updated: number, geocoded: number, batchSize: number, done: boolean, failed = 0, unresolvable = 0) => {
    kyiGeocodeProgress.processed = processed
    kyiGeocodeProgress.updated = updated
    kyiGeocodeProgress.geocoded = geocoded
    try {
      window.dispatchEvent(new CustomEvent('kyi-geocode-tick', { detail: { processed, updated, geocoded, batchSize, done, failed, unresolvable } }))
    } catch {
      /* noop */
    }
  }

  ;(async () => {
    let totalProcessed = 0
    let totalUpdated = 0
    let totalGeocoded = 0
    let totalFailed = 0
    let totalUnresolvable = 0
    const failedIds = new Set<number>()
    const missedCities: string[] = []

    try {
      if (totalLeads === 0) {
        kyiGeocodeProgress.done = true
        emit(0, 0, 0, 0, true)
        return
      }

      let lastId = 0
      while (true) {
        const { data: batch, error } = await supabase
          .from('kyi_investor_leads')
          .select('id, client_id, city, state, zip_code, lat, lng')
          .eq('organization_id', orgId)
          .gt('id', lastId)
          .or('city.not.is.null,state.not.is.null,zip_code.not.is.null')
          .order('id', { ascending: true })
          .limit(GEOCODE_PAGE_SIZE)

        if (error || !batch || batch.length === 0) {
          if (error) console.error('Failed to load leads needing geocoding:', error)
          break
        }

        lastId = batch[batch.length - 1].id as number

        const newBatch = batch.filter(
          (r) =>
            !failedIds.has(r.id as number) &&
            leadNeedsGeocoding(leadRowForGeocodeCheck(r as Record<string, unknown>)),
        )

        for (const row of newBatch) {
          const city = (row.city as string | null) ?? null
          const state = (row.state as string | null) ?? null
          const zip = (row.zip_code as string | null) ?? null
          if (!city?.trim() && !state?.trim() && !zip?.trim()) {
            console.warn(`Geocode skip: no city/state/zip for lead ${row.id}`)
            failedIds.add(row.id as number)
            totalProcessed += 1
            totalUnresolvable += 1
            emit(totalProcessed, totalUpdated, totalGeocoded, totalLeads, false, totalFailed, totalUnresolvable)
            continue
          }

          // 1. Try city+state (state-aware — avoids pinning to the wrong homonym city)
          let result = await geocodeCityState(city, state)
          // 2. Fallback: ZIP code
          if (!result && zip?.trim()) {
            result = await geocodeLocationLabel(zip.trim(), 'US')
          }

          if (
            result &&
            state?.trim() &&
            !leadCoordinatesMatchState({ lat: result.lat, lng: result.lng, state })
          ) {
            result = null
          }

          if (!result) {
            const desc = `city=${JSON.stringify(city)}, state=${JSON.stringify(state)}, zip=${JSON.stringify(zip)}`
            console.warn(`Geocode miss: lead ${row.id} - ${desc}`)
            missedCities.push(desc)
            failedIds.add(row.id as number)
            totalProcessed += 1
            totalUnresolvable += 1
            emit(totalProcessed, totalUpdated, totalGeocoded, totalLeads, false, totalFailed, totalUnresolvable)
            await new Promise((r) => setTimeout(r, GEOCODE_DELAY_MS))
            continue
          }

          totalGeocoded += 1
          const { error: updateError } = await supabase
            .from('kyi_investor_leads')
            .update({ lat: result.lat, lng: result.lng, updated_at: new Date().toISOString() })
            .eq('id', row.id)
            .eq('organization_id', orgId)

          totalProcessed += 1
          if (updateError) {
            totalFailed += 1
            console.warn('Geocode update failed for lead', row.id, updateError.message)
          } else {
            totalUpdated += 1
          }
          emit(totalProcessed, totalUpdated, totalGeocoded, totalLeads, false, totalFailed, totalUnresolvable)
          await new Promise((r) => setTimeout(r, GEOCODE_DELAY_MS))
        }

        if (batch.length < GEOCODE_PAGE_SIZE) break
      }

      if (missedCities.length > 0) {
        console.warn(`Geocode: ${missedCities.length} leads could not be resolved. Values:`)
        missedCities.forEach((v, i) => console.warn(`  [${i + 1}] ${v}`))
      }

      kyiGeocodeProgress.done = true
      emit(totalProcessed, totalUpdated, totalGeocoded, totalLeads, true, totalFailed, totalUnresolvable)
      if (totalGeocoded === 0 && totalProcessed > 0) {
        console.warn('KYI geocode: Open-Meteo returned no results for any leads. Check city/state data quality.')
      } else if (totalUpdated === 0 && totalGeocoded > 0) {
        console.warn('KYI geocode: coords returned but all Supabase updates failed. Check RLS on kyi_investor_leads.')
      }
      if (totalUpdated > 0 || totalFailed > 0) {
        console.log(`Geocode complete: ${totalGeocoded} geocoded, ${totalUpdated} saved, ${totalFailed} failed (of ${totalProcessed}).`)
      }
    } catch (e) {
      console.error('Error during KYI client-side geocoding:', e)
      kyiGeocodeProgress.done = true
    } finally {
      geocodeRunInProgress = false
    }
  })()

  return {
    success: true,
    message: `Geocoding ${totalLeads} leads. Progress updates in real time.`,
  }
}

// Access Map (orbit / solar network)
export interface AccessMapNode {
  id: number
  company_id: number
  node_type: 'investor' | 'person' | 'org'
  label: string
  meta_json?: string
  meta?: Record<string, unknown>
}

export interface AccessMapEdge {
  id?: number
  from_node_id: number
  to_node_id: number
  edge_type: string
  weight: number
}

export interface AccessMapOverlap {
  unique_people_count: number
  unique_org_count: number
  overlap_people_count: number
  overlap_org_count: number
  overlap_percentage: number
  top_overlapping_people: Array<{ label: string; count: number }>
  top_overlapping_orgs: Array<{ label: string; count: number }>
}

export interface AccessMapResponse {
  nodes: AccessMapNode[]
  edges: AccessMapEdge[]
  metrics: {
    node_count?: number
    edge_count?: number
    investor_count?: number
    person_count?: number
    org_count?: number
    /** Share of possible investor–investor edges that exist (0–1). */
    graph_density?: number
  }
  overlap: AccessMapOverlap
}

export async function getAccessMap(companyId: number): Promise<AccessMapResponse> {
  requireSupabase()
  const orgId = await assertCompanyInOrg(companyId)

  // Supabase-native access map: investors + entities + leads as nodes; build edges from shared firms/locations.
  const { data: invRows, error: invErr } = await supabase
    .from('kyi_investors')
    .select('id, full_name, firm, location, industry')
    .eq('company_id', companyId)
    .eq('organization_id', orgId)

  if (invErr) console.warn('getAccessMap: investors', invErr.message)

  // kyi_entities may not exist yet; treat missing table as empty
  let entRows: Record<string, unknown>[] = []
  try {
    const { data, error } = await supabase
      .from('kyi_entities')
      .select('id, entity_type, display_name')
      .eq('client_id', companyId)
    if (!error && data) entRows = data as Record<string, unknown>[]
    else if (error && error.code !== '42P01' && !error.message?.includes('does not exist'))
      console.warn('getAccessMap: entities', error.message)
  } catch { /* table may not exist */ }

  const investors = invRows ?? []

  const ENTITY_NODE_ID_OFFSET = 10_000_000

  const investorNodes: AccessMapNode[] = investors.map((row) => ({
    id: row.id as number,
    company_id: companyId,
    node_type: 'investor',
    label: (row.full_name as string) ?? 'Investor',
    meta_json: JSON.stringify({ firm: (row.firm as string | null) ?? undefined }),
  }))

  const entityNodes: AccessMapNode[] = entRows.map((row) => {
    const et = (row.entity_type as string) ?? 'person'
    const nodeType: AccessMapNode['node_type'] =
      et === 'firm' || et === 'org' ? 'org' : 'person'
    return {
      id: ENTITY_NODE_ID_OFFSET + (row.id as number),
      company_id: companyId,
      node_type: nodeType,
      label: (row.display_name as string) ?? 'Entity',
    }
  })

  // Build edges from shared firms among investors
  const edges: AccessMapEdge[] = []
  const firmGroups = new Map<string, number[]>()
  for (const inv of investors) {
    const firm = ((inv.firm as string | null) ?? '').trim().toLowerCase()
    if (firm) {
      const ids = firmGroups.get(firm) ?? []
      ids.push(inv.id as number)
      firmGroups.set(firm, ids)
    }
  }
  let edgeId = 1
  for (const ids of firmGroups.values()) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        edges.push({ id: edgeId++, from_node_id: ids[i], to_node_id: ids[j], edge_type: 'shared_firm', weight: 1 })
      }
    }
  }

  // Also build edges from shared locations
  const locGroups = new Map<string, number[]>()
  for (const inv of investors) {
    const loc = ((inv.location as string | null) ?? '').trim().toLowerCase()
    if (loc) {
      const ids = locGroups.get(loc) ?? []
      ids.push(inv.id as number)
      locGroups.set(loc, ids)
    }
  }
  for (const ids of locGroups.values()) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (!edges.some(e => (e.from_node_id === ids[i] && e.to_node_id === ids[j]) || (e.from_node_id === ids[j] && e.to_node_id === ids[i]))) {
          edges.push({ id: edgeId++, from_node_id: ids[i], to_node_id: ids[j], edge_type: 'shared_location', weight: 1 })
        }
      }
    }
  }

  const nodes = [...investorNodes, ...entityNodes]
  const personEntities = entRows.filter((e) => {
    const t = ((e.entity_type as string) ?? 'person').toLowerCase()
    return t === 'person' || t === 'unknown'
  })
  const orgEntities = entRows.filter((e) => {
    const t = ((e.entity_type as string) ?? '').toLowerCase()
    return t === 'firm' || t === 'org'
  })

  // Extract unique firms from investors as implicit org nodes
  const uniqueFirms = new Set<string>()
  for (const inv of investors) {
    const firm = ((inv.firm as string | null) ?? '').trim()
    if (firm) uniqueFirms.add(firm)
  }

  const uniquePeople = personEntities.length + investors.length
  const uniqueOrgs = orgEntities.length + uniqueFirms.size

  // Compute overlap: investors that share firms or locations
  const connectedInvestors = new Set<number>()
  for (const edge of edges) connectedInvestors.add(edge.from_node_id).add(edge.to_node_id)
  const overlapPeopleCount = connectedInvestors.size
  const overlapPct = uniquePeople > 0 ? Math.round((overlapPeopleCount / uniquePeople) * 100) : 0

  // Top overlapping firms (orgs with most investors)
  const topFirms = [...firmGroups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .map(([firm, ids]) => ({ label: firm, count: ids.length }))

  // Top overlapping people: investors appearing in multi-investor firms
  const topPeople: { label: string; count: number }[] = []
  const investorNameMap = new Map(investors.map((inv) => [inv.id as number, (inv.full_name as string) ?? 'Investor']))
  const investorConnectionCounts = new Map<number, number>()
  for (const edge of edges) {
    investorConnectionCounts.set(edge.from_node_id, (investorConnectionCounts.get(edge.from_node_id) ?? 0) + 1)
    investorConnectionCounts.set(edge.to_node_id, (investorConnectionCounts.get(edge.to_node_id) ?? 0) + 1)
  }
  const sortedConnected = [...investorConnectionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  for (const [invId, count] of sortedConnected) {
    const name = investorNameMap.get(invId)
    if (name) topPeople.push({ label: name, count })
  }

  // Ensure node_count always reflects investors even when kyi_entities is empty
  const effectiveNodeCount = nodes.length > 0 ? nodes.length : investors.length
  const nInv = investors.length
  const maxInvEdges = nInv > 1 ? (nInv * (nInv - 1)) / 2 : 0
  const graph_density = maxInvEdges > 0 ? Math.round((edges.length / maxInvEdges) * 1000) / 1000 : 0

  return {
    nodes,
    edges,
    metrics: {
      node_count: effectiveNodeCount,
      edge_count: edges.length,
      investor_count: investors.length,
      person_count: uniquePeople,
      org_count: uniqueOrgs,
      graph_density,
    },
    overlap: {
      unique_people_count: uniquePeople,
      unique_org_count: uniqueOrgs,
      overlap_people_count: overlapPeopleCount,
      overlap_org_count: topFirms.length,
      overlap_percentage: overlapPct,
      top_overlapping_people: topPeople,
      top_overlapping_orgs: topFirms,
    },
  }
}

export interface SolarNodeConnection {
  center: AccessMapNode | null
  connections: AccessMapNode[]
  edges: AccessMapEdge[]
}

export async function getSolarNetworkNode(companyId: number, nodeId: number): Promise<SolarNodeConnection> {
  requireSupabase()
  const orgId = await assertCompanyInOrg(companyId)

  // Supabase: build node view from kyi_investors + kyi_investor_leads
  const { data: investorRow, error: invErr } = await supabase
    .from('kyi_investors')
    .select('*')
    .eq('id', nodeId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (invErr || !investorRow) {
    return { center: null, connections: [], edges: [] }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inv: any = investorRow
  const centerNode: AccessMapNode = {
    id: inv.id as number,
    company_id: companyId,
    node_type: 'investor',
    label: (inv.full_name as string) ?? 'Investor',
    meta_json: JSON.stringify({
      firm: (inv.firm as string | null) ?? undefined,
      title: (inv.title as string | null) ?? undefined,
      location: (inv.location as string | null) ?? undefined,
      email: (inv.email as string | null) ?? undefined,
    }),
  }

  const connections: AccessMapNode[] = []
  const edges: AccessMapEdge[] = []
  let edgeId = 1

  // Find related investors in the same company (shared firm or shared location)
  const { data: siblings } = await supabase
    .from('kyi_investors')
    .select('id, full_name, firm, location, investor_type')
    .eq('company_id', companyId)
    .eq('organization_id', orgId)
    .neq('id', nodeId)

  const firm = ((inv.firm as string | null) ?? '').trim().toLowerCase()
  const loc = ((inv.location as string | null) ?? '').trim().toLowerCase()

  for (const sib of (siblings ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s: any = sib
    const sibFirm = ((s.firm as string | null) ?? '').trim().toLowerCase()
    const sibLoc = ((s.location as string | null) ?? '').trim().toLowerCase()
    const sharedFirm = firm && sibFirm && firm === sibFirm
    const sharedLoc = loc && sibLoc && loc === sibLoc

    if (sharedFirm || sharedLoc) {
      connections.push({
        id: s.id as number,
        company_id: companyId,
        node_type: 'investor',
        label: (s.full_name as string) ?? 'Investor',
        meta_json: JSON.stringify({ firm: s.firm ?? undefined }),
      })
      if (sharedFirm) {
        edges.push({ id: edgeId++, from_node_id: nodeId, to_node_id: s.id as number, edge_type: 'shared_firm', weight: 1 })
      }
      if (sharedLoc && !sharedFirm) {
        edges.push({ id: edgeId++, from_node_id: nodeId, to_node_id: s.id as number, edge_type: 'shared_location', weight: 1 })
      }
    }
  }

  // Also pull leads assigned to this investor as person-type connections
  try {
    const { data: leads } = await supabase
      .from('kyi_investor_leads')
      .select('id, first_name, last_name, city, state, source')
      .or(`organization_id.eq.${orgId},organization_id.is.null`)
      .or(`first_name.ilike.%${(inv.full_name as string ?? '').split(' ')[0]}%`)
      .limit(20)

    const LEAD_NODE_OFFSET = 20_000_000
    for (const lead of (leads ?? [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const l: any = lead
      const leadName = [l.first_name, l.last_name].filter(Boolean).join(' ') || 'Lead'
      connections.push({
        id: LEAD_NODE_OFFSET + (l.id as number),
        company_id: companyId,
        node_type: 'person',
        label: leadName,
        meta_json: JSON.stringify({
          city: l.city ?? undefined,
          state: l.state ?? undefined,
          source: l.source ?? undefined,
        }),
      })
      edges.push({ id: edgeId++, from_node_id: nodeId, to_node_id: LEAD_NODE_OFFSET + (l.id as number), edge_type: 'suggested_lead', weight: 0.5 })
    }
  } catch { /* leads table may not exist */ }

  // If no connections found at all, still show all other company investors as connections
  if (connections.length === 0 && (siblings ?? []).length > 0) {
    for (const sib of (siblings ?? [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s: any = sib
      connections.push({
        id: s.id as number,
        company_id: companyId,
        node_type: 'investor',
        label: (s.full_name as string) ?? 'Investor',
        meta_json: JSON.stringify({ firm: s.firm ?? undefined }),
      })
      edges.push({ id: edgeId++, from_node_id: nodeId, to_node_id: s.id as number, edge_type: 'same_company', weight: 0.5 })
    }
  }

  return { center: centerNode, connections, edges }
}

export async function getSolarNetworkInvestors(companyId: number): Promise<{ investors: AccessMapNode[] }> {
  requireSupabase()
  const orgId = await getOrganizationId()

  const { data, error } = await supabase
    .from('kyi_investors')
    .select('id, full_name, firm')
    .eq('company_id', companyId)
    .eq('organization_id', orgId)

  if (error) {
    throw new Error(error.message || 'Failed to load investors for solar network')
  }

  const investors: AccessMapNode[] = (data ?? []).map((row) => ({
    id: row.id as number,
    company_id: companyId,
    node_type: 'investor',
    label: row.full_name as string,
    meta_json: JSON.stringify({
      firm: (row.firm as string | null) ?? undefined,
    }),
  }))

  return { investors }
}

// Investor profile (full detail + suggestions)
export interface KYIInvestorDetail extends KYIInvestor {
  company_id: number | null
  company?: { id: number; name: string } | null
  connection_count?: number
}

export async function getInvestor(investorId: number): Promise<KYIInvestorDetail> {
  requireSupabase()
  const orgId = await getOrganizationId()

  const { data: investor, error } = await supabase
    .from('kyi_investors')
    .select('*')
    .eq('id', investorId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load investor')
  }
  if (!investor) {
    throw new Error('Investor not found')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inv: any = investor
  const companyId = inv.company_id as number | null
  let company: { id: number; name: string } | null = null

  if (companyId != null) {
    const { data: companyRow } = await supabase
      .from('kyi_companies')
      .select('id, name')
      .eq('id', companyId)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (companyRow) {
      company = { id: companyRow.id as number, name: companyRow.name as string }
    }
  }

  // Compute connection_count from sibling investors sharing firm or location
  let connectionCount = 0
  if (companyId != null) {
    const { data: siblings } = await supabase
      .from('kyi_investors')
      .select('id, firm, location')
      .eq('company_id', companyId)
      .eq('organization_id', orgId)
      .neq('id', investorId)

    const myFirm = ((inv.firm as string | null) ?? '').trim().toLowerCase()
    const myLoc = ((inv.location as string | null) ?? '').trim().toLowerCase()
    for (const sib of (siblings ?? [])) {
      const sibFirm = ((sib.firm as string | null) ?? '').trim().toLowerCase()
      const sibLoc = ((sib.location as string | null) ?? '').trim().toLowerCase()
      if ((myFirm && sibFirm && myFirm === sibFirm) || (myLoc && sibLoc && myLoc === sibLoc)) {
        connectionCount++
      }
    }
  }

  return {
    id: inv.id,
    full_name: inv.full_name,
    email: inv.email ?? null,
    phone: inv.phone ?? null,
    firm: inv.firm ?? null,
    title: inv.title ?? null,
    location: inv.location ?? null,
    industry: inv.industry ?? null,
    profile_url: inv.profile_url ?? null,
    notes: inv.notes ?? null,
    created_at: inv.created_at ?? null,
    investor_type: inv.investor_type ?? null,
    company_id: companyId,
    company,
    connection_count: connectionCount,
    updated_at: inv.updated_at ?? null,
    segment_type: inv.segment_type ?? null,
    user_role_classification: inv.user_role_classification ?? null,
    northstar_tier: inv.northstar_tier ?? null,
    northstar_pipeline_stage: inv.northstar_pipeline_stage ?? null,
    northstar_probability: inv.northstar_probability ?? null,
    northstar_warm_intro: inv.northstar_warm_intro ?? null,
    northstar_last_contact_at: inv.northstar_last_contact_at ?? null,
    northstar_next_step: inv.northstar_next_step ?? null,
    northstar_scorecard: inv.northstar_scorecard ?? null,
    northstar_category_fields: inv.northstar_category_fields ?? null,
    northstar_due_diligence: inv.northstar_due_diligence ?? null,
    global_investor_id:
      inv.global_investor_id != null ? Number(inv.global_investor_id) : null,
    internal_rating: inv.internal_rating != null ? Number(inv.internal_rating) : null,
    assigned_team_member: (inv.assigned_team_member as string) ?? null,
  } as KYIInvestorDetail
}

export async function updateInvestor(
  investorId: number,
  data: Partial<{
    full_name: string
    email: string | null
    phone: string | null
    location: string | null
    industry: string | null
    firm: string | null
    title: string | null
    profile_url: string | null
    notes: string | null
  }>,
): Promise<void> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const { error } = await supabase
    .from('kyi_investors')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', investorId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message || 'Failed to update investor')
}

export async function updateInvestorType(investorId: number, investorType: string | null): Promise<void> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const { error } = await supabase
    .from('kyi_investors')
    .update({ investor_type: investorType, updated_at: new Date().toISOString() })
    .eq('id', investorId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message || 'Failed to update investor type')
}

export interface KYIInvestorTypeProfile {
  id: number
  type: string
  description: string | null
  motivations: string | null
  cares_about: string | null
  decision_drivers: string | null
  red_flags: string | null
  messaging_approach: string | null
  outreach_angle: string | null
  category_fields?: string[] | null
}

export async function getInvestorTypeProfiles(companyId?: number): Promise<KYIInvestorTypeProfile[]> {
  if (companyId != null && isSupabaseConfigured) {
    try {
      const { getCompanyInvestorCategories } = await import('@/lib/kyi-northstar')
      const cats = await getCompanyInvestorCategories(companyId)
      if (cats.length > 0) {
        return cats.map(
          (c): KYIInvestorTypeProfile => ({
            id: c.id,
            type: c.type,
            description: c.description,
            motivations: c.motivations,
            cares_about: c.cares_about,
            decision_drivers: c.decision_drivers,
            red_flags: c.red_flags,
            messaging_approach: c.messaging_approach,
            outreach_angle: c.outreach_angle,
            category_fields: c.category_fields,
          }),
        )
      }
    } catch {
      // Fall through to global profiles
    }
  }

  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured')
  }

  const { data, error } = await supabase
    .from('kyi_investor_type_profiles')
    .select('id, type, description, motivations, cares_about, decision_drivers, red_flags, messaging_approach, outreach_angle, category_fields')
    .order('type', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Failed to load investor type profiles')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[] ?? []).map((row: any): KYIInvestorTypeProfile => ({
    id: row.id,
    type: row.type,
    description: row.description ?? null,
    motivations: row.motivations ?? null,
    cares_about: row.cares_about ?? null,
    decision_drivers: row.decision_drivers ?? null,
    red_flags: row.red_flags ?? null,
    messaging_approach: row.messaging_approach ?? null,
    outreach_angle: row.outreach_angle ?? null,
    category_fields: Array.isArray(row.category_fields) ? (row.category_fields as string[]) : null,
  }))
}

export interface InvestorSuggestionsResponse {
  investor: { id: number; name: string; firm?: string; title?: string; location?: string; industry?: string }
  suggested_count: number
  firms: Record<string, SuggestedInvestor[]>
  suggestions: SuggestedInvestor[]
}

export async function getInvestorSuggestions(investorId: number): Promise<InvestorSuggestionsResponse> {
  requireSupabase()

  const detail = await getInvestor(investorId)
  return {
    investor: {
      id: detail.id,
      name: detail.full_name,
      firm: detail.firm ?? undefined,
      title: detail.title ?? undefined,
      location: detail.location ?? undefined,
      industry: detail.industry ?? undefined,
    },
    suggested_count: 0,
    firms: {},
    suggestions: [],
  }
}

// Cross-reference
export interface CrossReferenceInvestor {
  id: number
  full_name: string
  firm: string | null
  company_id: number | null
  company_name: string | null
  conn_count: number
}

export async function getCrossReferenceInvestors(): Promise<CrossReferenceInvestor[]> {
  requireSupabase()
  const orgId = await getOrganizationId()

  const { data, error } = await supabase
    .from('kyi_investors')
    .select('id, full_name, firm, company_id')
    .eq('organization_id', orgId)

  if (error) {
    throw new Error(error.message || 'Failed to load investors for cross-reference')
  }

  const companyNames = new Map<number, string>()
  if (data && data.length > 0) {
    const companyIds = Array.from(
      new Set(
        data
          .map((row) => row.company_id as number | null)
          .filter((id): id is number => typeof id === 'number'),
      ),
    )
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from('kyi_companies')
        .select('id, name')
        .eq('organization_id', orgId)
        .in('id', companyIds)
      for (const c of companies ?? []) {
        companyNames.set(c.id as number, c.name as string)
      }
    }
  }

  return (data ?? []).map((row) => {
    const cid = row.company_id as number | null
    return {
      id: row.id as number,
      full_name: row.full_name as string,
      firm: (row.firm as string | null) ?? null,
      company_id: cid,
      company_name: cid != null ? companyNames.get(cid) ?? null : null,
      conn_count: 0,
    }
  })
}

export interface CrossReferenceCompareResponse {
  investor_data: Record<
    number,
    { investor: KYIInvestorDetail; connections: unknown[]; people: string[]; companies: string[] }
  >
  overlapping_people: Record<string, number[]>
  shared_companies: Record<string, number[]>
  stats: {
    total_investors: number
    total_unique_people: number
    overlapping_people_count: number
    total_unique_companies: number
    shared_companies_count: number
  }
}

export async function postCrossReferenceCompare(investorIds: number[]): Promise<CrossReferenceCompareResponse> {
  requireSupabase()
  const orgId = await getOrganizationId()

  const uniqueInvestorIds = Array.from(new Set(investorIds))
  const { data, error } = await supabase
    .from('kyi_investors')
    .select('*')
    .eq('organization_id', orgId)
    .in('id', uniqueInvestorIds)

  if (error) {
    throw new Error(error.message || 'Failed to load investors for comparison')
  }

  const investor_data: CrossReferenceCompareResponse['investor_data'] = {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    const id = row.id as number
    const detail = {
      id,
      full_name: row.full_name,
      email: row.email ?? null,
      phone: row.phone ?? null,
      firm: row.firm ?? null,
      title: row.title ?? null,
      location: row.location ?? null,
      industry: row.industry ?? null,
      profile_url: row.profile_url ?? null,
      notes: row.notes ?? null,
      created_at: row.created_at ?? null,
      investor_type: row.investor_type ?? null,
      company_id: row.company_id ?? null,
      company: undefined,
      connection_count: 0,
    } as KYIInvestorDetail

    investor_data[id] = {
      investor: detail,
      connections: [],
      people: [],
      companies: [],
    }
  }

  return {
    investor_data,
    overlapping_people: {},
    shared_companies: {},
    stats: {
      total_investors: Object.keys(investor_data).length,
      total_unique_people: 0,
      overlapping_people_count: 0,
      total_unique_companies: 0,
      shared_companies_count: 0,
    },
  }
}

// ---------------------------------------------------------------------------
// Notes history (central view of all investor + lead notes for a company)
// ---------------------------------------------------------------------------

export interface KYINotesHistoryEntry {
  id: string
  source: 'investor' | 'lead'
  investor_id: number
  investor_name: string
  lead_id?: number
  lead_name?: string
  body: string
  updated_at: string
  created_at: string
}

export async function getCompanyNotesHistory(companyId: number): Promise<KYINotesHistoryEntry[]> {
  requireSupabase()

  const investors = await getCompanyInvestors(companyId)
  const entries: KYINotesHistoryEntry[] = []

  for (const inv of investors) {
    if (inv.notes?.trim()) {
      entries.push({
        id: `inv-${inv.id}`,
        source: 'investor',
        investor_id: inv.id,
        investor_name: inv.full_name,
        body: inv.notes.trim(),
        updated_at: inv.updated_at ?? inv.created_at ?? new Date().toISOString(),
        created_at: inv.created_at ?? new Date().toISOString(),
      })
    }
  }

  if (investors.length > 0) {
    try {
      const investorIds = investors.map((i) => i.id)
      const { data: leadNotes, error } = await supabase
        .from('kyi_lead_notes')
        .select('id, lead_id, investor_id, body, created_at, updated_at')
        .in('investor_id', investorIds)
        .order('updated_at', { ascending: false })

      if (!error && leadNotes) {
        const invMap = new Map(investors.map((i) => [i.id, i.full_name]))
        for (const note of leadNotes) {
          if (!(note.body as string)?.trim()) continue
          entries.push({
            id: `lead-${note.id}`,
            source: 'lead',
            investor_id: note.investor_id as number,
            investor_name: invMap.get(note.investor_id as number) ?? 'Unknown',
            lead_id: note.lead_id as number,
            lead_name: `Lead #${note.lead_id}`,
            body: (note.body as string).trim(),
            updated_at: (note.updated_at as string) ?? new Date().toISOString(),
            created_at: (note.created_at as string) ?? new Date().toISOString(),
          })
        }
      }
    } catch {
      // kyi_lead_notes table may not exist
    }
  }

  entries.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  return entries
}

// ---------------------------------------------------------------------------
// Company-level aggregated leads (combines all investors' geo-targeted leads)
// ---------------------------------------------------------------------------

export interface AggregatedLead extends KYILead {
  from_investors: Array<{ id: number; name: string }>
}

export interface CompanyAggregatedLeadsResponse {
  investors: Array<{ id: number; full_name: string; color: string; lead_count: number }>
  leads: AggregatedLead[]
  total_unique: number
  multi_investor_count: number
}

const AGG_INVESTOR_COLORS = ['#7c5cff', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#ef4444', '#8b5cf6']

export async function getCompanyAggregatedLeads(
  companyId: number,
): Promise<CompanyAggregatedLeadsResponse> {
  const investors = await getCompanyInvestors(companyId)
  if (investors.length === 0) {
    return { investors: [], leads: [], total_unique: 0, multi_investor_count: 0 }
  }

  const leadMap = new Map<number, AggregatedLead>()

  const results = await Promise.all(
    investors.map((inv) =>
      getLeadsForInvestor(inv.id, { thinning: 'top_25_percent' })
        .then((res) => ({ inv, leads: res.leads }))
        .catch(() => ({ inv, leads: [] as KYILead[] })),
    ),
  )

  const investorSummaries = results.map((r, i) => ({
    id: r.inv.id,
    full_name: r.inv.full_name,
    color: AGG_INVESTOR_COLORS[i % AGG_INVESTOR_COLORS.length],
    lead_count: r.leads.length,
  }))

  for (const { inv, leads } of results) {
    for (const lead of leads) {
      const existing = leadMap.get(lead.id)
      if (existing) {
        if (!existing.from_investors.some((fi) => fi.id === inv.id)) {
          existing.from_investors.push({ id: inv.id, name: inv.full_name })
        }
      } else {
        leadMap.set(lead.id, { ...lead, from_investors: [{ id: inv.id, name: inv.full_name }] })
      }
    }
  }

  const allLeads = [...leadMap.values()].sort((a, b) => {
    const diff = b.from_investors.length - a.from_investors.length
    return diff !== 0 ? diff : b.raw_score - a.raw_score
  })

  return {
    investors: investorSummaries,
    leads: allLeads,
    total_unique: allLeads.length,
    multi_investor_count: allLeads.filter((l) => l.from_investors.length > 1).length,
  }
}

// ---------------------------------------------------------------------------
// Refinement: lead intel, geo targets, freshness, warm paths, raise profile
// ---------------------------------------------------------------------------

export interface KYILeadProfileIntel {
  id?: number
  lead_id: number
  client_id: number
  investor_type: string | null
  motivations: string | null
  cares_about_most: string[] | null
  decision_drivers: string[] | null
  red_flags: string[] | null
  green_flags: string[] | null
  ideal_messaging_approach: string | null
  example_outreach_angles: string[] | null
  notes_next_steps: string | null
}

export interface KYICompanyGeoTarget {
  id: number
  company_id: number
  location_label: string
  center_lat: number
  center_lng: number
  radius_miles: number
  sort_order: number
  is_active: boolean
}

export interface KyiWarmPath {
  pathDepth: number
  introInvestorId?: number
  introInvestorName?: string
  employeeName?: string
}

export interface KyiCompanyRaiseSummary {
  company_id: number
  targeted_total: number
  outreach_by_status: Record<KyiOutreachStatus, number>
  missing_contact_info: number
  stale_outreach: number
  warm_path_lead_count: number
  last_lead_import_at: string | null
}

function mapIntelRow(row: Record<string, unknown>): KYILeadProfileIntel {
  const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : null)
  return {
    id: row.id as number | undefined,
    lead_id: row.lead_id as number,
    client_id: row.client_id as number,
    investor_type: (row.investor_type as string | null) ?? null,
    motivations: (row.motivations as string | null) ?? null,
    cares_about_most: arr(row.cares_about_most),
    decision_drivers: arr(row.decision_drivers),
    red_flags: arr(row.red_flags),
    green_flags: arr(row.green_flags),
    ideal_messaging_approach: (row.ideal_messaging_approach as string | null) ?? null,
    example_outreach_angles: arr(row.example_outreach_angles),
    notes_next_steps: (row.notes_next_steps as string | null) ?? null,
  }
}

export async function getLeadById(leadId: number): Promise<KYILead | null> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('kyi_investor_leads')
    .select('*')
    .eq('id', leadId)
    .maybeSingle()
  if (error) throw new Error(error.message || 'Failed to load lead')
  if (!data) return null
  const leadOrg = (data as Record<string, unknown>).organization_id as string | null
  if (leadOrg != null && leadOrg !== orgId) return null
  return mapLeadRow(data as Record<string, unknown>)
}

export async function getLeadProfileIntel(
  companyId: number,
  leadId: number,
): Promise<KYILeadProfileIntel | null> {
  requireSupabase()
  await assertCompanyInOrg(companyId)
  const { data, error } = await supabase
    .from('kyi_lead_profile_intel')
    .select('*')
    .eq('client_id', companyId)
    .eq('lead_id', leadId)
    .maybeSingle()
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) return null
    throw new Error(error.message || 'Failed to load lead intel')
  }
  if (!data) return null
  return mapIntelRow(data as Record<string, unknown>)
}

export async function upsertLeadProfileIntel(
  companyId: number,
  leadId: number,
  patch: Partial<Pick<KYILeadProfileIntel, 'notes_next_steps' | 'ideal_messaging_approach'>>,
): Promise<KYILeadProfileIntel> {
  requireSupabase()
  await assertCompanyInOrg(companyId)
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('kyi_lead_profile_intel')
    .upsert(
      {
        lead_id: leadId,
        client_id: companyId,
        notes_next_steps: patch.notes_next_steps ?? null,
        ideal_messaging_approach: patch.ideal_messaging_approach ?? null,
        updated_at: now,
      },
      { onConflict: 'lead_id,client_id' },
    )
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Failed to save lead intel')
  return mapIntelRow(data as Record<string, unknown>)
}

export async function findInvestorByLeadOrName(
  companyId: number,
  leadId: number | null,
  name: string,
): Promise<KYIInvestor | null> {
  requireSupabase()
  const orgId = await getOrganizationId()
  if (leadId != null) {
    const { data } = await supabase
      .from('kyi_investors')
      .select('*')
      .eq('company_id', companyId)
      .eq('organization_id', orgId)
      .eq('source_lead_id', leadId)
      .maybeSingle()
    if (data) return mapInvestorRow(data)
  }
  const trimmed = name.trim().toLowerCase()
  if (!trimmed) return null
  const { data: rows } = await supabase
    .from('kyi_investors')
    .select('*')
    .eq('company_id', companyId)
    .eq('organization_id', orgId)
  for (const row of rows ?? []) {
    if ((row.full_name as string)?.trim().toLowerCase() === trimmed) {
      return mapInvestorRow(row)
    }
  }
  return null
}

export async function updateInvestorOutreachStatus(
  investorId: number,
  status: KyiOutreachStatus,
): Promise<void> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const { error } = await supabase
    .from('kyi_investors')
    .update({ outreach_status: status, updated_at: new Date().toISOString() })
    .eq('id', investorId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message || 'Failed to update outreach status')
}

export async function updateCompanyRaiseProfile(
  companyId: number,
  data: {
    raise_stage?: string | null
    raise_target_amount?: number | null
    preferred_investor_types?: string[]
    sector_tags?: string[]
  },
): Promise<void> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const { error } = await supabase
    .from('kyi_companies')
    .update({
      raise_stage: data.raise_stage ?? null,
      raise_target_amount: data.raise_target_amount ?? null,
      preferred_investor_types: data.preferred_investor_types ?? [],
      sector_tags: data.sector_tags ?? [],
    })
    .eq('id', companyId)
    .eq('organization_id', orgId)
  if (error) {
    if (isMissingColumnError(error)) {
      throw new Error(
        'Raise profile columns are missing. Run supabase-kyi-refinement-migration.sql in Supabase SQL Editor.',
      )
    }
    throw new Error(error.message || 'Failed to update raise profile')
  }
}

export async function getKyiDataFreshness(): Promise<{ last_lead_import_at: string | null }> {
  if (!isSupabaseConfigured) return { last_lead_import_at: null }
  try {
    const { data, error } = await supabase
      .from('kyi_platform_metadata')
      .select('value')
      .eq('key', 'last_lead_import_at')
      .maybeSingle()
    if (error || !data) return { last_lead_import_at: null }
    const val = data.value as { at?: string } | string | null
    if (typeof val === 'string') return { last_lead_import_at: val }
    return { last_lead_import_at: val?.at ?? null }
  } catch {
    return { last_lead_import_at: null }
  }
}

export async function getCompanyGeoTargets(
  companyId: number,
  opts?: { additionalOnly?: boolean },
): Promise<KYICompanyGeoTarget[]> {
  requireSupabase()
  const orgId = await assertCompanyInOrg(companyId)
  const { data, error } = await supabase
    .from('kyi_company_geo_targets')
    .select('*')
    .eq('company_id', companyId)
    .eq('organization_id', orgId)
    .order('sort_order', { ascending: true })
  if (error) {
    throw new Error(error.message || 'Failed to load company geo targets')
  }
  let targets = (data ?? []).map((row) => ({
    id: row.id as number,
    company_id: row.company_id as number,
    location_label: row.location_label as string,
    center_lat: row.center_lat as number,
    center_lng: row.center_lng as number,
    radius_miles: (row.radius_miles as number) ?? 50,
    sort_order: (row.sort_order as number) ?? 0,
    is_active: (row.is_active as boolean) ?? true,
  }))
  if (opts?.additionalOnly) {
    targets = targets.filter((t) => t.sort_order > 0 && t.is_active)
  }
  return targets
}

export async function upsertCompanyGeoTarget(
  companyId: number,
  input: {
    id?: number
    location_label: string
    center_lat: number
    center_lng: number
    radius_miles: number
    bbox_min_lat: number
    bbox_max_lat: number
    bbox_min_lng: number
    bbox_max_lng: number
    sort_order?: number
  },
): Promise<KYICompanyGeoTarget> {
  requireSupabase()
  const orgId = await assertCompanyInOrg(companyId)
  const now = new Date().toISOString()
  const payload = {
    company_id: companyId,
    organization_id: orgId,
    location_label: input.location_label.trim(),
    center_lat: input.center_lat,
    center_lng: input.center_lng,
    radius_miles: input.radius_miles,
    bbox_min_lat: input.bbox_min_lat,
    bbox_max_lat: input.bbox_max_lat,
    bbox_min_lng: input.bbox_min_lng,
    bbox_max_lng: input.bbox_max_lng,
    sort_order: input.sort_order ?? 0,
    is_active: true,
    updated_at: now,
  }
  if (input.id) {
    const { data, error } = await supabase
      .from('kyi_company_geo_targets')
      .update(payload)
      .eq('id', input.id)
      .eq('organization_id', orgId)
      .select('*')
      .single()
    if (error) throw new Error(error.message || 'Failed to update geo target')
    const row = data as Record<string, unknown>
    return {
      id: row.id as number,
      company_id: row.company_id as number,
      location_label: row.location_label as string,
      center_lat: row.center_lat as number,
      center_lng: row.center_lng as number,
      radius_miles: (row.radius_miles as number) ?? 50,
      sort_order: (row.sort_order as number) ?? 0,
      is_active: true,
    }
  }
  const { data, error } = await supabase
    .from('kyi_company_geo_targets')
    .insert({ ...payload, created_at: now })
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Failed to add geo target')
  const row = data as Record<string, unknown>
  return {
    id: row.id as number,
    company_id: row.company_id as number,
    location_label: row.location_label as string,
    center_lat: row.center_lat as number,
    center_lng: row.center_lng as number,
    radius_miles: (row.radius_miles as number) ?? 50,
    sort_order: (row.sort_order as number) ?? 0,
    is_active: true,
  }
}

export async function deleteCompanyGeoTarget(targetId: number): Promise<void> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const { error } = await supabase
    .from('kyi_company_geo_targets')
    .delete()
    .eq('id', targetId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message || 'Failed to delete geo target')
}

/** Geocode a label and append an additional market (does not change primary kyi_client_geo_settings). */
export async function addCompanyGeoTargetFromLabel(
  companyId: number,
  locationLabel: string,
  radiusMiles: number,
  sortOrder?: number,
): Promise<KYICompanyGeoTarget> {
  const label = locationLabel.trim()
  if (!label) throw new Error('Location is required')
  const coords = await geocodeAddressOrLabel(label)
  if (!coords) throw new Error('Could not geocode location')
  const radius = Math.min(250, Math.max(5, Math.round(radiusMiles)))
  const latDelta = radius / 69
  const cosLat = Math.cos(toRadians(coords.lat))
  const lngDenom = Math.max(1e-6, Math.abs(cosLat) * 69)
  const lngDelta = radius / lngDenom
  return upsertCompanyGeoTarget(companyId, {
    location_label: label,
    center_lat: coords.lat,
    center_lng: coords.lng,
    radius_miles: radius,
    bbox_min_lat: coords.lat - latDelta,
    bbox_max_lat: coords.lat + latDelta,
    bbox_min_lng: coords.lng - lngDelta,
    bbox_max_lng: coords.lng + lngDelta,
    sort_order: sortOrder ?? 1,
  })
}

export async function getWarmPathForLead(
  companyId: number,
  lead: { id: number; display_name: string; firm?: string | null; email?: string | null },
): Promise<KyiWarmPath> {
  const cold: KyiWarmPath = { pathDepth: 0 }
  if (!isSupabaseConfigured) return cold
  const investors = await getCompanyInvestors(companyId)
  const employees = investors.filter((i) => i.user_role_classification === 'employee')
  const networkInvestors = investors.filter((i) => i.user_role_classification === 'investor')
  // Prefer personal-network uploads as intro sources — those are explicit "I know this person" edges.
  const sortedNetwork = [...networkInvestors].sort((a, b) => {
    const aPers = (a.segment_type ?? '') === KYI_SEGMENT_PERSONAL_NETWORK ? 0 : 1
    const bPers = (b.segment_type ?? '') === KYI_SEGMENT_PERSONAL_NETWORK ? 0 : 1
    return aPers - bPers
  })
  const leadName = lead.display_name.trim().toLowerCase()
  const leadFirm = (lead.firm ?? '').trim().toLowerCase()
  const leadEmail = (lead.email ?? '').trim().toLowerCase()

  for (const inv of sortedNetwork) {
    const invName = inv.full_name.trim().toLowerCase()
    const invFirm = (inv.firm ?? '').trim().toLowerCase()
    const invEmail = (inv.email ?? '').trim().toLowerCase()
    const emailMatch = !!(leadEmail && invEmail && leadEmail === invEmail)
    const nameMatch =
      !!leadName && (invName.includes(leadName) || leadName.includes(invName))
    const firmMatch = !!(leadFirm && invFirm && leadFirm === invFirm)
    if (emailMatch || nameMatch || firmMatch) {
      for (const emp of employees) {
        const empLoc = (emp.location ?? '').trim().toLowerCase()
        const invLoc = (inv.location ?? '').trim().toLowerCase()
        if (empLoc && invLoc && empLoc === invLoc) {
          return {
            pathDepth: 2,
            introInvestorId: inv.id,
            introInvestorName: inv.full_name,
            employeeName: emp.full_name,
          }
        }
      }
      return { pathDepth: 1, introInvestorId: inv.id, introInvestorName: inv.full_name }
    }
  }

  try {
    const map = await getAccessMap(companyId)
    if (map.edges.length > 0 && sortedNetwork.length > 0) {
      const first = sortedNetwork[0]
      return { pathDepth: 1, introInvestorId: first.id, introInvestorName: first.full_name }
    }
  } catch {
    /* ignore */
  }
  return cold
}

export async function countWarmPathLeads(companyId: number, leads: KYILead[]): Promise<number> {
  let n = 0
  const sample = leads.slice(0, 40)
  for (const lead of sample) {
    const path = await getWarmPathForLead(companyId, {
      id: lead.id,
      display_name: lead.display_name,
      firm: (lead.metadata?.firm as string | undefined) ?? null,
      email: (lead.metadata?.email as string | undefined) ?? null,
    })
    if (path.pathDepth > 0) n++
  }
  if (leads.length > 40 && n > 0) {
    return Math.round((n / 40) * leads.length)
  }
  return n
}

export async function getCompanyRaiseSummary(companyId: number): Promise<KyiCompanyRaiseSummary> {
  const investors = await getCompanyInvestors(companyId, {
    segmentTypes: ['targeted_investor'],
  })
  const outreach_by_status: Record<KyiOutreachStatus, number> = {
    new: 0,
    contacted: 0,
    meeting: 0,
    passed: 0,
  }
  const staleDays = 14
  const staleCutoff = Date.now() - staleDays * 86400000
  let missing_contact_info = 0
  let stale_outreach = 0
  for (const inv of investors) {
    const st = (inv.outreach_status ?? 'new') as KyiOutreachStatus
    outreach_by_status[st] = (outreach_by_status[st] ?? 0) + 1
    if (!inv.email && !inv.phone && !inv.profile_url) missing_contact_info++
    const updated = inv.updated_at ? new Date(inv.updated_at).getTime() : 0
    if (st === 'new' && updated < staleCutoff) stale_outreach++
  }
  const leadsRes = await getLeads(companyId, { thinning: 'top_10_percent' }).catch(() => null)
  const warm_path_lead_count = leadsRes
    ? await countWarmPathLeads(companyId, leadsRes.leads)
    : 0
  const freshness = await getKyiDataFreshness()
  return {
    company_id: companyId,
    targeted_total: investors.length,
    outreach_by_status,
    missing_contact_info,
    stale_outreach,
    warm_path_lead_count,
    last_lead_import_at: freshness.last_lead_import_at,
  }
}

