import { format, startOfWeek, todayKey, addDays } from '@/lib/dates'
import { tasksApi } from '@/modules/tasks/api'
import { habitsApi } from '@/modules/habits/api'
import { journalApi } from '@/modules/journal/api'
import { healthApi } from '@/modules/health/api'
import { liftApi } from '@/modules/health/lift-api'

/** Monday-start week id, e.g. 2026-08-03 */
export function weekKey(date = new Date()): string {
  return todayKey(startOfWeek(date, { weekStartsOn: 1 }))
}

export function weekLabel(date = new Date()): string {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = addDays(start, 6)
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`
}

export function weekBounds(date = new Date()): { startKey: string; endKey: string; start: Date; end: Date } {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = addDays(start, 6)
  return {
    start,
    end,
    startKey: todayKey(start),
    endKey: todayKey(end),
  }
}

export interface WeekStats {
  label: string
  tasksCompleted: number
  habitCheckInDays: number
  workouts: number
  lifts: number
  journalDays: number
  openTasks: number
  lookAhead: string | null
}

/** Honest week-scoped aggregates for Weekly review + Ask. */
export function buildWeekStats(userId: string, date = new Date()): WeekStats {
  const { startKey, endKey } = weekBounds(date)
  const inWeek = (key: string) => key >= startKey && key <= endKey

  const tasksCompleted = tasksApi
    .listTasks(userId)
    .filter((t) => t.status === 'done' && t.completed_at && inWeek(t.completed_at.slice(0, 10))).length

  const habitDays = new Set<string>()
  for (const log of habitsApi.logs(userId)) {
    if (log.completed && inWeek(log.date)) habitDays.add(log.date)
  }

  const workouts = healthApi
    .listWorkouts(userId)
    .filter((w) => inWeek(w.date) && !w.lift_session_id).length
  const lifts = liftApi.listSessions(userId).filter((s) => inWeek(s.date)).length

  const journalDays = journalApi.list(userId).filter((e) => inWeek(e.date)).length

  const open = tasksApi.listTasks(userId).filter((t) => t.status !== 'done')
  const priority = tasksApi.priorityTasks(userId, 1)[0]
  const lookAhead = priority
    ? `Look ahead: ${priority.title}`
    : open.length > 0
      ? `${open.length} open task${open.length === 1 ? '' : 's'} waiting`
      : null

  return {
    label: weekLabel(date),
    tasksCompleted,
    habitCheckInDays: habitDays.size,
    workouts,
    lifts,
    journalDays,
    openTasks: open.length,
    lookAhead,
  }
}

const REVIEW_KEY = 'katana-personal:week-review'

export function reviewedThisWeek(): boolean {
  return localStorage.getItem(REVIEW_KEY) === weekKey()
}

export function markWeekReviewed(): void {
  localStorage.setItem(REVIEW_KEY, weekKey())
}

/** Show weekly review on Sunday or Monday, or if they haven't closed one this week yet late in the week. */
export function shouldOfferWeekReview(date = new Date()): boolean {
  if (reviewedThisWeek()) return false
  const day = date.getDay() // 0 Sun … 6 Sat
  const hour = date.getHours()
  if (day === 0 || day === 1) return true
  if (day >= 5 && hour >= 16) return true
  return false
}
