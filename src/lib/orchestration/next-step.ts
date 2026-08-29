import { formatShortDate, formatTime } from '@/lib/dates'
import { createId } from '@/lib/id'
import type { LifeSnapshot } from '@/modules/assistant/engine'
import type { AskAction } from '@/modules/assistant/ask-api'
import type { CalendarEvent } from '@/modules/calendar/types'
import type { Goal } from '@/modules/goals/types'
import type { Habit } from '@/modules/habits/types'
import type { Task } from '@/modules/tasks/types'
import { eventStartingWithin, findCalendarGap } from './calendar-gaps'
import { shouldDeprioritize, type PreferenceWeights, DEFAULT_WEIGHTS } from './feedback'
import { isWorkoutBehind, resolveWorkoutPlan, type WorkoutPlan } from './workout-plan'

import { goalPaceStatus } from './goal-pace'
import { recoveryReason, type SleepSignals } from './sleep-signals'
import { pickWorkoutSlot, scheduleWorkoutAction, WORKOUT_BLOCK_MIN } from './schedule-workout'

export type NextStepKind = 'task' | 'event' | 'habit' | 'workout' | 'goal' | 'wind_down' | 'recovery'

export interface NextStep {
  kind: NextStepKind
  title: string
  /** PDF-style orchestration line — why this, why now */
  reason: string
  /** Short meta under the title (Task · Due Friday, etc.) */
  meta?: string
  estimatedMinutes?: number
  actions: AskAction[]
  taskId?: string
  habitId?: string
  eventId?: string
  goalId?: string
}

export interface PickNextStepInput {
  snap: LifeSnapshot
  overdue: Task[]
  openHabits: Habit[]
  atRiskHabits: Habit[]
  workoutPlan: WorkoutPlan
  workedOutToday: boolean
  dayClosed?: boolean
  now?: Date
  preferenceWeights?: PreferenceWeights
  sleep?: SleepSignals
}

const WORKOUT_ESTIMATE_MIN = WORKOUT_BLOCK_MIN
const MIN_GAP_FOR_WORKOUT = 45

function taskActions(task: Task): AskAction[] {
  return [
    {
      id: createId(),
      label: `Mark “${task.title}” done`,
      kind: 'complete_task',
      taskId: task.id,
    },
    { id: createId(), label: 'Open task', kind: 'open_route', route: `/tasks?id=${task.id}` },
  ]
}

function eventActions(event: CalendarEvent): AskAction[] {
  return [
    {
      id: createId(),
      label: 'Open event',
      kind: 'open_route',
      route: `/calendar?date=${event.starts_at.slice(0, 10)}&id=${event.id}`,
    },
  ]
}

function habitActions(habit: Habit): AskAction[] {
  return [
    {
      id: createId(),
      label: `Check in “${habit.title}”`,
      kind: 'toggle_habit',
      habitId: habit.id,
    },
  ]
}

function workoutActions(plan: WorkoutPlan, events: CalendarEvent[], now: Date): AskAction[] {
  const slot = pickWorkoutSlot(events, plan.label, now)
  const actions: AskAction[] = [
    scheduleWorkoutAction(slot, `Schedule “${plan.label}”`),
    { id: createId(), label: 'Log a workout', kind: 'open_route', route: '/health' },
  ]
  if (plan.habitId) {
    actions.unshift({
      id: createId(),
      label: `Check in “${plan.label}”`,
      kind: 'toggle_habit',
      habitId: plan.habitId,
    })
  }
  return actions
}

function goalActions(goal: Goal, now: Date): AskAction[] {
  const pace = goalPaceStatus(goal, now)
  const actions: AskAction[] = [
    {
      id: createId(),
      label: `Open “${goal.title}”`,
      kind: 'open_route',
      route: `/goals?id=${goal.id}`,
    },
  ]
  if (pace.behind) {
    actions.unshift({
      id: createId(),
      label: 'Catch-up check-in',
      kind: 'adjust_goal',
      goalId: goal.id,
      title: goal.title,
    })
  }
  return actions
}

function buildWorkoutReason(plan: WorkoutPlan, gapMinutes: number, nextEvent: CalendarEvent | null): string {
  const parts: string[] = [
    `You planned ${plan.weeklyTarget} workouts this week — ${plan.completedThisWeek} done.`,
  ]
  if (nextEvent) {
    parts.push(
      `Next event ${formatTime(nextEvent.starts_at)} (~${Math.round(gapMinutes)} min free). Estimated workout: ${WORKOUT_ESTIMATE_MIN} minutes.`,
    )
  } else if (gapMinutes >= MIN_GAP_FOR_WORKOUT) {
    parts.push(`You have ~${Math.round(gapMinutes)} minutes open. Estimated workout: ${WORKOUT_ESTIMATE_MIN} minutes.`)
  } else {
    parts.push(`A ${WORKOUT_ESTIMATE_MIN}-minute session keeps you on pace.`)
  }
  return parts.join(' ')
}

function goalWithinHorizon(goal: Goal, now: Date): boolean {
  if (!goal.target_date) return false
  const target = new Date(goal.target_date.slice(0, 10))
  const days = (target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  return days >= 0 && days <= 45
}

function pickBehindGoal(snap: LifeSnapshot, now: Date): Goal | null {
  return snap.behindGoals.find((g) => goalWithinHorizon(g, now)) ?? snap.behindGoals[0] ?? null
}

/** Single source of truth for Today “Do this next” and Ask focus intents. */
export function pickNextStep(input: PickNextStepInput): NextStep | null {
  const now = input.now ?? new Date()
  const hour = now.getHours()
  const { snap, overdue, openHabits, atRiskHabits, workoutPlan, workedOutToday, dayClosed, sleep } = input
  const weights = input.preferenceWeights ?? DEFAULT_WEIGHTS
  const gap = findCalendarGap(snap.todayEvents, now)

  if (overdue[0]) {
    const task = overdue[0]
    return {
      kind: 'task',
      title: task.title,
      reason: 'Overdue — clearing this first keeps the rest of the day calm.',
      meta: `Task · Overdue${task.priority === 'high' ? ' · Important' : ''}`,
      actions: taskActions(task),
      taskId: task.id,
    }
  }

  const soonEvent = eventStartingWithin(snap.todayEvents, 90, now)
  if (soonEvent) {
    return {
      kind: 'event',
      title: soonEvent.title,
      reason: `Starting ${formatTime(soonEvent.starts_at)} — protect time to get there prepared.`,
      meta: `Event · ${formatShortDate(soonEvent.starts_at)} · ${formatTime(soonEvent.starts_at)}`,
      actions: eventActions(soonEvent),
      eventId: soonEvent.id,
    }
  }

  if (
    sleep?.veryShortSleep &&
    hour < 14 &&
    !workedOutToday &&
    !shouldDeprioritize('recovery', weights, { soft: true })
  ) {
    return {
      kind: 'recovery',
      title: 'Recovery first',
      reason: recoveryReason(sleep),
      meta: 'Sleep · Take it easier',
      actions: [
        { id: createId(), label: 'Log sleep', kind: 'open_route', route: '/health' },
        { id: createId(), label: 'Open journal', kind: 'open_route', route: '/journal' },
      ],
    }
  }

  const workoutSleepOk = !sleep?.veryShortSleep && !(sleep?.shortSleep && hour < 11)
  if (
    workoutPlan.enabled &&
    workoutSleepOk &&
    !workedOutToday &&
    isWorkoutBehind(workoutPlan, now) &&
    gap.minutes >= MIN_GAP_FOR_WORKOUT &&
    !shouldDeprioritize('workout', weights, { soft: workoutPlan.completedThisWeek > 0 })
  ) {
    return {
      kind: 'workout',
      title: workoutPlan.label,
      reason: sleep?.shortSleep
        ? `${buildWorkoutReason(workoutPlan, gap.minutes, gap.nextEvent)} Sleep was light (${sleep.lastNightHours}h) — consider a shorter session.`
        : buildWorkoutReason(workoutPlan, gap.minutes, gap.nextEvent),
      meta: 'Movement · On pace for the week',
      estimatedMinutes: WORKOUT_ESTIMATE_MIN,
      actions: workoutActions(workoutPlan, snap.todayEvents, now),
      habitId: workoutPlan.habitId,
    }
  }

  const priority = snap.priorityTasks[0]
  if (priority) {
    return {
      kind: 'task',
      title: priority.title,
      reason:
        snap.openTasks.length > 2
          ? `These two actually matter most today — start here. (${snap.openTasks.length - 1} others can wait.)`
          : 'Top priority on your list — one step, then reassess.',
      meta: `Task${priority.priority === 'high' ? ' · Important' : ''}`,
      actions: taskActions(priority),
      taskId: priority.id,
    }
  }

  if (atRiskHabits[0]) {
    const habit = atRiskHabits[0]
    return {
      kind: 'habit',
      title: habit.title,
      reason: 'Streak at risk — a quick check-in before the day ends.',
      meta: 'Habit · Streak at risk',
      actions: habitActions(habit),
      habitId: habit.id,
    }
  }

  const behindGoal = pickBehindGoal(snap, now)
  if (behindGoal && !shouldDeprioritize('goal', weights, { soft: true })) {
    const pace = goalPaceStatus(behindGoal, now)
    const dateBit = behindGoal.target_date
      ? ` Target: ${formatShortDate(behindGoal.target_date)}.`
      : ''
    const paceBit = pace.behind
      ? ` Expected ~${Math.round(pace.expectedPct)}% by now — you’re at ${Math.round(pace.actualPct)}%.`
      : ` You're at ${Math.round(pace.actualPct)}%.`
    return {
      kind: 'goal',
      title: behindGoal.title,
      reason: `${paceBit} One small step today keeps this goal reachable.${dateBit}`,
      meta: pace.behind ? 'Goal · Behind pace' : 'Goal · Needs attention',
      actions: goalActions(behindGoal, now),
      goalId: behindGoal.id,
    }
  }

  if (openHabits[0] && !shouldDeprioritize('habit', weights, { soft: true })) {
    const habit = openHabits[0]
    return {
      kind: 'habit',
      title: habit.title,
      reason: 'Still open today — one check-in is enough.',
      meta: 'Habit',
      actions: habitActions(habit),
      habitId: habit.id,
    }
  }

  const laterEvent = snap.todayEvents.find((e) => !e.all_day && new Date(e.starts_at).getTime() > now.getTime())
  if (laterEvent) {
    return {
      kind: 'event',
      title: laterEvent.title,
      reason: `On the calendar later — ${formatTime(laterEvent.starts_at)}. Use the open time before then.`,
      meta: `Event · ${formatTime(laterEvent.starts_at)}`,
      actions: eventActions(laterEvent),
      eventId: laterEvent.id,
    }
  }

  if (!dayClosed && hour >= 21) {
    return {
      kind: 'wind_down',
      title: 'Stop for the night',
      reason: 'Nothing urgent is waiting. Rest — or close the day when you’re ready.',
      meta: 'Evening',
      actions: [
        { id: createId(), label: 'Close day', kind: 'close_day', body: '' },
        { id: createId(), label: 'Open journal', kind: 'open_route', route: '/journal' },
      ],
    }
  }

  return null
}

export { resolveWorkoutPlan, isWorkoutBehind, findCalendarGap }
