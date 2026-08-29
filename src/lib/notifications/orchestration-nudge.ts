import { buildSnapshot } from '@/modules/assistant/engine'
import { buildPickNextStepInput } from '@/lib/orchestration/build-input'
import { pickNextStep, type NextStep, type NextStepKind } from '@/lib/orchestration/next-step'
import { findCalendarGap } from '@/lib/orchestration/calendar-gaps'
import type { CalendarEvent } from '@/modules/calendar/types'

export type OrchestrationNudge = {
  kind: NextStepKind | 'event_soon'
  title: string
  body: string
  href: string
  tag: string
}

function hrefForStep(step: NextStep): string {
  if (step.kind === 'workout') return '/health'
  if (step.kind === 'habit' && step.habitId) return `/habits?id=${step.habitId}`
  if (step.kind === 'task' && step.taskId) return `/tasks?id=${step.taskId}`
  if (step.kind === 'event' && step.eventId) return `/calendar?id=${step.eventId}`
  if (step.kind === 'goal' && step.goalId) return `/goals?id=${step.goalId}`
  if (step.kind === 'wind_down') return '/dashboard'
  return '/dashboard'
}

/** Build a proactive nudge from the current orchestration picker. */
export function buildOrchestrationNudge(
  userId: string,
  options?: {
    displayName?: string
    preferences?: Record<string, unknown>
    dayClosed?: boolean
    now?: Date
  },
): OrchestrationNudge | null {
  const now = options?.now ?? new Date()
  const snap = buildSnapshot(userId, options?.displayName || 'there')
  const input = buildPickNextStepInput(userId, snap, {
    preferences: options?.preferences,
    dayClosed: options?.dayClosed,
    now,
  })
  const step = pickNextStep(input)
  if (!step) return null

  if (step.kind === 'wind_down') return null

  const tag = `katana-orch:${now.toISOString().slice(0, 10)}:${step.kind}`
  return {
    kind: step.kind,
    title: step.title,
    body: step.reason,
    href: hrefForStep(step),
    tag,
  }
}

/** Nudge when a calendar gap opens before the next event — workout-focused copy. */
export function buildGapWorkoutNudge(
  events: CalendarEvent[],
  workoutLabel: string,
  now = new Date(),
): OrchestrationNudge | null {
  const gap = findCalendarGap(events, now)
  if (gap.minutes < 45) return null
  const mins = Math.round(gap.minutes)
  const eventBit = gap.nextEvent ? ` before ${gap.nextEvent.title}` : ''
  const tag = `katana-gap:${now.toISOString().slice(0, 10)}`
  return {
    kind: 'workout',
    title: workoutLabel,
    body: `~${mins} minutes open${eventBit} — good window for a session.`,
    href: '/health',
    tag,
  }
}
