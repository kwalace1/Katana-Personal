import { describe, it, expect } from 'vitest'
import { buildSignalPlays } from './kyc-signal-plays'
import { buildCsmBriefing } from './kyc-csm-briefing'
import type { ClientIntelligenceResult } from './kyc-client-scoring'

describe('buildSignalPlays', () => {
  it('returns meaning and play for active internal signals', () => {
    const plays = buildSignalPlays({
      low_portal_engagement: true,
      renewal_within_90d: true,
    })
    expect(plays.length).toBe(2)
    expect(plays.some((p) => p.signal_key === 'low_portal_engagement')).toBe(true)
    expect(plays[0]?.recommended_play.length).toBeGreaterThan(10)
  })
})

describe('buildCsmBriefing', () => {
  const intel: ClientIntelligenceResult = {
    signals: { low_portal_engagement: true },
    health_score: 55,
    status: 'moderate',
    churn_risk: 45,
    attention_score: 14,
    health_breakdown: [],
    top_signals: ['low_portal_engagement'],
    renewal_risk: 'medium',
    renewal_risk_reasons: ['Portal usage is low'],
    expansion_likelihood: 'low',
    expansion_reasons: ['Low portal usage — adoption must improve first'],
    primary_action: {
      id: 'adoption-push',
      label: 'Adoption outreach',
      reason: 'Low portal engagement',
      priority: 'low',
    },
    health_reasoning: { positive: [], negative: ['Low Portal Use'] },
    signal_plays: buildSignalPlays({ low_portal_engagement: true }),
  }

  it('includes guardrails when expansion is not supported', () => {
    const briefing = buildCsmBriefing('Acme', intel, [], intel.signal_plays)
    expect(briefing.do_not_do.some((d) => /upsell/i.test(d))).toBe(true)
    expect(briefing.talking_points.length).toBeGreaterThan(0)
  })
})
