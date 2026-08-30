import { listConnections } from '@/lib/integrations/store'
import { readIntegrationStatus } from '@/lib/integrations/status'
import { habitsApi } from '@/modules/habits/api'
import type { LifeSnapshot } from './engine'
import type { AskAction } from './ask-api'
import { createId } from '@/lib/id'

export type ContextGapId =
  | 'habits'
  | 'goals'
  | 'calendar'
  | 'sleep'
  | 'movement'
  | 'journal'
  | 'integrations'

export interface ContextGap {
  id: ContextGapId
  label: string
  reason: string
  route: string
  chipLabel: string
}

export interface ContextAssessment {
  gaps: ContextGap[]
  /** 0–1 — share of life domains Katana can see */
  richnessScore: number
  sparse: boolean
  domainsFilled: number
  domainsTotal: number
}

const DOMAIN_TOTAL = 7

function hasHealthSignal(snap: LifeSnapshot): boolean {
  return (
    snap.sleepHoursLast > 0 ||
    snap.waterGlasses > 0 ||
    snap.recentWorkouts > 0 ||
    snap.recentLifts > 0 ||
    snap.caloriesToday > 0
  )
}

function hasJournalSignal(snap: LifeSnapshot): boolean {
  return snap.journalToday || snap.recentJournal.length > 0 || snap.week.journalDays > 0
}

function hasTaskSignal(snap: LifeSnapshot): boolean {
  return snap.openTasks.length > 0 || snap.todayTasks.length > 0
}

function hasCalendarSignal(snap: LifeSnapshot): boolean {
  return snap.todayEvents.length > 0 || snap.upcomingEvents.length > 0
}

/** What Katana is missing to orchestrate well. */
export function assessContextGaps(userId: string, snap: LifeSnapshot): ContextAssessment {
  const gaps: ContextGap[] = []
  const integrations = readIntegrationStatus(userId)
  const habitCount = habitsApi.list(userId).length

  let domainsFilled = 0
  if (hasTaskSignal(snap)) domainsFilled += 1
  if (hasCalendarSignal(snap)) domainsFilled += 1
  if (habitCount > 0) domainsFilled += 1
  if (snap.activeGoals.length > 0) domainsFilled += 1
  if (hasHealthSignal(snap)) domainsFilled += 1
  if (hasJournalSignal(snap)) domainsFilled += 1
  if (integrations.calendarConnected || integrations.healthConnected) domainsFilled += 1

  if (habitCount === 0) {
    gaps.push({
      id: 'habits',
      label: 'Habits',
      reason: 'No habits yet — I can’t nudge rhythm or streaks.',
      route: '/habits',
      chipLabel: 'Add a habit',
    })
  }

  if (snap.activeGoals.length === 0) {
    gaps.push({
      id: 'goals',
      label: 'Goals',
      reason: 'No goals — hard to tell if you’re on pace.',
      route: '/goals',
      chipLabel: 'Set a goal',
    })
  }

  if (!hasCalendarSignal(snap) && !integrations.calendarConnected) {
    gaps.push({
      id: 'calendar',
      label: 'Calendar',
      reason: 'Calendar is empty — I can’t find workout windows or conflicts.',
      route: '/calendar',
      chipLabel: 'Add to calendar',
    })
  }

  if (snap.sleepHoursLast <= 0 && !integrations.fitbit) {
    gaps.push({
      id: 'sleep',
      label: 'Sleep',
      reason: 'No sleep logged — recovery-aware planning is guesswork.',
      route: '/health',
      chipLabel: 'Log sleep',
    })
  }

  if (
    snap.recentWorkouts + snap.recentLifts === 0 &&
    snap.week.workouts + snap.week.lifts === 0 &&
    !integrations.strava &&
    !integrations.fitbit
  ) {
    gaps.push({
      id: 'movement',
      label: 'Movement',
      reason: 'No workouts this week — I can’t see training load.',
      route: '/health',
      chipLabel: 'Log a workout',
    })
  }

  if (!hasJournalSignal(snap)) {
    gaps.push({
      id: 'journal',
      label: 'Journal',
      reason: 'No journal entries — mood and reflection are invisible to me.',
      route: '/journal',
      chipLabel: 'Write in journal',
    })
  }

  if (!integrations.calendarConnected && !integrations.healthConnected) {
    const hasIcs = listConnections(userId).some((c) => c.provider === 'ics_calendar' && c.status === 'connected')
    if (!hasIcs) {
      gaps.push({
        id: 'integrations',
        label: 'Connections',
        reason: 'No calendar or health sync — I only see what you type manually.',
        route: '/settings/connections',
        chipLabel: 'Connect apps',
      })
    }
  }

  const richnessScore = domainsFilled / DOMAIN_TOTAL
  const sparse = richnessScore < 0.45 || gaps.length >= 4

  return {
    gaps,
    richnessScore,
    sparse,
    domainsFilled,
    domainsTotal: DOMAIN_TOTAL,
  }
}

export function buildShareMoreActions(gaps: ContextGap[], limit = 3): AskAction[] {
  return gaps.slice(0, limit).map((g) => ({
    id: createId(),
    label: g.chipLabel,
    kind: 'open_route' as const,
    route: g.route,
  }))
}

export function gapSummaryPhrase(gaps: ContextGap[], max = 2): string {
  if (gaps.length === 0) return ''
  const labels = gaps.slice(0, max).map((g) => g.label.toLowerCase())
  if (labels.length === 1) return labels[0]!
  return `${labels[0]} and ${labels[1]}`
}
