import { describe, it, expect } from 'vitest'
import { computeRevenueMetrics } from './kyc-revenue-metrics'

describe('computeRevenueMetrics', () => {
  it('computes GRR and NRR from monthly snapshots', () => {
    const metrics = computeRevenueMetrics([
      { client_id: 'a', snapshot_month: '2026-01-01', mrr: 1000, arr: 12000, is_active: true },
      { client_id: 'b', snapshot_month: '2026-01-01', mrr: 500, arr: 6000, is_active: true },
      { client_id: 'a', snapshot_month: '2026-02-01', mrr: 1100, arr: 13200, is_active: true },
      { client_id: 'b', snapshot_month: '2026-02-01', mrr: 0, arr: 0, is_active: false },
    ])
    expect(metrics.available).toBe(true)
    expect(metrics.grr).toBeLessThan(100)
    expect(metrics.nrr).toBeLessThan(100)
    expect(metrics.logo_retention).toBe(50)
  })
})
