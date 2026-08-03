/**
 * Know Your Customer (KYC) — signal scoring and health breakdown.
 * Pattern mirrors kyi-lead-scoring.ts: boolean signals → weighted score + explainability.
 */

import { computeClientMetrics, type ClientStatus } from './customer-success-api'
import type { KycHealthReasoning } from './kyc-health-reasoning'
import type { KycRenewalForecast } from './kyc-renewal-forecast'
import type { KycSignalPlay } from './kyc-signal-plays'
import {
  applyKycActionMitigations,
  filterSuggestedActionsForKycTasks,
  type KycActionTaskStatus,
} from './kyc-action-resolution'

// ==================== SIGNAL TYPES ====================

export type KycClientSignals = Record<string, unknown> & {
  nps_promoter?: boolean
  nps_detractor?: boolean
  open_support_tickets?: boolean
  support_ticket_spike?: boolean
  no_contact_30d?: boolean
  no_contact_60d?: boolean
  renewal_within_90d?: boolean
  renewal_within_30d?: boolean
  overdue_cs_tasks?: boolean
  active_wfm_jobs?: boolean
  recent_job_completed?: boolean
  low_portal_engagement?: boolean
  high_feature_usage?: boolean
  open_deal?: boolean
  contract_expiring?: boolean
  invoice_overdue?: boolean
  missing_primary_contact?: boolean
  missing_decision_maker?: boolean
  declining_portal_usage?: boolean
  improving_engagement?: boolean
  low_feature_adoption?: boolean
  negative_contact_sentiment?: boolean
  blocker_contact_present?: boolean
  no_executive_touchpoint?: boolean
  user_growth?: boolean
  meeting_activity_low?: boolean
  email_engagement_low?: boolean
}

export const KYC_SIGNAL_LABELS: Record<
  string,
  { label: string; category: string; color: string; sentiment: 'positive' | 'negative' | 'neutral' }
> = {
  nps_promoter: { label: 'NPS Promoter', category: 'Engagement', color: 'green', sentiment: 'positive' },
  nps_detractor: { label: 'NPS Detractor', category: 'Engagement', color: 'red', sentiment: 'negative' },
  open_support_tickets: { label: 'Open Support', category: 'Support', color: 'orange', sentiment: 'negative' },
  support_ticket_spike: { label: 'Support Spike', category: 'Support', color: 'red', sentiment: 'negative' },
  no_contact_30d: { label: 'No Contact 30d+', category: 'Relationship', color: 'amber', sentiment: 'negative' },
  no_contact_60d: { label: 'No Contact 60d+', category: 'Relationship', color: 'red', sentiment: 'negative' },
  renewal_within_90d: { label: 'Renewal ≤90d', category: 'Renewal', color: 'amber', sentiment: 'neutral' },
  renewal_within_30d: { label: 'Renewal ≤30d', category: 'Renewal', color: 'orange', sentiment: 'neutral' },
  overdue_cs_tasks: { label: 'Overdue Tasks', category: 'Success', color: 'red', sentiment: 'negative' },
  active_wfm_jobs: { label: 'Active Field Jobs', category: 'Operations', color: 'blue', sentiment: 'positive' },
  recent_job_completed: { label: 'Recent Job Done', category: 'Operations', color: 'green', sentiment: 'positive' },
  low_portal_engagement: { label: 'Low Portal Use', category: 'Engagement', color: 'amber', sentiment: 'negative' },
  high_feature_usage: { label: 'High Feature Use', category: 'Engagement', color: 'green', sentiment: 'positive' },
  open_deal: { label: 'Open Deal', category: 'Revenue', color: 'blue', sentiment: 'positive' },
  contract_expiring: { label: 'Contract Expiring', category: 'Renewal', color: 'orange', sentiment: 'negative' },
  invoice_overdue: { label: 'Invoice Overdue', category: 'Revenue', color: 'red', sentiment: 'negative' },
  missing_primary_contact: { label: 'No Primary Contact', category: 'Contacts', color: 'amber', sentiment: 'negative' },
  missing_decision_maker: { label: 'No Decision Maker', category: 'Contacts', color: 'amber', sentiment: 'negative' },
  icp_industry_match: { label: 'ICP Industry Match', category: 'Fit', color: 'green', sentiment: 'positive' },
  icp_geo_match: { label: 'ICP Geo Match', category: 'Fit', color: 'green', sentiment: 'positive' },
  icp_deal_size_match: { label: 'ICP Deal Size', category: 'Fit', color: 'green', sentiment: 'positive' },
  icp_account_type_match: { label: 'ICP Account Type', category: 'Fit', color: 'green', sentiment: 'positive' },
  declining_portal_usage: { label: 'Declining Portal Use', category: 'Engagement', color: 'red', sentiment: 'negative' },
  improving_engagement: { label: 'Improving Engagement', category: 'Engagement', color: 'green', sentiment: 'positive' },
  low_feature_adoption: { label: 'Low Feature Adoption', category: 'Engagement', color: 'amber', sentiment: 'negative' },
  negative_contact_sentiment: { label: 'Negative Sentiment', category: 'Relationship', color: 'red', sentiment: 'negative' },
  blocker_contact_present: { label: 'Blocker Contact', category: 'Relationship', color: 'red', sentiment: 'negative' },
  no_executive_touchpoint: { label: 'No Executive Touch', category: 'Relationship', color: 'amber', sentiment: 'negative' },
  user_growth: { label: 'User Growth', category: 'Engagement', color: 'green', sentiment: 'positive' },
  meeting_activity_low: { label: 'Low Meeting Activity', category: 'Relationship', color: 'amber', sentiment: 'negative' },
  email_engagement_low: { label: 'Low Email Engagement', category: 'Relationship', color: 'amber', sentiment: 'negative' },
}

/** Attention priority weights — higher = needs CSM attention sooner. */
export const KYC_ATTENTION_WEIGHTS: Record<string, number> = {
  nps_detractor: 12,
  support_ticket_spike: 15,
  no_contact_60d: 14,
  no_contact_30d: 8,
  renewal_within_30d: 18,
  renewal_within_90d: 10,
  overdue_cs_tasks: 10,
  invoice_overdue: 12,
  contract_expiring: 11,
  missing_primary_contact: 6,
  missing_decision_maker: 5,
  open_support_tickets: 6,
  low_portal_engagement: 4,
  declining_portal_usage: 10,
  low_feature_adoption: 7,
  negative_contact_sentiment: 9,
  blocker_contact_present: 11,
  no_executive_touchpoint: 8,
  meeting_activity_low: 5,
  email_engagement_low: 4,
}

export const KYC_LEAD_FIT_WEIGHTS: Record<string, number> = {
  icp_industry_match: 30,
  icp_geo_match: 20,
  icp_deal_size_match: 15,
  icp_account_type_match: 10,
}

export const KYC_FIT_REFERENCE_MAX = 75

// ==================== INPUT TYPES ====================

export interface KycIcpProfile {
  target_industries: string[]
  target_states: string[]
  target_countries: string[]
  preferred_account_types: string[]
  min_deal_size: number
  sector_tags: string[]
  description: string
}

export interface KycClientSignalInput {
  nps_score: number
  engagement_score: number
  support_tickets: number
  last_contact_date: string | null
  feature_usage?: string | null
  portal_logins?: number
  renewal_date: string | null
  industry?: string | null
  state?: string | null
  country?: string | null
  account_type?: string | null
  arr?: number
  overdue_task_count?: number
  active_wfm_job_count?: number
  completed_wfm_job_count_30d?: number
  open_deal_count?: number
  contract_expiring_90d?: boolean
  invoice_overdue?: boolean
  has_primary_contact?: boolean
  has_decision_maker?: boolean
  declining_portal_usage?: boolean
  improving_engagement?: boolean
  user_growth?: boolean
  meeting_activity_low?: boolean
  email_engagement_low?: boolean
  negative_contact_sentiment?: boolean
  blocker_contact_present?: boolean
  no_executive_touchpoint?: boolean
  relationship_strength_score?: number
  icp_fit_percent?: number
  /** KYC actions already completed via linked CS tasks */
  completed_kyc_action_ids?: string[]
  /** KYC actions with open (active/overdue) CS tasks — hide duplicate recommendations */
  open_kyc_action_ids?: string[]
}

export interface KycLeadSignalInput {
  industry?: string | null
  state?: string | null
  country?: string | null
  account_type?: string | null
  company_name?: string | null
  estimated_deal_size?: number
}

export interface HealthBreakdownItem {
  key: string
  label: string
  component_score: number
  weight: number
  contribution: number
  sentiment: 'positive' | 'negative' | 'neutral'
}

export type KycRiskLevel = 'low' | 'medium' | 'high'

export interface ClientIntelligenceResult {
  signals: KycClientSignals
  health_score: number
  status: ClientStatus
  churn_risk: number
  attention_score: number
  health_breakdown: HealthBreakdownItem[]
  top_signals: string[]
  renewal_risk: KycRiskLevel
  renewal_risk_reasons: string[]
  expansion_likelihood: KycRiskLevel
  expansion_reasons: string[]
  primary_action: KycSuggestedAction | null
  health_reasoning: KycHealthReasoning
  signal_plays: KycSignalPlay[]
  renewal_forecast?: KycRenewalForecast
  /** Per-action task state from linked CS tasks */
  kyc_action_task_status?: Record<string, 'open' | 'completed'>
}

// ==================== HELPERS ====================

function normalizeList(values: (string | null | undefined)[]): string[] {
  return values
    .flatMap((v) => (v ?? '').split(/[,;|/]+/))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const t = new Date(dateStr).getTime()
  if (isNaN(t)) return null
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000))
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const t = new Date(dateStr).getTime()
  if (isNaN(t)) return null
  return Math.floor((t - Date.now()) / (24 * 60 * 60 * 1000))
}

function matchesIcpList(value: string | null | undefined, targets: string[]): boolean {
  const hay = (value ?? '').trim().toLowerCase()
  if (!hay || targets.length === 0) return false
  return targets.some((t) => hay.includes(t) || t.includes(hay))
}

// ==================== SIGNAL COMPUTATION ====================

export function computeClientSignals(input: KycClientSignalInput): KycClientSignals {
  const signals: KycClientSignals = {}
  const b2c = isB2CAccount(input.account_type)
  const nps = input.nps_score ?? 0
  const tickets = input.support_tickets ?? 0
  const usage = (input.feature_usage ?? '').toLowerCase()
  const logins = input.portal_logins ?? 0
  const contactDays = daysSince(input.last_contact_date)
  const renewalDays = daysUntil(input.renewal_date)

  if (nps >= 9) signals.nps_promoter = true
  if (nps > 0 && nps <= 6) signals.nps_detractor = true
  if (tickets > 0) signals.open_support_tickets = true
  if (tickets >= 3) signals.support_ticket_spike = true
  if (contactDays == null || contactDays >= 30) signals.no_contact_30d = true
  if (contactDays == null || contactDays >= 60) signals.no_contact_60d = true
  if (renewalDays != null && renewalDays >= 0 && renewalDays <= 90) signals.renewal_within_90d = true
  if (renewalDays != null && renewalDays >= 0 && renewalDays <= 30) signals.renewal_within_30d = true
  if ((input.overdue_task_count ?? 0) > 0) signals.overdue_cs_tasks = true
  if ((input.active_wfm_job_count ?? 0) > 0) signals.active_wfm_jobs = true
  if ((input.completed_wfm_job_count_30d ?? 0) > 0) signals.recent_job_completed = true
  if (logins <= 2 && usage !== 'high') signals.low_portal_engagement = true
  if (usage === 'high') signals.high_feature_usage = true
  if ((input.open_deal_count ?? 0) > 0) signals.open_deal = true
  if (input.contract_expiring_90d) signals.contract_expiring = true
  if (input.invoice_overdue) signals.invoice_overdue = true
  if (input.has_primary_contact === false) signals.missing_primary_contact = true
  // Decision-maker tracking applies to B2B accounts only
  if (!b2c && input.has_decision_maker === false) signals.missing_decision_maker = true

  if (usage === 'low' || (usage === 'medium' && logins <= 2)) signals.low_feature_adoption = true

  if (input.declining_portal_usage) signals.declining_portal_usage = true
  if (input.improving_engagement) signals.improving_engagement = true
  if (input.user_growth) signals.user_growth = true
  if (input.meeting_activity_low) signals.meeting_activity_low = true
  if (input.email_engagement_low) signals.email_engagement_low = true
  if (input.negative_contact_sentiment) signals.negative_contact_sentiment = true
  if (input.blocker_contact_present) signals.blocker_contact_present = true
  if (input.no_executive_touchpoint) signals.no_executive_touchpoint = true

  return signals
}

export function applyIcpSignalsToClient(
  signals: KycClientSignals,
  input: Pick<KycClientSignalInput, 'industry' | 'state' | 'country' | 'account_type' | 'arr'>,
  icp: KycIcpProfile | null | undefined,
): KycClientSignals {
  if (!icp) return signals
  const next = { ...signals }
  const b2c = isB2CAccount(input.account_type)
  const hasIndustryTargets = icp.target_industries.length > 0

  if (!b2c && hasIndustryTargets && matchesIcpList(input.industry, normalizeList(icp.target_industries))) {
    next.icp_industry_match = true
  }
  const geoTargets = [...icp.target_states, ...icp.target_countries].map((g) => g.toLowerCase())
  if (
    matchesIcpList(input.state, geoTargets) ||
    matchesIcpList(input.country, geoTargets)
  ) {
    next.icp_geo_match = true
  }
  const dealValue = input.arr ?? 0
  if (icp.min_deal_size > 0 && dealValue >= icp.min_deal_size) {
    next.icp_deal_size_match = true
  }
  const preferred = icp.preferred_account_types.map((t) => t.toLowerCase())
  if (preferred.length === 0 || preferred.includes((input.account_type ?? 'business').toLowerCase())) {
    next.icp_account_type_match = true
  }
  return next
}

export function computeLeadSignals(
  input: KycLeadSignalInput,
  icp: KycIcpProfile | null | undefined,
): KycClientSignals {
  const signals: KycClientSignals = {}
  if (!icp) return signals
  const b2c = isB2CAccount(input.account_type)
  const hasIndustryTargets = icp.target_industries.length > 0

  if (!b2c && hasIndustryTargets && matchesIcpList(input.industry, normalizeList(icp.target_industries))) {
    signals.icp_industry_match = true
  }
  const geoTargets = [...icp.target_states, ...icp.target_countries].map((g) => g.toLowerCase())
  if (
    matchesIcpList(input.state, geoTargets) ||
    matchesIcpList(input.country, geoTargets)
  ) {
    signals.icp_geo_match = true
  }
  const preferred = icp.preferred_account_types.map((t) => t.toLowerCase())
  if (preferred.length === 0 || preferred.includes((input.account_type ?? 'business').toLowerCase())) {
    signals.icp_account_type_match = true
  }
  if (icp.min_deal_size > 0 && (input.estimated_deal_size ?? 0) >= icp.min_deal_size) {
    signals.icp_deal_size_match = true
  }
  return signals
}

export function computeLeadFitScore(
  signals: KycClientSignals | null | undefined,
  accountType?: string | null,
): number {
  const s = signals ?? {}
  const b2c = isB2CAccount(accountType)
  let score = 0
  for (const [key, weight] of Object.entries(KYC_LEAD_FIT_WEIGHTS)) {
    if (b2c && key === 'icp_industry_match') continue
    if (s[key]) score += weight
  }
  return score
}

export function isB2CAccount(accountType?: string | null): boolean {
  return (accountType ?? 'business').toLowerCase() === 'individual'
}

export function leadFitReferenceMax(accountType?: string | null): number {
  if (isB2CAccount(accountType)) {
    return KYC_FIT_REFERENCE_MAX - (KYC_LEAD_FIT_WEIGHTS.icp_industry_match ?? 0)
  }
  return KYC_FIT_REFERENCE_MAX
}

export function leadFitToPercent(score: number, accountType?: string | null): number {
  const ref = leadFitReferenceMax(accountType)
  return Math.min(100, Math.max(0, Math.round((score / ref) * 100)))
}

export function computeAttentionScore(signals: KycClientSignals | null | undefined): number {
  const s = signals ?? {}
  let score = 0
  for (const [key, weight] of Object.entries(KYC_ATTENTION_WEIGHTS)) {
    if (s[key]) score += weight
  }
  return Math.min(100, score)
}

export function getActiveSignalKeys(signals: KycClientSignals | null | undefined): string[] {
  return Object.entries(signals ?? {})
    .filter(([key, val]) => val === true && key in KYC_SIGNAL_LABELS)
    .map(([key]) => key)
}

export function getTopSignals(
  signals: KycClientSignals | null | undefined,
  limit = 5,
): string[] {
  const keys = getActiveSignalKeys(signals)
  return keys
    .sort((a, b) => (KYC_ATTENTION_WEIGHTS[b] ?? 0) - (KYC_ATTENTION_WEIGHTS[a] ?? 0))
    .slice(0, limit)
}

// ==================== HEALTH BREAKDOWN ====================

export function getClientHealthBreakdown(client: {
  nps_score: number
  engagement_score: number
  support_tickets: number
  last_contact_date: string | null
  feature_usage?: string | null
  portal_logins?: number
  renewal_date?: string | null
  icp_fit_percent?: number
  relationship_strength_score?: number
  invoice_overdue?: boolean
}): HealthBreakdownItem[] {
  const nps = Math.min(10, Math.max(0, client.nps_score ?? 0))
  const tickets = Math.max(0, client.support_tickets ?? 0)
  const usage = (client.feature_usage ?? '').toLowerCase()
  const logins = Math.max(0, client.portal_logins ?? 0)
  const icpFit = Math.min(100, Math.max(0, client.icp_fit_percent ?? 50))
  const relationship = Math.min(100, Math.max(0, client.relationship_strength_score ?? 50))

  let daysSinceContact = 90
  if (client.last_contact_date) {
    const last = new Date(client.last_contact_date).getTime()
    if (!isNaN(last)) daysSinceContact = Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000))
  }

  const renewalDays = daysUntil(client.renewal_date)
  let renewalScore = 80
  if (renewalDays != null && renewalDays >= 0) {
    if (renewalDays <= 30) renewalScore = 25
    else if (renewalDays <= 90) renewalScore = 50
    else if (renewalDays <= 180) renewalScore = 70
  }

  const billingScore = client.invoice_overdue ? 15 : 95

  const items: HealthBreakdownItem[] = [
    {
      key: 'usage',
      label: 'Product usage',
      component_score: usage === 'high' ? 100 : usage === 'medium' ? 60 : usage === 'low' ? 25 : 50,
      weight: 0.12,
      contribution: 0,
      sentiment: usage === 'high' ? 'positive' : usage === 'low' ? 'negative' : 'neutral',
    },
    {
      key: 'portal',
      label: 'Login activity',
      component_score: Math.min(100, logins * 2),
      weight: 0.08,
      contribution: 0,
      sentiment: logins >= 5 ? 'positive' : logins === 0 ? 'negative' : 'neutral',
    },
    {
      key: 'support',
      label: 'Support tickets',
      component_score: Math.max(0, 100 - tickets * 15),
      weight: 0.12,
      contribution: 0,
      sentiment: tickets === 0 ? 'positive' : tickets >= 3 ? 'negative' : 'neutral',
    },
    {
      key: 'contact',
      label: 'Last contact',
      component_score:
        daysSinceContact <= 7 ? 100 : daysSinceContact <= 14 ? 80 : daysSinceContact <= 30 ? 60 : daysSinceContact <= 60 ? 30 : 0,
      weight: 0.12,
      contribution: 0,
      sentiment: daysSinceContact <= 14 ? 'positive' : daysSinceContact >= 30 ? 'negative' : 'neutral',
    },
    {
      key: 'renewal',
      label: 'Renewal proximity',
      component_score: renewalScore,
      weight: 0.1,
      contribution: 0,
      sentiment: renewalScore >= 70 ? 'positive' : renewalScore <= 40 ? 'negative' : 'neutral',
    },
    {
      key: 'icp',
      label: 'ICP fit',
      component_score: icpFit,
      weight: 0.1,
      contribution: 0,
      sentiment: icpFit >= 70 ? 'positive' : icpFit <= 40 ? 'negative' : 'neutral',
    },
    {
      key: 'sentiment',
      label: 'Sentiment',
      component_score: (nps / 10) * 100,
      weight: 0.12,
      contribution: 0,
      sentiment: nps >= 8 ? 'positive' : nps <= 6 ? 'negative' : 'neutral',
    },
    {
      key: 'relationship',
      label: 'Relationship strength',
      component_score: relationship,
      weight: 0.12,
      contribution: 0,
      sentiment: relationship >= 70 ? 'positive' : relationship <= 40 ? 'negative' : 'neutral',
    },
    {
      key: 'billing',
      label: 'Payment / billing',
      component_score: billingScore,
      weight: 0.12,
      contribution: 0,
      sentiment: client.invoice_overdue ? 'negative' : 'positive',
    },
  ]

  return items.map((item) => ({
    ...item,
    contribution: Math.round(item.component_score * item.weight),
  }))
}

const RENEWAL_RISK_REASONS: Record<string, string> = {
  renewal_within_30d: 'Renewal is within 30 days',
  renewal_within_90d: 'Renewal is within 90 days',
  no_contact_60d: 'No contact in 60+ days',
  no_contact_30d: 'No contact in 30+ days',
  low_portal_engagement: 'Portal usage is low',
  declining_portal_usage: 'Portal usage has declined',
  low_feature_adoption: 'Low feature adoption',
  support_ticket_spike: 'Support ticket volume has spiked',
  open_support_tickets: 'Open support tickets on file',
  missing_decision_maker: 'No decision-maker relationship on file',
  no_executive_touchpoint: 'No recent executive touchpoint',
  negative_contact_sentiment: 'Negative contact sentiment on file',
  blocker_contact_present: 'Blocker contact identified',
  invoice_overdue: 'Invoice is overdue',
  nps_detractor: 'Detractor NPS score',
  contract_expiring: 'Contract is expiring soon',
  contraction_news: 'External news suggests contraction risk',
  overdue_cs_tasks: 'Overdue customer success tasks',
  meeting_activity_low: 'No meetings in the last 30 days',
  email_engagement_low: 'No email engagement in the last 30 days',
}

const EXPANSION_POSITIVE_REASONS: Record<string, string> = {
  icp_industry_match: 'Customer matches ICP',
  icp_geo_match: 'Geography matches ICP targets',
  icp_deal_size_match: 'Deal size meets ICP threshold',
  icp_account_type_match: 'Account type matches ICP',
  high_feature_usage: 'Strong feature adoption',
  open_deal: 'Active sales opportunity',
  expansion_news: 'External signals show company growth',
  funding_news: 'Funding or investment activity detected',
  nps_promoter: 'NPS promoter — high satisfaction',
  active_wfm_jobs: 'Active field operations engagement',
  recent_job_completed: 'Recent operational activity',
  hiring_activity: 'External hiring signals detected',
  new_location: 'New location or expansion signals',
  user_growth: 'User growth detected on account',
}

const EXPANSION_NEGATIVE_REASONS: Record<string, string> = {
  low_portal_engagement: 'Low portal usage — adoption must improve first',
  nps_detractor: 'Detractor NPS — address satisfaction before upsell',
  missing_decision_maker: 'No executive sponsor identified',
  contraction_news: 'External contraction signals',
  missing_primary_contact: 'Missing primary contact on file',
}

export function computeRenewalRisk(
  signals: KycClientSignals | null | undefined,
  attentionScore: number,
  healthScore: number,
): { level: KycRiskLevel; reasons: string[] } {
  const s = signals ?? {}
  const reasons: string[] = []

  for (const key of Object.keys(RENEWAL_RISK_REASONS)) {
    if (s[key]) reasons.push(RENEWAL_RISK_REASONS[key]!)
  }

  let level: KycRiskLevel = 'low'
  if (
    attentionScore >= 30 ||
    s.renewal_within_30d ||
    s.contraction_news ||
    s.declining_portal_usage ||
    s.blocker_contact_present ||
    (s.nps_detractor && s.renewal_within_90d) ||
    (healthScore < 40 && s.renewal_within_90d)
  ) {
    level = 'high'
  } else if (
    attentionScore >= 15 ||
    s.renewal_within_90d ||
    s.no_contact_30d ||
    s.support_ticket_spike ||
    s.invoice_overdue ||
    s.low_feature_adoption ||
    s.negative_contact_sentiment ||
    s.no_executive_touchpoint ||
    healthScore < 55
  ) {
    level = 'medium'
  }

  return { level, reasons: reasons.slice(0, 6) }
}

export function computeExpansionLikelihood(
  signals: KycClientSignals | null | undefined,
): { level: KycRiskLevel; reasons: string[] } {
  const s = signals ?? {}
  const positive: string[] = []
  const negative: string[] = []

  for (const [key, reason] of Object.entries(EXPANSION_POSITIVE_REASONS)) {
    if (s[key]) positive.push(reason)
  }
  for (const [key, reason] of Object.entries(EXPANSION_NEGATIVE_REASONS)) {
    if (s[key]) negative.push(reason)
  }

  const icpMatches = [
    s.icp_industry_match,
    s.icp_geo_match,
    s.icp_deal_size_match,
    s.icp_account_type_match,
  ].filter(Boolean).length

  let level: KycRiskLevel = 'medium'
  if (
    s.contraction_news ||
    s.nps_detractor ||
    (s.low_portal_engagement && s.missing_decision_maker)
  ) {
    level = 'low'
  } else if (
    (icpMatches >= 2 && (s.high_feature_usage || s.open_deal)) ||
    s.expansion_news ||
    s.funding_news ||
    s.hiring_activity ||
    s.new_location ||
    (s.nps_promoter && s.high_feature_usage) ||
    (positive.length >= 3 && negative.length === 0)
  ) {
    level = 'high'
  } else if (positive.length === 0 || negative.length >= 2) {
    level = 'low'
  }

  const reasons = [...positive, ...negative].slice(0, 6)
  if (reasons.length === 0) {
    reasons.push('Insufficient adoption and fit signals to assess expansion readiness')
  }

  return { level, reasons }
}

export function applyAccountOverviewFields(
  intel:     Omit<
    ClientIntelligenceResult,
    | 'renewal_risk'
    | 'renewal_risk_reasons'
    | 'expansion_likelihood'
    | 'expansion_reasons'
    | 'primary_action'
    | 'health_reasoning'
    | 'signal_plays'
    | 'kyc_action_task_status'
  >,
  accountType?: string | null,
  kycTaskContext?: {
    completedActionIds?: string[]
    openActionIds?: string[]
    actionTaskStatus?: Record<string, KycActionTaskStatus>
  },
): ClientIntelligenceResult {
  const renewal = computeRenewalRisk(intel.signals, intel.attention_score, intel.health_score)
  const expansion = computeExpansionLikelihood(intel.signals)
  const actions = filterSuggestedActionsForKycTasks(buildSuggestedActions(intel.signals, accountType), {
    completedActionIds: kycTaskContext?.completedActionIds,
  })
  return {
    ...intel,
    renewal_risk: renewal.level,
    renewal_risk_reasons: renewal.reasons,
    expansion_likelihood: expansion.level,
    expansion_reasons: expansion.reasons,
    primary_action: actions[0] ?? null,
    health_reasoning: { positive: [], negative: [] },
    signal_plays: [],
    kyc_action_task_status: kycTaskContext?.actionTaskStatus,
  }
}

export function buildClientIntelligence(
  input: KycClientSignalInput,
  icp?: KycIcpProfile | null,
): ClientIntelligenceResult {
  const completedIds = input.completed_kyc_action_ids ?? []
  const openIds = input.open_kyc_action_ids ?? []
  const signalInput = applyKycCompletionToSignalInput(input, completedIds)
  const baseSignals = computeClientSignals(signalInput)
  const mitigatedBase = applyKycActionMitigations(baseSignals, completedIds)
  const signals = applyIcpSignalsToClient(mitigatedBase, input, icp)

  const icpMatches = [
    signals.icp_industry_match,
    signals.icp_geo_match,
    signals.icp_deal_size_match,
    signals.icp_account_type_match,
  ].filter(Boolean).length
  const icp_fit_percent = Math.min(100, Math.round((icpMatches / 4) * 100))

  const metrics = computeClientMetrics(signalInput)
  const health_breakdown = getClientHealthBreakdown({
    nps_score: signalInput.nps_score,
    engagement_score: signalInput.engagement_score,
    support_tickets: signalInput.support_tickets,
    last_contact_date: signalInput.last_contact_date,
    feature_usage: signalInput.feature_usage,
    portal_logins: signalInput.portal_logins,
    renewal_date: signalInput.renewal_date,
    icp_fit_percent,
    relationship_strength_score: signalInput.relationship_strength_score,
    invoice_overdue: signalInput.invoice_overdue,
  })

  const actionTaskStatus: Record<string, KycActionTaskStatus> = {}
  for (const id of completedIds) actionTaskStatus[id] = 'completed'
  for (const id of openIds) {
    if (actionTaskStatus[id] !== 'completed') actionTaskStatus[id] = 'open'
  }

  return applyAccountOverviewFields(
    {
      signals,
      health_score: metrics.health_score,
      status: metrics.status,
      churn_risk: metrics.churn_risk,
      attention_score: computeAttentionScore(signals),
      health_breakdown,
      top_signals: getTopSignals(signals),
    },
    input.account_type,
    {
      completedActionIds: completedIds,
      openActionIds: openIds,
      actionTaskStatus,
    },
  )
}

export const DEFAULT_ICP_PROFILE: KycIcpProfile = {
  target_industries: [],
  target_states: [],
  target_countries: [],
  preferred_account_types: ['business', 'individual'],
  min_deal_size: 0,
  sector_tags: [],
  description: '',
}

// ==================== SUGGESTED ACTIONS (Relationship map) ====================

export interface KycSuggestedAction {
  id: string
  label: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}

export function buildSuggestedActions(
  signals: KycClientSignals | null | undefined,
  accountType?: string | null,
): KycSuggestedAction[] {
  const s = signals ?? {}
  const b2c = isB2CAccount(accountType)
  const actions: KycSuggestedAction[] = []

  if (s.renewal_within_30d) {
    actions.push({
      id: 'renewal-urgent',
      label: 'Renewal call',
      reason: 'Contract renews within 30 days',
      priority: 'high',
    })
  } else if (s.renewal_within_90d) {
    actions.push({
      id: 'renewal-prep',
      label: 'Prepare QBR',
      reason: 'Renewal within 90 days',
      priority: 'medium',
    })
  }
  if (s.no_contact_60d) {
    actions.push({
      id: 're-engage',
      label: 'Re-engage account',
      reason: 'No contact in 60+ days',
      priority: 'high',
    })
  } else if (s.no_contact_30d) {
    actions.push({
      id: 'check-in',
      label: 'Schedule check-in',
      reason: 'No contact in 30+ days',
      priority: 'medium',
    })
  }
  if (s.support_ticket_spike) {
    actions.push({
      id: 'support-review',
      label: 'Support escalation review',
      reason: 'Elevated open support volume',
      priority: 'high',
    })
  } else if (s.open_support_tickets) {
    actions.push({
      id: 'support-followup',
      label: 'Review open tickets',
      reason: 'Active support issues',
      priority: 'medium',
    })
  }
  if (s.nps_detractor) {
    actions.push({
      id: 'nps-recovery',
      label: 'NPS recovery',
      reason: 'Detractor NPS score',
      priority: 'high',
    })
  }
  if (!b2c && s.missing_decision_maker) {
    actions.push({
      id: 'find-sponsor',
      label: 'Identify decision maker',
      reason: 'No executive sponsor on file',
      priority: 'medium',
    })
  }
  if (s.missing_primary_contact) {
    actions.push({
      id: 'add-contact',
      label: b2c ? 'Add contact details' : 'Add primary contact',
      reason: b2c ? 'Missing phone or email on file' : 'Missing primary contact',
      priority: 'medium',
    })
  }
  if (s.invoice_overdue) {
    actions.push({
      id: 'invoice-followup',
      label: 'Invoice follow-up',
      reason: 'Overdue invoice',
      priority: 'high',
    })
  }
  if (s.contract_expiring) {
    actions.push({
      id: 'contract-renew',
      label: 'Contract renewal',
      reason: 'Contract expiring soon',
      priority: 'high',
    })
  }
  if (s.open_deal) {
    actions.push({
      id: 'advance-deal',
      label: 'Advance open deal',
      reason: 'Active sales opportunity',
      priority: 'medium',
    })
  }
  if (s.low_portal_engagement || s.low_feature_adoption) {
    actions.push({
      id: 'adoption-push',
      label: s.low_feature_adoption ? 'Send product adoption guide' : 'Adoption outreach',
      reason: s.declining_portal_usage
        ? 'Portal usage is declining and adoption needs attention'
        : s.low_feature_adoption
          ? 'Low feature adoption before renewal cycle'
          : 'Low portal engagement',
      priority: s.declining_portal_usage ? 'medium' : 'low',
    })
  }
  if (s.no_executive_touchpoint && !b2c) {
    actions.push({
      id: 'executive-meeting',
      label: 'Ask for decision-maker meeting',
      reason: 'No recent executive touchpoint on file',
      priority: 'medium',
    })
  }
  if (s.negative_contact_sentiment || s.blocker_contact_present) {
    actions.push({
      id: 'sentiment-recovery',
      label: 'Escalate to CSM',
      reason: s.blocker_contact_present
        ? 'Blocker contact identified — align on value and concerns'
        : 'Negative contact sentiment requires proactive outreach',
      priority: 'high',
    })
  }
  if (s.contraction_news) {
    actions.push({
      id: 'contraction-risk',
      label: 'Churn prevention call',
      reason: 'External news suggests contraction or layoffs',
      priority: 'high',
    })
  }
  if (s.funding_news || s.expansion_news) {
    actions.push({
      id: 'expansion-opportunity',
      label: 'Expansion conversation',
      reason: 'External signals show growth or funding activity',
      priority: 'medium',
    })
  }
  if (s.leadership_news) {
    actions.push({
      id: 'leadership-outreach',
      label: 'New stakeholder outreach',
      reason: 'Leadership change detected in news',
      priority: 'medium',
    })
  }

  const order = { high: 0, medium: 1, low: 2 }
  return actions.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 8)
}

const TOUCHPOINT_COMPLETION_ACTION_IDS = [
  'renewal-urgent',
  'renewal-prep',
  're-engage',
  'check-in',
  'executive-meeting',
  'find-sponsor',
  'nps-recovery',
  'leadership-outreach',
  'expansion-opportunity',
  'contraction-risk',
] as const

export function applyKycCompletionToSignalInput(
  input: KycClientSignalInput,
  completedActionIds: string[] | null | undefined,
): KycClientSignalInput {
  const ids = completedActionIds ?? []
  if (ids.length === 0) return input

  let next: KycClientSignalInput = { ...input }
  const touchpointDone = ids.some((id) =>
    (TOUCHPOINT_COMPLETION_ACTION_IDS as readonly string[]).includes(id),
  )
  if (touchpointDone) {
    next = { ...next, last_contact_date: new Date().toISOString() }
  }
  if (ids.includes('executive-meeting')) {
    next = { ...next, no_executive_touchpoint: false }
  }
  if (ids.includes('find-sponsor')) {
    next = { ...next, has_decision_maker: true }
  }
  return next
}

export const KYC_CLIENT_OUTREACH_LABELS: Record<string, string> = {
  none: 'None',
  planned: 'Planned',
  contacted: 'Contacted',
  meeting: 'Meeting scheduled',
  completed: 'Play completed',
  at_risk: 'At risk',
}

export const KYC_LEAD_OUTREACH_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  meeting: 'Meeting',
  qualified: 'Qualified',
  passed: 'Passed',
}

export function computeLeadFitFromInput(
  input: KycLeadSignalInput,
  icp: KycIcpProfile | null | undefined,
): { signals: KycClientSignals; fit_score: number; fit_percent: number } {
  const signals = computeLeadSignals(input, icp)
  const fit_score = computeLeadFitScore(signals, input.account_type)
  return { signals, fit_score, fit_percent: leadFitToPercent(fit_score, input.account_type) }
}
