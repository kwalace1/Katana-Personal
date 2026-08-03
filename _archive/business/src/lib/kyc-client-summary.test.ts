import { describe, it, expect } from 'vitest'
import {
  buildKycSummaryContext,
  buildSummaryContextHash,
  buildTemplateClientSummary,
} from './kyc-client-summary'

const baseIntel = {
  status: 'moderate',
  health_score: 71,
  top_signals: ['icp_industry_match', 'low_portal_engagement'],
  renewal_risk: 'medium' as const,
  renewal_risk_reasons: ['Renewal is within 90 days', 'Portal usage is low'],
  expansion_likelihood: 'medium' as const,
  expansion_reasons: ['Customer matches ICP', 'Low portal usage — adoption must improve first'],
  primary_action: {
    label: 'Adoption outreach',
    reason: 'Low portal engagement',
    priority: 'low',
  },
}

describe('buildTemplateClientSummary', () => {
  it('produces a grounded narrative without dollar amounts', () => {
    const ctx = buildKycSummaryContext(
      {
        name: 'Swing Racquet & Paddle',
        industry: 'Sports',
        last_contact_date: '2026-05-01',
        renewal_date: '2026-08-01',
      },
      baseIntel,
    )
    const summary = buildTemplateClientSummary(ctx)
    expect(summary).toContain('Swing Racquet & Paddle')
    expect(summary).toContain('moderate-health')
    expect(summary).toContain('Renewal risk is medium')
    expect(summary).toContain('adoption outreach')
    expect(summary).not.toMatch(/\$\d/)
  })
})

describe('buildSummaryContextHash', () => {
  it('changes when intel inputs change', () => {
    const ctx = buildKycSummaryContext(
      { name: 'Acme', industry: 'Tech', last_contact_date: null, renewal_date: null },
      baseIntel,
    )
    const hashA = buildSummaryContextHash(ctx)
    const hashB = buildSummaryContextHash({
      ...ctx,
      renewal_risk: 'high',
    })
    expect(hashA).not.toBe(hashB)
  })
})
