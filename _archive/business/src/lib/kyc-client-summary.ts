/**
 * Know Your Customer — executive summary (template + context for AI).
 * Summaries must only use provided account data — no invented revenue figures.
 */

export interface KycSummaryIntelInput {
  status: string
  health_score: number
  renewal_risk: string
  renewal_risk_reasons: string[]
  expansion_likelihood: string
  expansion_reasons: string[]
  top_signals: string[]
  primary_action: { label: string; reason: string; priority: string } | null
}

export interface KycSummaryContext {
  client_name: string
  industry: string
  status: string
  health_score: number
  renewal_risk: string
  renewal_risk_reasons: string[]
  expansion_likelihood: string
  expansion_reasons: string[]
  top_signals: string[]
  primary_action: { label: string; reason: string; priority: string } | null
  last_contact_date: string | null
  renewal_date: string | null
}

export type KycSummarySource = 'cached' | 'template' | 'ai'

const SIGNAL_LABELS: Record<string, string> = {
  nps_promoter: 'NPS Promoter',
  nps_detractor: 'NPS Detractor',
  high_feature_usage: 'High Feature Use',
  low_portal_engagement: 'Low Portal Use',
  open_deal: 'Open Deal',
  active_wfm_jobs: 'Active Field Jobs',
  recent_job_completed: 'Recent Job Done',
  icp_industry_match: 'ICP Industry Match',
  icp_geo_match: 'ICP Geo Match',
}

function statusPhrase(status: string): string {
  switch (status) {
    case 'healthy':
      return 'healthy'
    case 'at-risk':
      return 'at-risk'
    case 'moderate':
      return 'moderate-health'
    default:
      return status.replace('-', ' ')
  }
}

function signalLabels(keys: string[]): string[] {
  return keys.map((key) => SIGNAL_LABELS[key] ?? key.replace(/_/g, ' ')).filter(Boolean)
}

export function buildKycSummaryContext(
  client: {
    name: string
    industry: string
    last_contact_date: string | null
    renewal_date: string | null
  },
  intel: KycSummaryIntelInput,
): KycSummaryContext {
  return {
    client_name: client.name,
    industry: client.industry || 'Unknown industry',
    status: intel.status,
    health_score: intel.health_score,
    renewal_risk: intel.renewal_risk,
    expansion_likelihood: intel.expansion_likelihood,
    renewal_risk_reasons: intel.renewal_risk_reasons,
    expansion_reasons: intel.expansion_reasons,
    top_signals: intel.top_signals,
    primary_action: intel.primary_action,
    last_contact_date: client.last_contact_date || null,
    renewal_date: client.renewal_date || null,
  }
}

export function buildSummaryContextHash(ctx: KycSummaryContext): string {
  const payload = JSON.stringify({
    status: ctx.status,
    health_score: ctx.health_score,
    renewal_risk: ctx.renewal_risk,
    expansion_likelihood: ctx.expansion_likelihood,
    renewal_risk_reasons: ctx.renewal_risk_reasons,
    expansion_reasons: ctx.expansion_reasons,
    top_signals: ctx.top_signals,
    primary_action: ctx.primary_action,
    last_contact_date: ctx.last_contact_date,
    renewal_date: ctx.renewal_date,
  })
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    hash = (hash << 5) - hash + payload.charCodeAt(i)
    hash |= 0
  }
  return `kyc-${Math.abs(hash)}`
}

export function buildTemplateClientSummary(ctx: KycSummaryContext): string {
  const parts: string[] = [
    `${ctx.client_name} is a ${statusPhrase(ctx.status)} account with a health score of ${ctx.health_score}.`,
  ]

  const positives = ctx.expansion_reasons.filter((r) => !r.includes('must improve') && !r.includes('before upsell'))
  if (positives.length > 0) {
    parts.push(`Positive indicators include ${positives.slice(0, 2).join(' and ').toLowerCase()}.`)
  } else {
    const positiveSignals = signalLabels(ctx.top_signals).filter((label) =>
      /promoter|high feature|open deal|icp|active field|recent job/i.test(label),
    )
    if (positiveSignals.length > 0) {
      parts.push(`The account shows ${positiveSignals.slice(0, 2).join(' and ').toLowerCase()}.`)
    }
  }

  if (ctx.renewal_risk_reasons.length > 0) {
    parts.push(
      `Renewal risk is ${ctx.renewal_risk} because ${ctx.renewal_risk_reasons.slice(0, 2).join(' and ').toLowerCase()}.`,
    )
  } else if (ctx.renewal_risk === 'low') {
    parts.push('No immediate renewal risk factors are visible from current account data.')
  }

  if (ctx.primary_action) {
    parts.push(
      `Recommended next step: ${ctx.primary_action.label.toLowerCase()} — ${ctx.primary_action.reason.toLowerCase()}.`,
    )
  } else {
    parts.push('Continue proactive engagement and monitor adoption signals before the next renewal cycle.')
  }

  if (ctx.expansion_likelihood === 'low') {
    parts.push('Do not push expansion yet — adoption and relationship signals do not support an upsell recommendation.')
  }

  return parts.join(' ')
}
