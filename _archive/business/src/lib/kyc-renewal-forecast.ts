/**
 * Renewal forecast — probability band grounded in visible factors (KYC doc Phase 3).
 */

import type { KycRiskLevel } from './kyc-client-scoring'
import type { UsageTrendFlags } from './kyc-usage-trends'
import type { ContactIntelSummary } from './kyc-contact-intel'

export type RenewalProbabilityBand = 'likely' | 'uncertain' | 'at_risk'

export interface KycRenewalForecast {
  probability_band: RenewalProbabilityBand
  probability_percent: number
  reasons: string[]
}

export interface RenewalForecastInput {
  renewal_risk: KycRiskLevel
  renewal_risk_reasons: string[]
  health_score: number
  days_until_renewal: number | null
  trends: UsageTrendFlags
  contacts: ContactIntelSummary
}

export function computeRenewalForecast(input: RenewalForecastInput): KycRenewalForecast {
  const reasons = [...input.renewal_risk_reasons]
  let riskPoints = 0

  if (input.renewal_risk === 'high') riskPoints += 40
  else if (input.renewal_risk === 'medium') riskPoints += 22
  else riskPoints += 8

  if (input.health_score < 40) riskPoints += 20
  else if (input.health_score < 55) riskPoints += 12
  else if (input.health_score >= 75) riskPoints -= 10

  if (input.trends.declining_portal_usage) {
    riskPoints += 12
    if (!reasons.some((r) => r.includes('declined'))) {
      reasons.push('Portal usage trend is declining')
    }
  }
  if (input.trends.meeting_activity_low && (input.days_until_renewal ?? 999) <= 90) {
    riskPoints += 8
    reasons.push('No recent meeting activity before renewal')
  }
  if (input.contacts.no_executive_touchpoint_60d) {
    riskPoints += 10
    if (!reasons.some((r) => r.includes('executive') || r.includes('decision-maker'))) {
      reasons.push('No recent executive touchpoint')
    }
  }
  if (input.contacts.has_negative_sentiment) {
    riskPoints += 10
    reasons.push('Negative contact sentiment on file')
  }

  const probability_percent = Math.max(5, Math.min(95, 100 - riskPoints))

  let probability_band: RenewalProbabilityBand = 'uncertain'
  if (probability_percent >= 70) probability_band = 'likely'
  else if (probability_percent < 45) probability_band = 'at_risk'

  return {
    probability_band,
    probability_percent,
    reasons: [...new Set(reasons)].slice(0, 6),
  }
}
