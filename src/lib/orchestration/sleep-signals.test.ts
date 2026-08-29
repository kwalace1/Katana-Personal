import { describe, expect, it, beforeEach } from 'vitest'
import { localDb } from '@/lib/local-db'
import { healthApi } from '@/modules/health/api'
import { readSleepSignals } from './sleep-signals'
import { pickNextStep } from './next-step'
import type { LifeSnapshot } from '@/modules/assistant/engine'
import { buildWeekStats } from '@/lib/week-review'

const USER = 'sleep-orch-user'

function baseSnap(): LifeSnapshot {
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
    waterGlasses: 4,
    recentWorkouts: 0,
    recentLifts: 0,
    sleepHoursLast: 4.5,
    caloriesToday: 0,
    recentNotes: 0,
    week: { ...week, workouts: 2, lifts: 0 },
  }
}

describe('sleep-signals', () => {
  beforeEach(() => {
    for (const row of healthApi.listSleep(USER)) {
      localDb.remove('sleep_logs', USER, row.id)
    }
  })

  it('flags very short sleep', () => {
    healthApi.addSleep(USER, { date: '2026-08-29', hours: 4.5, quality: 'poor', silent: true })
    const signals = readSleepSignals(USER, new Date('2026-08-29T09:00:00'))
    expect(signals.veryShortSleep).toBe(true)
    expect(signals.lastNightHours).toBe(4.5)
  })
})

describe('pickNextStep sleep-aware', () => {
  it('prioritizes recovery after very short sleep', () => {
    const sleep = {
      lastNightHours: 4.5,
      shortSleep: true,
      veryShortSleep: true,
      avg3Night: 4.5,
    }
    const step = pickNextStep({
      snap: baseSnap(),
      overdue: [],
      openHabits: [],
      atRiskHabits: [],
      workoutPlan: { enabled: true, weeklyTarget: 4, completedThisWeek: 1, label: 'Gym' },
      workedOutToday: false,
      now: new Date('2026-08-29T09:00:00'),
      sleep,
    })
    expect(step?.kind).toBe('recovery')
  })
})
