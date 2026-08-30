import { describe, expect, it } from 'vitest'
import { assessContextGaps } from './context-gaps'
import { enrichReplyWithShareMore } from './share-more'
import type { LifeSnapshot } from './engine'
import { buildWeekStats } from '@/lib/week-review'

const USER = 'share-more-user'

function emptySnap(): LifeSnapshot {
  const week = buildWeekStats(USER)
  return {
    name: 'Alex',
    todayLabel: 'Saturday, August 29',
    openTasks: [],
    todayTasks: [],
    priorityTasks: [],
    upcomingEvents: [],
    todayEvents: [],
    habitsDue: [],
    habitsDoneIds: [],
    activeGoals: [],
    behindGoals: [],
    journalToday: false,
    journalMood: null,
    recentJournal: [],
    waterGlasses: 0,
    recentWorkouts: 0,
    recentLifts: 0,
    sleepHoursLast: 0,
    caloriesToday: 0,
    recentNotes: 0,
    week: { ...week, workouts: 0, lifts: 0, journalDays: 0, habitCheckInDays: 0, tasksCompleted: 0 },
  }
}

describe('assessContextGaps', () => {
  it('marks empty workspace as sparse', () => {
    const ctx = assessContextGaps(USER, emptySnap())
    expect(ctx.sparse).toBe(true)
    expect(ctx.gaps.length).toBeGreaterThanOrEqual(4)
  })
})

describe('enrichReplyWithShareMore', () => {
  it('appends supportive nudge when sparse', () => {
    const snap = emptySnap()
    const ctx = assessContextGaps(USER, snap)
    const out = enrichReplyWithShareMore(
      USER,
      { text: 'Your calendar is open today.', actions: [] },
      snap,
      'supportive',
      ctx,
    )
    expect(out.text.toLowerCase()).toMatch(/share|missing|light on context/)
    expect(out.actions.length).toBeGreaterThan(0)
  })

  it('uses tough voice when configured', () => {
    const snap = emptySnap()
    const ctx = assessContextGaps(USER, snap)
    const out = enrichReplyWithShareMore(
      USER,
      { text: 'Nothing urgent.', actions: [] },
      snap,
      'tough',
      ctx,
    )
    expect(out.text.toLowerCase()).toMatch(/blind|share more|map your day/)
  })
})
