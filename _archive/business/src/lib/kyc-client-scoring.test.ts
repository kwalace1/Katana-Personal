import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildClientIntelligence,
  computeClientSignals,
  computeAttentionScore,
  computeLeadFitScore,
  computeLeadSignals,
  computeRenewalRisk,
  computeExpansionLikelihood,
  getClientHealthBreakdown,
  leadFitToPercent,
  computeLeadFitFromInput,
  buildSuggestedActions,
  type KycIcpProfile,
} from './kyc-client-scoring'

const RECENT = '2026-05-12T12:00:00.000Z'
const RENEWAL_SOON = '2026-06-20'

describe('computeClientSignals', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flags risk signals for stale contact, support spike, and upcoming renewal', () => {
    const signals = computeClientSignals({
      nps_score: 4,
      engagement_score: 20,
      support_tickets: 4,
      last_contact_date: '2025-12-01',
      feature_usage: 'low',
      portal_logins: 0,
      renewal_date: RENEWAL_SOON,
      overdue_task_count: 2,
      has_primary_contact: false,
    })

    expect(signals.nps_detractor).toBe(true)
    expect(signals.support_ticket_spike).toBe(true)
    expect(signals.no_contact_30d).toBe(true)
    expect(signals.renewal_within_90d).toBe(true)
    expect(signals.overdue_cs_tasks).toBe(true)
    expect(signals.missing_primary_contact).toBe(true)
  })

  it('flags positive operational signals', () => {
    const signals = computeClientSignals({
      nps_score: 10,
      engagement_score: 90,
      support_tickets: 0,
      last_contact_date: RECENT,
      feature_usage: 'high',
      portal_logins: 12,
      renewal_date: '2027-01-01',
      active_wfm_job_count: 1,
      completed_wfm_job_count_30d: 2,
      open_deal_count: 1,
    })

    expect(signals.nps_promoter).toBe(true)
    expect(signals.high_feature_usage).toBe(true)
    expect(signals.active_wfm_jobs).toBe(true)
    expect(signals.recent_job_completed).toBe(true)
    expect(signals.open_deal).toBe(true)
    expect(signals.no_contact_30d).toBeUndefined()
  })

  it('does not flag missing decision maker for B2C accounts', () => {
    const signals = computeClientSignals({
      nps_score: 8,
      engagement_score: 70,
      support_tickets: 0,
      last_contact_date: RECENT,
      account_type: 'individual',
      has_decision_maker: false,
      has_primary_contact: false,
    })
    expect(signals.missing_decision_maker).toBeUndefined()
    expect(signals.missing_primary_contact).toBe(true)
  })
})

describe('computeAttentionScore', () => {
  it('ranks high-risk signal combinations higher', () => {
    const low = computeAttentionScore({ open_support_tickets: true })
    const high = computeAttentionScore({
      renewal_within_30d: true,
      no_contact_60d: true,
      support_ticket_spike: true,
      invoice_overdue: true,
    })
    expect(high).toBeGreaterThan(low)
    expect(high).toBeLessThanOrEqual(100)
  })
})

describe('getClientHealthBreakdown', () => {
  it('returns weighted contributions that sum near health score', () => {
    const breakdown = getClientHealthBreakdown({
      nps_score: 8,
      engagement_score: 70,
      support_tickets: 1,
      last_contact_date: RECENT,
      feature_usage: 'medium',
      portal_logins: 4,
    })
    const sum = breakdown.reduce((acc, item) => acc + item.contribution, 0)
    expect(breakdown.length).toBe(9)
    expect(sum).toBeGreaterThan(50)
    expect(sum).toBeLessThanOrEqual(100)
  })
})

describe('lead fit scoring', () => {
  const icp: KycIcpProfile = {
    target_industries: ['healthcare', 'saas'],
    target_states: ['ca', 'ny'],
    target_countries: ['us'],
    preferred_account_types: ['business'],
    min_deal_size: 10000,
    sector_tags: [],
    description: '',
  }

  it('scores lead fit from ICP matches', () => {
    const signals = computeLeadSignals(
      {
        industry: 'Healthcare Services',
        state: 'CA',
        account_type: 'business',
        estimated_deal_size: 25000,
      },
      icp,
    )
    const score = computeLeadFitScore(signals)
    expect(signals.icp_industry_match).toBe(true)
    expect(signals.icp_geo_match).toBe(true)
    expect(score).toBeGreaterThan(40)
    expect(leadFitToPercent(score)).toBeGreaterThan(50)
  })
})

describe('buildSuggestedActions', () => {
  it('prioritizes urgent renewal and support signals', () => {
    const actions = buildSuggestedActions({
      renewal_within_30d: true,
      support_ticket_spike: true,
      no_contact_60d: true,
    })
    expect(actions.length).toBeGreaterThan(0)
    expect(actions[0]?.priority).toBe('high')
    expect(actions.some((a) => a.id === 'renewal-urgent')).toBe(true)
  })
})

describe('buildClientIntelligence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('combines metrics, signals, and breakdown', () => {
    const result = buildClientIntelligence({
      nps_score: 3,
      engagement_score: 15,
      support_tickets: 5,
      last_contact_date: '2025-10-01',
      feature_usage: 'low',
      portal_logins: 0,
      renewal_date: RENEWAL_SOON,
      overdue_task_count: 1,
    })

    expect(result.status).toBe('at-risk')
    expect(result.attention_score).toBeGreaterThan(15)
    expect(result.top_signals.length).toBeGreaterThan(0)
    expect(result.health_breakdown.length).toBe(9)
    expect(result.renewal_risk).toBe('high')
    expect(result.renewal_risk_reasons.length).toBeGreaterThan(0)
    expect(['low', 'medium', 'high']).toContain(result.expansion_likelihood)
    expect(result.primary_action).not.toBeNull()
    expect(result.primary_action?.priority).toBe('high')
  })

  it('flags low expansion likelihood when adoption is weak', () => {
    const result = buildClientIntelligence({
      nps_score: 4,
      engagement_score: 20,
      support_tickets: 0,
      last_contact_date: RECENT,
      feature_usage: 'low',
      portal_logins: 0,
      renewal_date: '2027-01-01',
      has_decision_maker: false,
      account_type: 'business',
    })

    expect(result.expansion_likelihood).toBe('low')
    expect(result.expansion_reasons.some((r) => r.includes('portal'))).toBe(true)
  })
})

describe('computeRenewalRisk', () => {
  it('returns high risk for urgent renewal and attention signals', () => {
    const result = computeRenewalRisk(
      {
        renewal_within_30d: true,
        no_contact_60d: true,
        low_portal_engagement: true,
      },
      35,
      30,
    )
    expect(result.level).toBe('high')
    expect(result.reasons).toContain('Renewal is within 30 days')
    expect(result.reasons).toContain('No contact in 60+ days')
  })

  it('returns low risk when no risk factors are present', () => {
    const result = computeRenewalRisk({}, 4, 82)
    expect(result.level).toBe('low')
    expect(result.reasons).toHaveLength(0)
  })
})

describe('computeExpansionLikelihood', () => {
  it('returns high likelihood for strong ICP fit and adoption', () => {
    const result = computeExpansionLikelihood({
      icp_industry_match: true,
      icp_geo_match: true,
      high_feature_usage: true,
      open_deal: true,
      nps_promoter: true,
    })
    expect(result.level).toBe('high')
    expect(result.reasons.some((r) => r.includes('ICP'))).toBe(true)
  })

  it('returns low likelihood for detractor and low usage', () => {
    const result = computeExpansionLikelihood({
      nps_detractor: true,
      low_portal_engagement: true,
      missing_decision_maker: true,
    })
    expect(result.level).toBe('low')
  })
})

describe('B2C lead fit scoring', () => {
  const icp: KycIcpProfile = {
    target_industries: ['healthcare'],
    target_states: ['ca'],
    target_countries: ['us'],
    preferred_account_types: ['business', 'individual'],
    min_deal_size: 0,
    sector_tags: [],
    description: '',
  }

  it('scores B2C leads without requiring industry match', () => {
    const { signals, fit_percent } = computeLeadFitFromInput(
      { state: 'CA', account_type: 'individual' },
      icp,
    )
    expect(signals.icp_industry_match).toBeUndefined()
    expect(signals.icp_geo_match).toBe(true)
    expect(signals.icp_account_type_match).toBe(true)
    expect(fit_percent).toBeGreaterThan(0)
  })
})
