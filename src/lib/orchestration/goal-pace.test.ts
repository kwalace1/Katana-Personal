import { describe, expect, it } from 'vitest'
import { goalPaceStatus, goalsBehindPace } from './goal-pace'
import type { Goal } from '@/modules/goals/types'

function goal(partial: Partial<Goal> & { title: string }): Goal {
  return {
    id: partial.id ?? 'g1',
    user_id: 'u1',
    title: partial.title,
    notes: '',
    target: partial.target ?? 100,
    progress: partial.progress ?? 0,
    horizon: partial.horizon ?? 'monthly',
    target_date: partial.target_date ?? null,
    created_at: partial.created_at ?? '2026-08-01T00:00:00.000Z',
    updated_at: partial.updated_at ?? '2026-08-01T00:00:00.000Z',
  }
}

describe('goal-pace', () => {
  it('marks behind when actual progress lags linear pace', () => {
    const g = goal({
      title: 'Lose 10 lb',
      target: 100,
      progress: 20,
      target_date: '2026-09-29',
      created_at: '2026-08-01T00:00:00.000Z',
    })
    const now = new Date('2026-08-29T12:00:00')
    const status = goalPaceStatus(g, now)
    expect(status.behind).toBe(true)
    expect(status.actualPct).toBeLessThan(status.expectedPct)
  })

  it('sorts most-behind goals first', () => {
    const now = new Date('2026-08-29T12:00:00')
    const behind = goalsBehindPace(
      [
        goal({ id: 'a', title: 'A', progress: 40, target: 100, target_date: '2026-09-15' }),
        goal({ id: 'b', title: 'B', progress: 5, target: 100, target_date: '2026-09-15' }),
      ],
      now,
    )
    expect(behind[0]?.id).toBe('b')
  })
})
