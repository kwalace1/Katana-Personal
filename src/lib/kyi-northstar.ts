/**
 * KYI Investor Northstar — fundraise framework for tracking outreach, scorecards,
 * due diligence, and meeting notes per company.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { KYIInvestor } from '@/lib/kyi-api'
import { createInvestor } from '@/lib/kyi-api'
import { assertCompanyInOrg, assertInvestorInOrg } from '@/lib/kyi-org'

// ---------------------------------------------------------------------------
// Constants (from Northstar doc)
// ---------------------------------------------------------------------------

export const NORTHSTAR_PIPELINE_STAGES = [
  { value: 'research', label: 'Research' },
  { value: 'intro_requested', label: 'Intro Requested' },
  { value: 'first_meeting', label: 'First Meeting' },
  { value: 'partner_meeting', label: 'Partner Meeting' },
  { value: 'due_diligence', label: 'Due Diligence' },
  { value: 'term_sheet', label: 'Term Sheet' },
  { value: 'closed', label: 'Closed' },
  { value: 'passed', label: 'Passed' },
] as const

export type NorthstarPipelineStage = (typeof NORTHSTAR_PIPELINE_STAGES)[number]['value']

export const NORTHSTAR_TIERS = [
  { value: 1, label: 'Tier 1 — Pursue Immediately', description: 'Highest strategic value investors.' },
  { value: 2, label: 'Tier 2 — Strong Fits', description: 'Excellent investors if Tier 1 is unavailable.' },
  { value: 3, label: 'Tier 3 — Capital Only', description: 'Good financial partners but limited strategic value.' },
] as const

export type NorthstarTier = (typeof NORTHSTAR_TIERS)[number]['value']

export const NORTHSTAR_SCORECARD_CRITERIA = [
  { key: 'understands_saas', label: 'Understands SaaS' },
  { key: 'understands_ai', label: 'Understands AI' },
  { key: 'understands_smb_software', label: 'Understands SMB Software' },
  { key: 'can_introduce_customers', label: 'Can Introduce Customers' },
  { key: 'can_help_recruit_talent', label: 'Can Help Recruit Talent' },
  { key: 'has_follow_on_capital', label: 'Has Follow-on Capital' },
  { key: 'strong_reputation', label: 'Strong Reputation' },
  { key: 'responsive', label: 'Responsive' },
  { key: 'long_term_partner', label: 'Long-Term Partner' },
  { key: 'founder_friendly', label: 'Founder Friendly' },
] as const

export type NorthstarScorecard = Record<string, number>

export const NORTHSTAR_DUE_DILIGENCE_QUESTIONS = [
  { key: 'portfolio_companies', label: 'What companies have they invested in?' },
  { key: 'ownership_target', label: 'What is their average ownership target?' },
  { key: 'leads_rounds', label: 'Do they lead rounds?' },
  { key: 'competitor_investments', label: 'Have they invested in competitors?' },
  { key: 'post_investment_involvement', label: 'How involved are they after investing?' },
  { key: 'decision_speed', label: 'How quickly do they make decisions?' },
  { key: 'enterprise_intros', label: 'Can they introduce enterprise customers?' },
  { key: 'executive_recruiting', label: 'Can they help recruit executives?' },
  { key: 'founder_sentiment', label: 'Have founders spoken positively about them?' },
  { key: 'katana_strength', label: 'Why would this investor specifically make your company stronger?' },
] as const

export type NorthstarDueDiligence = Record<string, string>

export const NORTHSTAR_CATEGORY_FIELD_LABELS: Record<string, string> = {
  partner: 'Partner',
  website: 'Website',
  investment_stage: 'Investment Stage',
  average_check: 'Average Check',
  portfolio_companies: 'Portfolio Companies',
  why_fit: "Why They're Fit",
  warm_intro_available: 'Warm Introduction Available?',
  current_status: 'Current Status',
  next_action: 'Next Action',
  meeting_notes: 'Meeting Notes',
  industries_invested_in: 'Industries Invested In',
  strategic_value: 'Strategic Value',
  notes: 'Notes',
  ai_focus: 'AI Focus',
  portfolio: 'Portfolio',
  strategic_benefit: 'Potential Strategic Benefit',
  why_relevant: "Why They're Relevant",
  investment_criteria: 'Investment Criteria',
  primary_contact: 'Primary Contact',
  industry_background: 'Industry Background',
  investment_focus: 'Investment Focus',
  average_investment: 'Average Investment',
  warm_intro: 'Warm Introduction',
  previous_company: 'Previous Company',
  exit: 'Exit',
  current_company: 'Current Company',
  investment_size: 'Investment Size',
  corporate_venture_arm: 'Corporate Venture Arm',
  contact: 'Contact',
  potential_partnership: 'Potential Partnership',
  owner: 'Owner',
  industry: 'Industry',
  current_customer: 'Current Customer?',
  investment_interest: 'Investment Interest',
}

export const DEFAULT_STRATEGY_PRIORITIES = [
  'Strategic value',
  'Industry expertise',
  'Customer introductions',
  'Ability to lead future funding rounds',
  'Capital',
]

export const DEFAULT_IDEAL_PROFILE_TRAITS = [
  'Understands B2B SaaS economics',
  'Believes in AI-powered workflow software',
  'Has experience with SMB software',
  'Makes customer introductions',
  'Assists with executive recruiting',
  'Supports future fundraising rounds',
  'Has a long-term investment horizon',
  'Is founder-friendly',
  'Willing to actively advise the company',
  'Adds significantly more value than capital alone',
]

/** CSV template headers for Northstar investor import */
export const NORTHSTAR_CSV_HEADERS = [
  'name',
  'firm',
  'partner',
  'website',
  'category',
  'tier',
  'pipeline_stage',
  'probability',
  'warm_intro',
  'last_contact',
  'next_step',
  'current_status',
  'average_check',
  'portfolio_companies',
  'why_fit',
  'notes',
  ...NORTHSTAR_SCORECARD_CRITERIA.map((c) => `score_${c.key}`),
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KyiNorthstarConfig {
  company_id: number
  strategy_priorities: string[]
  ideal_profile_traits: string[]
  strategy_notes: string | null
  updated_at: string | null
}

export interface NorthstarKeyLabelItem {
  key: string
  label: string
}

export interface NorthstarPipelineStageItem {
  value: string
  label: string
}

export interface NorthstarTierItem {
  value: number
  label: string
  description?: string
}

/** Full per-company Northstar framework (strategy + pipeline + scorecard + diligence). */
export interface KyiNorthstarFramework extends KyiNorthstarConfig {
  pipeline_stages: NorthstarPipelineStageItem[]
  scorecard_criteria: NorthstarKeyLabelItem[]
  due_diligence_questions: NorthstarKeyLabelItem[]
  tiers: NorthstarTierItem[]
  scorecard_max: number
}

export interface KyiCompanyInvestorCategory {
  id: number
  company_id: number
  type: string
  slug: string | null
  description: string | null
  motivations: string | null
  cares_about: string | null
  decision_drivers: string | null
  red_flags: string | null
  messaging_approach: string | null
  outreach_angle: string | null
  category_fields: string[]
  sort_order: number
  is_active: boolean
}

export const DEFAULT_PIPELINE_STAGES: NorthstarPipelineStageItem[] = [...NORTHSTAR_PIPELINE_STAGES]
export const DEFAULT_SCORECARD_CRITERIA: NorthstarKeyLabelItem[] = NORTHSTAR_SCORECARD_CRITERIA.map((c) => ({
  key: c.key,
  label: c.label,
}))
export const DEFAULT_DUE_DILIGENCE_QUESTIONS: NorthstarKeyLabelItem[] = NORTHSTAR_DUE_DILIGENCE_QUESTIONS.map(
  (q) => ({ key: q.key, label: q.label }),
)
export const DEFAULT_TIERS: NorthstarTierItem[] = NORTHSTAR_TIERS.map((t) => ({
  value: t.value,
  label: t.label,
  description: t.description,
}))

export interface KyiNorthstarInvestor extends KYIInvestor {
  northstar_tier: NorthstarTier | null
    northstar_pipeline_stage: string | null
  northstar_probability: number | null
  northstar_warm_intro: boolean | null
  northstar_last_contact_at: string | null
  northstar_next_step: string | null
  northstar_scorecard: NorthstarScorecard
  northstar_category_fields: Record<string, string>
  northstar_due_diligence: NorthstarDueDiligence
  score_total: number
}

export interface KyiInvestorMeeting {
  id: number
  investor_id: number
  company_id: number
  meeting_date: string | null
  attendees: string | null
  key_discussion_points: string | null
  questions_asked: string | null
  concerns_raised: string | null
  follow_up_items: string | null
  overall_impression: string | null
  likelihood_of_investment: string | null
  next_meeting_date: string | null
  created_at: string
  updated_at: string
}

export interface KyiNorthstarPipelineSummary {
  total: number
  by_stage: Record<string, number>
  by_tier: Record<string, number>
  avg_score: number | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function slugifyKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64) || 'item'
}

export function buildDefaultFramework(companyId: number): KyiNorthstarFramework {
  const criteria = DEFAULT_SCORECARD_CRITERIA
  return {
    company_id: companyId,
    strategy_priorities: [...DEFAULT_STRATEGY_PRIORITIES],
    ideal_profile_traits: [...DEFAULT_IDEAL_PROFILE_TRAITS],
    strategy_notes:
      'Money alone should never be the deciding factor. Prioritize investors that provide strategic guidance, customer introductions, industry expertise, hiring support, and long-term credibility.',
    updated_at: null,
    pipeline_stages: DEFAULT_PIPELINE_STAGES.map((s) => ({ ...s })),
    scorecard_criteria: criteria.map((c) => ({ ...c })),
    due_diligence_questions: DEFAULT_DUE_DILIGENCE_QUESTIONS.map((q) => ({ ...q })),
    tiers: DEFAULT_TIERS.map((t) => ({ ...t })),
    scorecard_max: criteria.length * 5,
  }
}

export function computeScorecardTotal(
  scorecard: Record<string, number> | null | undefined,
  criteria: NorthstarKeyLabelItem[] = DEFAULT_SCORECARD_CRITERIA,
): number {
  if (!scorecard || typeof scorecard !== 'object') return 0
  return criteria.reduce((sum, c) => {
    const v = scorecard[c.key]
    return sum + (typeof v === 'number' && v >= 1 && v <= 5 ? v : 0)
  }, 0)
}

export function pipelineStageLabel(
  stage: string | null | undefined,
  stages: NorthstarPipelineStageItem[] = DEFAULT_PIPELINE_STAGES,
): string {
  if (!stage) return '—'
  return stages.find((s) => s.value === stage)?.label ?? stage
}

export function tierLabel(
  tier: number | null | undefined,
  tiers: NorthstarTierItem[] = DEFAULT_TIERS,
): string {
  if (tier == null) return '—'
  return tiers.find((t) => t.value === tier)?.label ?? `Tier ${tier}`
}

/** Tailwind classes for pipeline stage badges (light + dark friendly). */
export function stageBadgeClass(stage: string | null | undefined): string {
  const map: Record<string, string> = {
    research: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
    intro_requested: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20',
    first_meeting: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
    partner_meeting: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
    due_diligence: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
    term_sheet: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
    closed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    passed: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20',
  }
  return map[stage ?? 'research'] ?? map.research!
}

/** Tailwind classes for tier badges. */
export function tierBadgeClass(tier: number | null | undefined): string {
  if (tier === 1) return 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30'
  if (tier === 2) return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
  if (tier === 3) return 'bg-muted text-muted-foreground border-border'
  return ''
}

/** Score as percentage of max for progress bars. */
export function scorecardPercent(scoreTotal: number, max = 50): number {
  if (max <= 0) return 0
  return Math.min(100, Math.round((scoreTotal / max) * 100))
}

function parseJsonRecord(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (val != null && String(val).trim()) out[k] = String(val)
  }
  return out
}

function parseScorecard(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, number> = {}
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (typeof raw === 'number' && raw >= 1 && raw <= 5) out[k] = raw
  }
  return out
}

function parseDueDiligence(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, string> = {}
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (raw != null && String(raw).trim()) out[k] = String(raw)
  }
  return out
}

function parsePipelineStages(v: unknown, fallback: NorthstarPipelineStageItem[]): NorthstarPipelineStageItem[] {
  if (!Array.isArray(v) || v.length === 0) return fallback.map((s) => ({ ...s }))
  const out: NorthstarPipelineStageItem[] = []
  for (const item of v) {
    if (!item || typeof item !== 'object') continue
    const value = String((item as { value?: unknown }).value ?? '').trim()
    const label = String((item as { label?: unknown }).label ?? '').trim()
    if (value && label) out.push({ value, label })
  }
  return out.length > 0 ? out : fallback.map((s) => ({ ...s }))
}

function parseKeyLabelItems(v: unknown, fallback: NorthstarKeyLabelItem[]): NorthstarKeyLabelItem[] {
  if (!Array.isArray(v) || v.length === 0) return fallback.map((x) => ({ ...x }))
  const out: NorthstarKeyLabelItem[] = []
  for (const item of v) {
    if (!item || typeof item !== 'object') continue
    const key = String((item as { key?: unknown }).key ?? '').trim()
    const label = String((item as { label?: unknown }).label ?? '').trim()
    if (key && label) out.push({ key, label })
  }
  return out.length > 0 ? out : fallback.map((x) => ({ ...x }))
}

function parseTiers(v: unknown, fallback: NorthstarTierItem[]): NorthstarTierItem[] {
  if (!Array.isArray(v) || v.length === 0) return fallback.map((t) => ({ ...t }))
  const out: NorthstarTierItem[] = []
  for (const item of v) {
    if (!item || typeof item !== 'object') continue
    const value = Number((item as { value?: unknown }).value)
    const label = String((item as { label?: unknown }).label ?? '').trim()
    const description = (item as { description?: unknown }).description
    if (!Number.isNaN(value) && label) {
      out.push({
        value,
        label,
        description: description != null ? String(description) : undefined,
      })
    }
  }
  return out.length > 0 ? out : fallback.map((t) => ({ ...t }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapNorthstarInvestorRow(row: any): KyiNorthstarInvestor {
  const scorecard = parseScorecard(row.northstar_scorecard) as NorthstarScorecard
  const scoreTotal = Object.values(scorecard).reduce(
    (sum, v) => sum + (typeof v === 'number' && v >= 1 && v <= 5 ? v : 0),
    0,
  )
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
    outreach_status: row.outreach_status ?? 'new',
    lead_snapshot: row.lead_snapshot ?? null,
    northstar_tier: (row.northstar_tier as NorthstarTier | null) ?? null,
    northstar_pipeline_stage: (row.northstar_pipeline_stage as string | null) ?? null,
    northstar_probability: (row.northstar_probability as number | null) ?? null,
    northstar_warm_intro: row.northstar_warm_intro ?? null,
    northstar_last_contact_at: row.northstar_last_contact_at ?? null,
    northstar_next_step: row.northstar_next_step ?? null,
    northstar_scorecard: scorecard,
    northstar_category_fields: parseJsonRecord(row.northstar_category_fields),
    northstar_due_diligence: parseDueDiligence(row.northstar_due_diligence) as NorthstarDueDiligence,
    score_total: scoreTotal,
  }
}

function isMissingNorthstarColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const msg = error.message ?? ''
  return (
    error.code === '42703' ||
    error.code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('kyi_company_investor_categories')
  )
}

function mapCategoryRow(row: Record<string, unknown>): KyiCompanyInvestorCategory {
  return {
    id: row.id as number,
    company_id: row.company_id as number,
    type: row.type as string,
    slug: (row.slug as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    motivations: (row.motivations as string | null) ?? null,
    cares_about: (row.cares_about as string | null) ?? null,
    decision_drivers: (row.decision_drivers as string | null) ?? null,
    red_flags: (row.red_flags as string | null) ?? null,
    messaging_approach: (row.messaging_approach as string | null) ?? null,
    outreach_angle: (row.outreach_angle as string | null) ?? null,
    category_fields: Array.isArray(row.category_fields) ? (row.category_fields as string[]) : [],
    sort_order: (row.sort_order as number) ?? 0,
    is_active: row.is_active !== false,
  }
}

function mapFrameworkRow(companyId: number, data: Record<string, unknown> | null): KyiNorthstarFramework {
  const defaults = buildDefaultFramework(companyId)
  if (!data) return defaults

  const scorecard_criteria = parseKeyLabelItems(data.scorecard_criteria, defaults.scorecard_criteria)
  return {
    company_id: companyId,
    strategy_priorities: Array.isArray(data.strategy_priorities)
      ? (data.strategy_priorities as string[])
      : defaults.strategy_priorities,
    ideal_profile_traits: Array.isArray(data.ideal_profile_traits)
      ? (data.ideal_profile_traits as string[])
      : defaults.ideal_profile_traits,
    strategy_notes: (data.strategy_notes as string | null) ?? defaults.strategy_notes,
    updated_at: (data.updated_at as string | null) ?? null,
    pipeline_stages: parsePipelineStages(data.pipeline_stages, defaults.pipeline_stages),
    scorecard_criteria,
    due_diligence_questions: parseKeyLabelItems(
      data.due_diligence_questions,
      defaults.due_diligence_questions,
    ),
    tiers: parseTiers(data.tiers, defaults.tiers),
    scorecard_max: scorecard_criteria.length * 5,
  }
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export async function getNorthstarFramework(companyId: number): Promise<KyiNorthstarFramework> {
  const fallback = buildDefaultFramework(companyId)
  if (!isSupabaseConfigured) return fallback
  await assertCompanyInOrg(companyId)

  const { data, error } = await supabase
    .from('kyi_northstar_config')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    if (isMissingNorthstarColumn(error)) return fallback
    throw new Error(error.message || 'Failed to load Northstar framework')
  }

  return mapFrameworkRow(companyId, data as Record<string, unknown> | null)
}

/** @deprecated Use getNorthstarFramework — kept for compatibility. */
export async function getNorthstarConfig(companyId: number): Promise<KyiNorthstarConfig> {
  const fw = await getNorthstarFramework(companyId)
  return {
    company_id: fw.company_id,
    strategy_priorities: fw.strategy_priorities,
    ideal_profile_traits: fw.ideal_profile_traits,
    strategy_notes: fw.strategy_notes,
    updated_at: fw.updated_at,
  }
}

export async function saveNorthstarFramework(
  companyId: number,
  patch: Partial<
    Pick<
      KyiNorthstarFramework,
      | 'strategy_priorities'
      | 'ideal_profile_traits'
      | 'strategy_notes'
      | 'pipeline_stages'
      | 'scorecard_criteria'
      | 'due_diligence_questions'
      | 'tiers'
    >
  >,
): Promise<KyiNorthstarFramework> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  await assertCompanyInOrg(companyId)
  const now = new Date().toISOString()
  const payload: Record<string, unknown> = { company_id: companyId, updated_at: now }
  if (patch.strategy_priorities !== undefined) payload.strategy_priorities = patch.strategy_priorities
  if (patch.ideal_profile_traits !== undefined) payload.ideal_profile_traits = patch.ideal_profile_traits
  if (patch.strategy_notes !== undefined) payload.strategy_notes = patch.strategy_notes ?? null
  if (patch.pipeline_stages !== undefined) payload.pipeline_stages = patch.pipeline_stages
  if (patch.scorecard_criteria !== undefined) payload.scorecard_criteria = patch.scorecard_criteria
  if (patch.due_diligence_questions !== undefined) payload.due_diligence_questions = patch.due_diligence_questions
  if (patch.tiers !== undefined) payload.tiers = patch.tiers

  const { error } = await supabase.from('kyi_northstar_config').upsert(payload, { onConflict: 'company_id' })
  if (error) throw new Error(error.message || 'Failed to save Northstar framework')
  return getNorthstarFramework(companyId)
}

export async function upsertNorthstarConfig(
  companyId: number,
  patch: Partial<Pick<KyiNorthstarConfig, 'strategy_priorities' | 'ideal_profile_traits' | 'strategy_notes'>>,
): Promise<KyiNorthstarConfig> {
  await saveNorthstarFramework(companyId, patch)
  return getNorthstarConfig(companyId)
}

export async function seedCompanyNorthstarDefaults(companyId: number): Promise<void> {
  if (!isSupabaseConfigured) return
  await assertCompanyInOrg(companyId)

  const framework = buildDefaultFramework(companyId)
  await supabase.from('kyi_northstar_config').upsert(
    {
      company_id: companyId,
      strategy_priorities: framework.strategy_priorities,
      ideal_profile_traits: framework.ideal_profile_traits,
      strategy_notes: framework.strategy_notes,
      pipeline_stages: framework.pipeline_stages,
      scorecard_criteria: framework.scorecard_criteria,
      due_diligence_questions: framework.due_diligence_questions,
      tiers: framework.tiers,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id', ignoreDuplicates: true },
  )

  const { count } = await supabase
    .from('kyi_company_investor_categories')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)

  if ((count ?? 0) > 0) return

  const { data: templates } = await supabase
    .from('kyi_investor_type_profiles')
    .select('*')
    .order('sort_order', { ascending: true })

  if (!templates?.length) return

  const rows = templates.map((p, i) => ({
    company_id: companyId,
    type: p.type as string,
    slug: (p.slug as string | null) ?? null,
    description: (p.description as string | null) ?? null,
    motivations: (p.motivations as string | null) ?? null,
    cares_about: (p.cares_about as string | null) ?? null,
    decision_drivers: (p.decision_drivers as string | null) ?? null,
    red_flags: (p.red_flags as string | null) ?? null,
    messaging_approach: (p.messaging_approach as string | null) ?? null,
    outreach_angle: (p.outreach_angle as string | null) ?? null,
    category_fields: Array.isArray(p.category_fields) ? p.category_fields : [],
    sort_order: (p.sort_order as number) ?? i,
    is_active: true,
  }))

  await supabase.from('kyi_company_investor_categories').insert(rows)
}

export async function getCompanyInvestorCategories(companyId: number): Promise<KyiCompanyInvestorCategory[]> {
  if (!isSupabaseConfigured) return []
  await assertCompanyInOrg(companyId)
  await seedCompanyNorthstarDefaults(companyId)

  const { data, error } = await supabase
    .from('kyi_company_investor_categories')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    if (isMissingNorthstarColumn(error)) return []
    throw new Error(error.message || 'Failed to load investor categories')
  }

  return (data ?? []).map((row) => mapCategoryRow(row as Record<string, unknown>))
}

export async function createCompanyInvestorCategory(
  companyId: number,
  data: {
    type: string
    description?: string
    motivations?: string
    cares_about?: string
    decision_drivers?: string
    red_flags?: string
    messaging_approach?: string
    outreach_angle?: string
    category_fields?: string[]
  },
): Promise<KyiCompanyInvestorCategory> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  await assertCompanyInOrg(companyId)
  await seedCompanyNorthstarDefaults(companyId)

  const { count } = await supabase
    .from('kyi_company_investor_categories')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)

  const now = new Date().toISOString()
  const { data: row, error } = await supabase
    .from('kyi_company_investor_categories')
    .insert({
      company_id: companyId,
      type: data.type.trim(),
      slug: slugifyKey(data.type),
      description: data.description?.trim() || null,
      motivations: data.motivations?.trim() || null,
      cares_about: data.cares_about?.trim() || null,
      decision_drivers: data.decision_drivers?.trim() || null,
      red_flags: data.red_flags?.trim() || null,
      messaging_approach: data.messaging_approach?.trim() || null,
      outreach_angle: data.outreach_angle?.trim() || null,
      category_fields: data.category_fields ?? ['partner', 'website', 'notes', 'current_status'],
      sort_order: count ?? 0,
      is_active: true,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message || 'Failed to create category')
  return mapCategoryRow(row as Record<string, unknown>)
}

export async function updateCompanyInvestorCategory(
  categoryId: number,
  patch: Partial<Omit<KyiCompanyInvestorCategory, 'id' | 'company_id'>>,
): Promise<void> {
  if (!isSupabaseConfigured) return
  const { data: existing, error: loadErr } = await supabase
    .from('kyi_company_investor_categories')
    .select('company_id')
    .eq('id', categoryId)
    .maybeSingle()
  if (loadErr) throw new Error(loadErr.message || 'Failed to load category')
  if (!existing) throw new Error('Category not found in your organization')
  await assertCompanyInOrg(existing.company_id as number)

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.type !== undefined) {
    payload.type = patch.type.trim()
    payload.slug = slugifyKey(patch.type)
  }
  if (patch.description !== undefined) payload.description = patch.description
  if (patch.motivations !== undefined) payload.motivations = patch.motivations
  if (patch.cares_about !== undefined) payload.cares_about = patch.cares_about
  if (patch.decision_drivers !== undefined) payload.decision_drivers = patch.decision_drivers
  if (patch.red_flags !== undefined) payload.red_flags = patch.red_flags
  if (patch.messaging_approach !== undefined) payload.messaging_approach = patch.messaging_approach
  if (patch.outreach_angle !== undefined) payload.outreach_angle = patch.outreach_angle
  if (patch.category_fields !== undefined) payload.category_fields = patch.category_fields
  if (patch.sort_order !== undefined) payload.sort_order = patch.sort_order
  if (patch.is_active !== undefined) payload.is_active = patch.is_active

  const { error } = await supabase.from('kyi_company_investor_categories').update(payload).eq('id', categoryId)
  if (error) throw new Error(error.message || 'Failed to update category')
}

export async function deleteCompanyInvestorCategory(categoryId: number): Promise<void> {
  if (!isSupabaseConfigured) return
  const { data: existing, error: loadErr } = await supabase
    .from('kyi_company_investor_categories')
    .select('company_id')
    .eq('id', categoryId)
    .maybeSingle()
  if (loadErr) throw new Error(loadErr.message || 'Failed to load category')
  if (!existing) throw new Error('Category not found in your organization')
  await assertCompanyInOrg(existing.company_id as number)

  const { error } = await supabase
    .from('kyi_company_investor_categories')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', categoryId)
  if (error) throw new Error(error.message || 'Failed to remove category')
}

export async function getNorthstarInvestors(companyId: number): Promise<KyiNorthstarInvestor[]> {
  if (!isSupabaseConfigured) return []
  const orgId = await assertCompanyInOrg(companyId)

  const { data, error } = await supabase
    .from('kyi_investors')
    .select('*')
    .eq('company_id', companyId)
    .eq('organization_id', orgId)
    .order('northstar_tier', { ascending: true, nullsFirst: false })
    .order('full_name', { ascending: true })

  if (error) {
    if (isMissingNorthstarColumn(error)) return []
    throw new Error(error.message || 'Failed to load Northstar investors')
  }

  return (data ?? []).map(mapNorthstarInvestorRow)
}

export async function getNorthstarPipelineSummary(companyId: number): Promise<KyiNorthstarPipelineSummary> {
  const investors = await getNorthstarInvestors(companyId)
  const by_stage: Record<string, number> = {}
  const by_tier: Record<string, number> = {}
  let scoreSum = 0
  let scoreCount = 0

  for (const inv of investors) {
    const stage = inv.northstar_pipeline_stage ?? 'research'
    by_stage[stage] = (by_stage[stage] ?? 0) + 1
    if (inv.northstar_tier != null) {
      by_tier[String(inv.northstar_tier)] = (by_tier[String(inv.northstar_tier)] ?? 0) + 1
    }
    if (inv.score_total > 0) {
      scoreSum += inv.score_total
      scoreCount++
    }
  }

  return {
    total: investors.length,
    by_stage,
    by_tier,
    avg_score: scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : null,
  }
}

export async function updateInvestorNorthstar(
  investorId: number,
  patch: Partial<{
    investor_type: string | null
    northstar_tier: NorthstarTier | null
    northstar_pipeline_stage: string | null
    northstar_probability: number | null
    northstar_warm_intro: boolean | null
    northstar_last_contact_at: string | null
    northstar_next_step: string | null
    northstar_scorecard: NorthstarScorecard
    northstar_category_fields: Record<string, string>
    northstar_due_diligence: NorthstarDueDiligence
    notes: string | null
    profile_url: string | null
    firm: string | null
    title: string | null
  }>,
): Promise<void> {
  if (!isSupabaseConfigured) return
  const { orgId } = await assertInvestorInOrg(investorId)
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.investor_type !== undefined) payload.investor_type = patch.investor_type
  if (patch.northstar_tier !== undefined) payload.northstar_tier = patch.northstar_tier
  if (patch.northstar_pipeline_stage !== undefined) payload.northstar_pipeline_stage = patch.northstar_pipeline_stage
  if (patch.northstar_probability !== undefined) payload.northstar_probability = patch.northstar_probability
  if (patch.northstar_warm_intro !== undefined) payload.northstar_warm_intro = patch.northstar_warm_intro
  if (patch.northstar_last_contact_at !== undefined) payload.northstar_last_contact_at = patch.northstar_last_contact_at
  if (patch.northstar_next_step !== undefined) payload.northstar_next_step = patch.northstar_next_step
  if (patch.northstar_scorecard !== undefined) payload.northstar_scorecard = patch.northstar_scorecard
  if (patch.northstar_category_fields !== undefined) payload.northstar_category_fields = patch.northstar_category_fields
  if (patch.northstar_due_diligence !== undefined) payload.northstar_due_diligence = patch.northstar_due_diligence
  if (patch.notes !== undefined) payload.notes = patch.notes
  if (patch.profile_url !== undefined) payload.profile_url = patch.profile_url
  if (patch.firm !== undefined) payload.firm = patch.firm
  if (patch.title !== undefined) payload.title = patch.title

  const { error } = await supabase
    .from('kyi_investors')
    .update(payload)
    .eq('id', investorId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message || 'Failed to update investor Northstar data')
}

export async function getInvestorMeetings(investorId: number): Promise<KyiInvestorMeeting[]> {
  if (!isSupabaseConfigured) return []
  await assertInvestorInOrg(investorId)
  const { data, error } = await supabase
    .from('kyi_investor_meetings')
    .select('*')
    .eq('investor_id', investorId)
    .order('meeting_date', { ascending: false, nullsFirst: false })

  if (error) {
    if (isMissingNorthstarColumn(error)) return []
    throw new Error(error.message || 'Failed to load meetings')
  }

  return (data ?? []).map((row) => ({
    id: row.id as number,
    investor_id: row.investor_id as number,
    company_id: row.company_id as number,
    meeting_date: (row.meeting_date as string | null) ?? null,
    attendees: (row.attendees as string | null) ?? null,
    key_discussion_points: (row.key_discussion_points as string | null) ?? null,
    questions_asked: (row.questions_asked as string | null) ?? null,
    concerns_raised: (row.concerns_raised as string | null) ?? null,
    follow_up_items: (row.follow_up_items as string | null) ?? null,
    overall_impression: (row.overall_impression as string | null) ?? null,
    likelihood_of_investment: (row.likelihood_of_investment as string | null) ?? null,
    next_meeting_date: (row.next_meeting_date as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }))
}

export async function createInvestorMeeting(
  data: Omit<KyiInvestorMeeting, 'id' | 'created_at' | 'updated_at'>,
): Promise<KyiInvestorMeeting> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  await assertInvestorInOrg(data.investor_id)
  await assertCompanyInOrg(data.company_id)
  const now = new Date().toISOString()
  const { data: row, error } = await supabase
    .from('kyi_investor_meetings')
    .insert({ ...data, created_at: now, updated_at: now })
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Failed to create meeting')
  return {
    id: row.id as number,
    investor_id: row.investor_id as number,
    company_id: row.company_id as number,
    meeting_date: (row.meeting_date as string | null) ?? null,
    attendees: (row.attendees as string | null) ?? null,
    key_discussion_points: (row.key_discussion_points as string | null) ?? null,
    questions_asked: (row.questions_asked as string | null) ?? null,
    concerns_raised: (row.concerns_raised as string | null) ?? null,
    follow_up_items: (row.follow_up_items as string | null) ?? null,
    overall_impression: (row.overall_impression as string | null) ?? null,
    likelihood_of_investment: (row.likelihood_of_investment as string | null) ?? null,
    next_meeting_date: (row.next_meeting_date as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function deleteInvestorMeeting(meetingId: number): Promise<void> {
  if (!isSupabaseConfigured) return
  const { data: existing, error: loadErr } = await supabase
    .from('kyi_investor_meetings')
    .select('investor_id')
    .eq('id', meetingId)
    .maybeSingle()
  if (loadErr) throw new Error(loadErr.message || 'Failed to load meeting')
  if (!existing) throw new Error('Meeting not found in your organization')
  await assertInvestorInOrg(existing.investor_id as number)

  const { error } = await supabase.from('kyi_investor_meetings').delete().eq('id', meetingId)
  if (error) throw new Error(error.message || 'Failed to delete meeting')
}

export function buildNorthstarCsvTemplate(): string {
  const sample = [
    'Acme Ventures',
    'Acme Capital',
    'Jane Smith',
    'https://acme.vc',
    'SaaS / B2B Software Investors',
    '1',
    'research',
    '25',
    'yes',
    '2026-06-01',
    'Request warm intro via John',
    'Researching',
    '$500K-$2M',
    'SaaS Co, Workflow Inc',
    'Strong SaaS portfolio + SMB focus',
    '',
    '4',
    '3',
    '5',
    '4',
    '3',
    '4',
    '5',
    '4',
    '4',
    '5',
    '4',
  ]
  return [NORTHSTAR_CSV_HEADERS.join(','), sample.join(',')].join('\n')
}

export function downloadNorthstarCsvTemplate(): void {
  const blob = new Blob([buildNorthstarCsvTemplate()], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'kyi-northstar-investors-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

/** Import a single Northstar row (used by kyi-file-import). */
export async function importNorthstarInvestorRow(
  companyId: number,
  row: Record<string, string>,
): Promise<void> {
  const name = (row.name ?? row.display_name ?? '').trim()
  if (!name) throw new Error('Missing investor name')

  const framework = await getNorthstarFramework(companyId)
  const scorecard: Record<string, number> = {}
  for (const c of framework.scorecard_criteria) {
    const raw = row[`score_${c.key}`] ?? row[c.key]
    if (raw) {
      const n = parseInt(raw, 10)
      if (n >= 1 && n <= 5) scorecard[c.key] = n
    }
  }

  const categoryFields: Record<string, string> = {}
  for (const key of Object.keys(NORTHSTAR_CATEGORY_FIELD_LABELS)) {
    if (row[key]?.trim()) categoryFields[key] = row[key].trim()
  }
  if (row.partner?.trim()) categoryFields.partner = row.partner.trim()
  if (row.website?.trim()) categoryFields.website = row.website.trim()

  const tierRaw = row.tier?.trim()
  const tier = tierRaw ? (parseInt(tierRaw, 10) as NorthstarTier) : null
  const probRaw = row.probability?.trim()
  const probability = probRaw ? parseInt(probRaw, 10) : null
  const warmRaw = (row.warm_intro ?? '').trim().toLowerCase()
  const warmIntro = warmRaw ? ['yes', 'y', 'true', '1'].includes(warmRaw) : null

  const created = await createInvestor({
    company_id: companyId,
    full_name: name,
    firm: row.firm?.trim() || undefined,
    title: row.partner?.trim() || undefined,
    profile_url: row.website?.trim() || undefined,
    notes: row.notes?.trim() || row.why_fit?.trim() || undefined,
    user_role_classification: 'investor',
    admin_override_investor_role: true,
    segment_type: 'targeted_investor',
  })

  const defaultStage = framework.pipeline_stages[0]?.value ?? 'research'
  await updateInvestorNorthstar(created.id, {
    investor_type: row.category?.trim() || null,
    northstar_tier: tier && tier >= 1 && tier <= 3 ? tier : null,
    northstar_pipeline_stage: row.pipeline_stage?.trim() || defaultStage,
    northstar_probability: probability != null && !Number.isNaN(probability) ? probability : null,
    northstar_warm_intro: warmIntro,
    northstar_last_contact_at: row.last_contact?.trim() ? new Date(row.last_contact).toISOString() : null,
    northstar_next_step: row.next_step?.trim() || null,
    northstar_scorecard: scorecard,
    northstar_category_fields: {
      ...categoryFields,
      current_status: row.current_status?.trim() || categoryFields.current_status || '',
      average_check: row.average_check?.trim() || categoryFields.average_check || '',
      portfolio_companies: row.portfolio_companies?.trim() || categoryFields.portfolio_companies || '',
      why_fit: row.why_fit?.trim() || categoryFields.why_fit || '',
    },
  })
}
