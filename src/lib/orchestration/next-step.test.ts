import { describe, expect, it } from 'vitest'
import { findCalendarGap, eventStartingWithin } from './calendar-gaps'
import { isWorkoutBehind, resolveWorkoutPlan } from './workout-plan'
import { pickNextStep, type PickNextStepInput } from './next-step'
import type { LifeSnapshot } from '@/modules/assistant/engine'
import type { CalendarEvent } from '@/modules/calendar/types'
import type { Habit } from '@/modules/habits/types'
import type { Task } from '@/modules/tasks/types'
import { buildWeekStats } from '@/lib/week-review'

const USER = 'orch-test-user'

function baseSnap(overrides: Partial<LifeSnapshot> = {}): LifeSnapshot {
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
    sleepHoursLast: 0,
    caloriesToday: 0,
    recentNotes: 0,
    week: { ...week, workouts: 2, lifts: 0 },
    ...overrides,
  }
}

function task(partial: Partial<Task> & { title: string }): Task {
  return {
    id: partial.id ?? 't1',
    user_id: USER,
    title: partial.title,
    notes: '',
    status: partial.status ?? 'open',
    priority: partial.priority ?? 'medium',
    list_id: null,
    goal_id: null,
    habit_id: null,
    due_at: partial.due_at ?? null,
    sort_order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function event(partial: Partial<CalendarEvent> & { title: string; starts_at: string }): CalendarEvent {
  return {
    id: partial.id ?? 'e1',
    user_id: USER,
    title: partial.title,
    notes: '',
    starts_at: partial.starts_at,
    ends_at: partial.ends_at ?? partial.starts_at,
    all_day: partial.all_day ?? false,
    location: '',
    recurrence: 'none',
    reminder_minutes: null,
    category: 'personal',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function habit(partial: Partial<Habit> & { title: string }): Habit {
  return {
    id: partial.id ?? 'h1',
    user_id: USER,
    title: partial.title,
    schedule: 'daily',
    reminder_time: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

describe('calendar-gaps', () => {
  it('finds minutes before next event', () => {
    const now = new Date('2026-08-29T16:00:00')
    const gap = findCalendarGap(
      [
        event({
          title: 'Dinner',
          starts_at: '2026-08-29T19:30:00',
          ends_at: '2026-08-29T20:30:00',
        }),
      ],
      now,
    )
    expect(gap.minutes).toBe(210)
    expect(gap.nextEvent?.title).toBe('Dinner')
  })
})

describe('workout-plan', () => {
  it('detects gym habit and weekly target', () => {
    const snap = baseSnap()
    const plan = resolveWorkoutPlan(snap, [habit({ title: 'Gym' })])
    expect(plan.enabled).toBe(true)
    expect(plan.weeklyTarget).toBe(3)
    expect(plan.label).toBe('Gym')
  })

  it('marks behind mid-week when under pace', () => {
    const plan = {
      enabled: true,
      weeklyTarget: 4,
      completedThisWeek: 2,
      label: 'Gym',
    }
    const thursday = new Date('2026-08-27T12:00:00')
    expect(isWorkoutBehind(plan, thursday)).toBe(true)
  })
})

describe('pickNextStep', () => {
  it('prioritizes overdue tasks', () => {
    const overdue = [task({ id: 'od1', title: 'Reply to dentist', due_at: '2026-08-28T17:00:00' })]
    const step = pickNextStep({
      snap: baseSnap({ priorityTasks: overdue }),
      overdue,
      openHabits: [],
      atRiskHabits: [],
      workoutPlan: { enabled: false, weeklyTarget: 0, completedThisWeek: 0, label: 'Gym' },
      workedOutToday: false,
    })
    expect(step?.kind).toBe('task')
    expect(step?.title).toBe('Reply to dentist')
    expect(step?.reason.toLowerCase()).toMatch(/overdue/)
  })

  it('suggests workout when behind pace with calendar gap', () => {
    const now = new Date('2026-08-29T16:00:00')
    const snap = baseSnap({
      todayEvents: [
        event({
          title: 'Dinner',
          starts_at: '2026-08-29T19:30:00',
          ends_at: '2026-08-29T20:30:00',
        }),
      ],
      week: { ...buildWeekStats(USER), workouts: 2, lifts: 0 },
    })
    const step = pickNextStep({
      snap,
      overdue: [],
      openHabits: [],
      atRiskHabits: [],
      workoutPlan: {
        enabled: true,
        weeklyTarget: 4,
        completedThisWeek: 2,
        label: 'Go to the gym',
      },
      workedOutToday: false,
      now,
    })
    expect(step?.kind).toBe('workout')
    expect(step?.title).toBe('Go to the gym')
    expect(step?.reason).toMatch(/4 workouts/)
    expect(step?.reason).toMatch(/7:30|19:30|Dinner/)
  })

  it('suggests wind-down after 9pm when nothing urgent', () => {
    const now = new Date('2026-08-29T21:30:00')
    const step = pickNextStep({
      snap: baseSnap(),
      overdue: [],
      openHabits: [],
      atRiskHabits: [],
      workoutPlan: { enabled: false, weeklyTarget: 0, completedThisWeek: 0, label: 'Gym' },
      workedOutToday: false,
      dayClosed: false,
      now,
    })
    expect(step?.kind).toBe('wind_down')
    expect(step?.title.toLowerCase()).toMatch(/night/)
  })

  it('surfaces soon event within 90 minutes', () => {
    const now = new Date('2026-08-29T16:00:00')
    const soon = event({
      id: 'soon1',
      title: 'Focus block',
      starts_at: '2026-08-29T16:45:00',
      ends_at: '2026-08-29T17:45:00',
    })
    const step = pickNextStep({
      snap: baseSnap({ todayEvents: [soon] }),
      overdue: [],
      openHabits: [],
      atRiskHabits: [],
      workoutPlan: { enabled: true, weeklyTarget: 4, completedThisWeek: 2, label: 'Gym' },
      workedOutToday: false,
      now,
    })
    expect(step?.kind).toBe('event')
    expect(step?.title).toBe('Focus block')
  })
})

describe('eventStartingWithin', () => {
  it('returns event starting soon', () => {
    const now = new Date('2026-08-29T16:00:00')
    const ev = event({
      title: 'Meeting',
      starts_at: '2026-08-29T16:30:00',
      ends_at: '2026-08-29T17:00:00',
    })
    expect(eventStartingWithin([ev], 90, now)?.title).toBe('Meeting')
  })
})
