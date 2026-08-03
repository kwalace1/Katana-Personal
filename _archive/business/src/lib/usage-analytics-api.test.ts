import { describe, it, expect } from 'vitest'
import {
  lastNDates,
  filterByRange,
  computeTotals,
  rankModels,
  rankProviders,
  topModelNames,
  pivotByDayModel,
  tokenBreakdownByDay,
  usageTypeByDay,
  trendingModels,
  usageRowsToCsv,
  splitWindows,
  pctDelta,
  formatUsd,
  formatCompact,
  OTHER_LABEL,
  type UsageRow,
} from './usage-analytics-api'

function mk(date: string, model: string, o: Partial<UsageRow> = {}): UsageRow {
  return {
    date,
    model,
    provider: o.provider === undefined ? 'openai' : o.provider,
    usage: o.usage ?? 0,
    byok_usage: o.byok_usage ?? 0,
    requests: o.requests ?? 0,
    prompt_tokens: o.prompt_tokens ?? 0,
    completion_tokens: o.completion_tokens ?? 0,
    reasoning_tokens: o.reasoning_tokens ?? 0,
  }
}

describe('range selection', () => {
  const rows = [
    mk('2026-07-20', 'a'),
    mk('2026-07-21', 'a'),
    mk('2026-07-22', 'b'),
    mk('2026-07-23', 'a'),
    mk('2026-07-24', 'b'),
  ]

  it('lastNDates returns the N most recent distinct dates, ascending', () => {
    expect(lastNDates(rows, 2)).toEqual(['2026-07-23', '2026-07-24'])
    expect(lastNDates(rows, 99)).toEqual([
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
    ])
  })

  it('filterByRange keeps only rows within the last N distinct dates', () => {
    const kept = filterByRange(rows, 7).map((r) => r.date)
    expect(kept).toHaveLength(5) // only 5 distinct dates exist
    // Simulate a 2-day window via lastNDates semantics
    const two = new Set(lastNDates(rows, 2))
    expect(rows.filter((r) => two.has(r.date))).toHaveLength(2)
  })
})

describe('computeTotals', () => {
  it('sums spend/tokens/requests and derives blended $/1M', () => {
    const rows = [
      mk('2026-07-20', 'a', { usage: 2, requests: 10, prompt_tokens: 400_000, completion_tokens: 100_000 }),
      mk('2026-07-21', 'b', { usage: 3, byok_usage: 1, requests: 5, prompt_tokens: 400_000, completion_tokens: 100_000 }),
    ]
    const t = computeTotals(rows)
    expect(t.spend).toBe(5)
    expect(t.byokSpend).toBe(1)
    expect(t.requests).toBe(15)
    expect(t.totalTokens).toBe(1_000_000)
    // $5 over 1M tokens => $5 per 1M
    expect(t.blendedPerMillion).toBeCloseTo(5, 6)
  })

  it('blended $/1M is 0 when there are no tokens (no divide-by-zero)', () => {
    expect(computeTotals([mk('2026-07-20', 'a', { usage: 1 })]).blendedPerMillion).toBe(0)
  })
})

describe('rankModels', () => {
  const rows = [
    mk('2026-07-20', 'big', { usage: 8, requests: 2, prompt_tokens: 100 }),
    mk('2026-07-21', 'big', { usage: 2, requests: 3, prompt_tokens: 100 }),
    mk('2026-07-20', 'small', { usage: 1, requests: 10, prompt_tokens: 100 }),
  ]

  it('ranks by spend desc with correct shares', () => {
    const ranked = rankModels(rows, 'usage')
    expect(ranked.map((r) => r.model)).toEqual(['big', 'small'])
    expect(ranked[0].spend).toBe(10)
    expect(ranked[0].share).toBeCloseTo(10 / 11, 6)
    expect(ranked[1].share).toBeCloseTo(1 / 11, 6)
  })

  it('re-ranks by the chosen metric', () => {
    const byReq = rankModels(rows, 'requests')
    expect(byReq[0].model).toBe('small') // 10 requests > 5
  })
})

describe('rankProviders', () => {
  it('groups null providers under "Unknown"', () => {
    const rows = [
      mk('2026-07-20', 'a', { usage: 3, provider: null }),
      mk('2026-07-20', 'b', { usage: 1, provider: 'anthropic' }),
    ]
    const ranked = rankProviders(rows, 'usage')
    expect(ranked[0]).toMatchObject({ provider: 'Unknown', spend: 3 })
    expect(ranked[0].share).toBeCloseTo(0.75, 6)
  })
})

describe('pivotByDayModel', () => {
  const rows = [
    mk('2026-07-20', 'a', { usage: 5 }),
    mk('2026-07-20', 'b', { usage: 3 }),
    mk('2026-07-20', 'c', { usage: 1 }),
    mk('2026-07-21', 'a', { usage: 2 }),
  ]

  it('folds models outside the top list into "Other" and zero-fills days', () => {
    const top = topModelNames(rows, 'usage', 2) // a (7), b (3)
    expect(top).toEqual(['a', 'b'])
    const points = pivotByDayModel(rows, 'usage', top)
    expect(points).toHaveLength(2)
    const d20 = points.find((p) => p.date === '2026-07-20')!
    expect(d20.a).toBe(5)
    expect(d20.b).toBe(3)
    expect(d20[OTHER_LABEL]).toBe(1) // c folded in
    const d21 = points.find((p) => p.date === '2026-07-21')!
    expect(d21.a).toBe(2)
    expect(d21.b).toBe(0) // zero-filled
    expect(d21[OTHER_LABEL]).toBe(0)
  })
})

describe('tokenBreakdownByDay & usageTypeByDay', () => {
  const rows = [
    mk('2026-07-20', 'a', { prompt_tokens: 10, completion_tokens: 5, reasoning_tokens: 2, usage: 4, byok_usage: 1 }),
    mk('2026-07-20', 'b', { prompt_tokens: 1, completion_tokens: 1, reasoning_tokens: 0, usage: 1, byok_usage: 0 }),
  ]

  it('sums tokens per day by type', () => {
    const [d] = tokenBreakdownByDay(rows)
    expect(d).toMatchObject({ date: '2026-07-20', prompt: 11, completion: 6, reasoning: 2 })
  })

  it('splits paid vs BYOK spend per day', () => {
    const [d] = usageTypeByDay(rows)
    expect(d).toMatchObject({ date: '2026-07-20', paid: 5, byok: 1 })
  })
})

describe('trendingModels', () => {
  // 10 distinct dates => with days=7, current = last 7, previous = the 3 before.
  const dates = Array.from({ length: 10 }, (_, i) => `2026-07-${String(15 + i).padStart(2, '0')}`)
  const rows: UsageRow[] = []
  // model A: present in both windows
  dates.forEach((d) => rows.push(mk(d, 'A', { usage: 1 })))
  // model B: only in the current window (last 7 dates) => new
  dates.slice(-7).forEach((d) => rows.push(mk(d, 'B', { usage: 2 })))
  // model C: only in the previous window (first 3 dates) => dropped (current 0)
  dates.slice(0, 3).forEach((d) => rows.push(mk(d, 'C', { usage: 5 })))

  it('computes current vs previous window, flags new models, drops absent ones', () => {
    const trends = trendingModels(rows, 7, 'usage')
    const byModel = Object.fromEntries(trends.map((t) => [t.model, t]))
    expect(byModel.C).toBeUndefined() // no current-window usage
    expect(byModel.B.isNew).toBe(true)
    expect(byModel.B.deltaPct).toBeNull()
    expect(byModel.A.current).toBe(7) // 7 days × $1
    expect(byModel.A.previous).toBe(3) // 3 days × $1
    expect(byModel.A.delta).toBe(4)
    expect(byModel.A.deltaPct).toBeCloseTo((4 / 3) * 100, 6)
    // Ranked by current magnitude: B (14) before A (7)
    expect(trends[0].model).toBe('B')
  })
})

describe('splitWindows & pctDelta', () => {
  const dates = Array.from({ length: 14 }, (_, i) => `2026-07-${String(10 + i).padStart(2, '0')}`)
  const rows = dates.map((d) => mk(d, 'a', { usage: 1 }))

  it('splits into two adjacent equal-length windows', () => {
    const { current, previous } = splitWindows(rows, 7)
    expect(current).toHaveLength(7)
    expect(previous).toHaveLength(7)
    expect(current.map((r) => r.date)).toEqual(dates.slice(-7))
    expect(previous.map((r) => r.date)).toEqual(dates.slice(0, 7))
  })

  it('previous window is empty without enough history', () => {
    const short = dates.slice(-5).map((d) => mk(d, 'a', { usage: 1 }))
    expect(splitWindows(short, 7).previous).toHaveLength(0)
  })

  it('pctDelta returns null against a zero baseline', () => {
    expect(pctDelta(5, 0)).toBeNull()
    expect(pctDelta(6, 3)).toBeCloseTo(100, 6)
  })
})

describe('usageRowsToCsv', () => {
  it('emits a header row and sorts by date then model', () => {
    const csv = usageRowsToCsv([
      mk('2026-07-21', 'z', { usage: 1 }),
      mk('2026-07-20', 'b', { usage: 2 }),
      mk('2026-07-20', 'a', { usage: 3 }),
    ])
    const lines = csv.trim().split(/\r?\n/)
    expect(lines[0]).toBe('date,model,provider,usage,byok_usage,requests,prompt_tokens,completion_tokens,reasoning_tokens')
    expect(lines[1]).toContain('2026-07-20,a')
    expect(lines[2]).toContain('2026-07-20,b')
    expect(lines[3]).toContain('2026-07-21,z')
  })
})

describe('formatters', () => {
  it('formatUsd uses more precision for sub-dollar amounts', () => {
    expect(formatUsd(0.0136)).toBe('$0.0136')
    expect(formatUsd(6.1)).toBe('$6.10')
  })
  it('formatCompact abbreviates large numbers', () => {
    expect(formatCompact(10_000_000)).toBe('10M')
    expect(formatCompact(3_000)).toBe('3K')
  })
})
