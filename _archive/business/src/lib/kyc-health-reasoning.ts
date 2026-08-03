/**
 * Explainable health reasoning — positive/negative factors per KYC doc §2.
 */

import { KYC_SIGNAL_LABELS, type KycClientSignals, type HealthBreakdownItem } from './kyc-client-scoring'

export interface KycHealthReasoning {
  positive: string[]
  negative: string[]
}

const POSITIVE_SIGNAL_KEYS = new Set([
  'nps_promoter',
  'high_feature_usage',
  'active_wfm_jobs',
  'recent_job_completed',
  'open_deal',
  'icp_industry_match',
  'icp_geo_match',
  'icp_deal_size_match',
  'icp_account_type_match',
  'expansion_news',
  'funding_news',
  'improving_engagement',
  'user_growth',
  'hiring_activity',
  'new_location',
])

const NEGATIVE_SIGNAL_KEYS = new Set([
  'nps_detractor',
  'low_portal_engagement',
  'support_ticket_spike',
  'open_support_tickets',
  'no_contact_30d',
  'no_contact_60d',
  'missing_decision_maker',
  'missing_primary_contact',
  'invoice_overdue',
  'overdue_cs_tasks',
  'contraction_news',
  'declining_portal_usage',
  'low_feature_adoption',
  'negative_contact_sentiment',
  'blocker_contact_present',
  'no_executive_touchpoint',
  'meeting_activity_low',
  'email_engagement_low',
])

export function buildHealthReasoning(
  signals: KycClientSignals,
  breakdown: HealthBreakdownItem[],
): KycHealthReasoning {
  const positive: string[] = []
  const negative: string[] = []

  for (const item of breakdown) {
    if (item.sentiment === 'positive' && item.contribution > 0) {
      positive.push(`Strong ${item.label.toLowerCase()} (${item.contribution} pts)`)
    }
    if (item.sentiment === 'negative') {
      negative.push(`Weak ${item.label.toLowerCase()} (${item.contribution} pts)`)
    }
  }

  for (const key of Object.keys(signals)) {
    if (signals[key] !== true) continue
    const label = KYC_SIGNAL_LABELS[key]?.label
    if (!label) continue
    if (POSITIVE_SIGNAL_KEYS.has(key)) positive.push(label)
    if (NEGATIVE_SIGNAL_KEYS.has(key)) negative.push(label)
  }

  if (signals.renewal_within_90d && !signals.renewal_within_30d) {
    negative.push('Renewal approaching within 90 days')
  }

  return {
    positive: [...new Set(positive)].slice(0, 6),
    negative: [...new Set(negative)].slice(0, 6),
  }
}
