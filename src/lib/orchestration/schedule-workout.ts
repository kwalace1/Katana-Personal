import { addDays, todayKey } from '@/lib/dates'
import { createId } from '@/lib/id'
import type { AskAction } from '@/modules/assistant/ask-api'
import type { CalendarEvent } from '@/modules/calendar/types'
import { findCalendarGap } from './calendar-gaps'

export const WORKOUT_BLOCK_MIN = 55

export interface WorkoutSlot {
  startsAt: string
  endsAt: string
  label: string
  reason: string
}

function atLocalTime(day: Date, hour: number, minute = 0): Date {
  const d = new Date(day)
  d.setHours(hour, minute, 0, 0)
  return d
}

/** Pick the next sensible workout window — today if gap fits, else tomorrow morning. */
export function pickWorkoutSlot(
  events: CalendarEvent[],
  label: string,
  now = new Date(),
  opts?: { preferTomorrowMorning?: boolean },
): WorkoutSlot {
  const gap = findCalendarGap(events, now)
  const tomorrow = addDays(now, 1)
  const tomorrowMorning = atLocalTime(tomorrow, 7, 0)
  const tomorrowEnd = new Date(tomorrowMorning.getTime() + WORKOUT_BLOCK_MIN * 60_000)

  if (
    opts?.preferTomorrowMorning ||
    (gap.minutes < WORKOUT_BLOCK_MIN && now.getHours() >= 18)
  ) {
    return {
      startsAt: tomorrowMorning.toISOString(),
      endsAt: tomorrowEnd.toISOString(),
      label,
      reason: `Tomorrow morning (${tomorrowMorning.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}) — fresh start before the day fills up.`,
    }
  }

  if (gap.minutes >= WORKOUT_BLOCK_MIN) {
    const start = new Date(now.getTime() + 10 * 60_000)
    start.setSeconds(0, 0)
    const end = new Date(start.getTime() + WORKOUT_BLOCK_MIN * 60_000)
    const eventBit = gap.nextEvent
      ? ` before ${gap.nextEvent.title} at ${new Date(gap.nextEvent.starts_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
      : ''
    return {
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      label,
      reason: `~${Math.round(gap.minutes)} minutes open${eventBit} — good window for a ${WORKOUT_BLOCK_MIN}-minute session.`,
    }
  }

  return {
    startsAt: tomorrowMorning.toISOString(),
    endsAt: tomorrowEnd.toISOString(),
    label,
    reason: 'Today is tight — blocking tomorrow morning keeps you on pace without forcing it tonight.',
  }
}

export function scheduleWorkoutAction(
  slot: WorkoutSlot,
  label = 'Schedule workout block',
): AskAction {
  const tomorrow = addDays(new Date(), 1)
  const isTomorrow = todayKey(new Date(slot.startsAt)) === todayKey(tomorrow)
  return {
    id: createId(),
    label,
    kind: 'schedule_workout',
    title: slot.label,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    body: isTomorrow ? 'tomorrow' : undefined,
  }
}

export function scheduleWorkoutOnDate(
  userId: string,
  slot: WorkoutSlot,
): { date: string; startsAt: string; endsAt: string } {
  void userId
  return {
    date: todayKey(new Date(slot.startsAt)),
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
  }
}
