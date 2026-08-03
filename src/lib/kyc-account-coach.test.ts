import { describe, it, expect } from 'vitest'
import { buildTemplateCoachResponse, formatCoachResponse } from './kyc-account-coach'
import type { KycSummaryContext } from './kyc-client-summary'

const context: KycSummaryContext = {
  client_name: 'Acme Co',
  industry: 'Manufacturing',
  status: 'moderate',
  health_score: 62,
  renewal_risk: 'medium',
  renewal_risk_reasons: ['Renewal is within 90 days'],
  expansion_likelihood: 'low',
  expansion_reasons: ['Low portal usage — adoption must improve first'],
  top_signals: ['low_portal_engagement'],
  primary_action: {
    label: 'Adoption outreach',
    reason: 'Low portal engagement',
    priority: 'medium',
  },
  last_contact_date: '2026-04-01',
  renewal_date: '2026-08-01',
}

describe('buildTemplateCoachResponse', () => {
  it('returns actionable guidance without dollar amounts', () => {
    const coach = buildTemplateCoachResponse(context)
    const formatted = formatCoachResponse(coach)
    expect(coach.recommended_action).toBe('Adoption outreach')
    expect(coach.cautions.some((c) => /upsell/i.test(c))).toBe(true)
    expect(formatted).toContain('Recommended action')
    expect(formatted).not.toMatch(/\$\d/)
  })
})
