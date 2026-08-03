import { describe, it, expect } from 'vitest'
import { computeUsageTrendFlags } from './kyc-usage-trends'

describe('computeUsageTrendFlags', () => {
  it('flags declining portal usage when logins drop materially', () => {
    const flags = computeUsageTrendFlags(
      { portal_logins: 4, engagement_score: 50, active_users: 4, meetings_30d: 1, emails_30d: 2 },
      {
        portal_logins: 10,
        engagement_score: 55,
        feature_usage: 'medium',
        support_tickets: 0,
        active_users: 8,
        meetings_30d: 2,
        emails_30d: 3,
        health_score: 60,
        recorded_at: '2026-04-01T00:00:00.000Z',
      },
    )
    expect(flags.declining_portal_usage).toBe(true)
  })
})
