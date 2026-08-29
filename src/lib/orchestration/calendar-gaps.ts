import type { CalendarEvent } from '@/modules/calendar/types'

export interface CalendarGap {
  /** Minutes of free time in the current window */
  minutes: number
  /** Next timed event after the gap starts (or during gap) */
  nextEvent: CalendarEvent | null
}

function eventEndMs(event: CalendarEvent): number {
  return new Date(event.ends_at || event.starts_at).getTime()
}

function eventStartMs(event: CalendarEvent): number {
  return new Date(event.starts_at).getTime()
}

/** Find how many minutes are free before the next commitment today. */
export function findCalendarGap(todayEvents: CalendarEvent[], now = new Date()): CalendarGap {
  const nowMs = now.getTime()
  const timed = todayEvents
    .filter((e) => !e.all_day)
    .sort((a, b) => eventStartMs(a) - eventStartMs(b))

  const endOfDay = new Date(now)
  endOfDay.setHours(23, 0, 0, 0)
  const endOfDayMs = endOfDay.getTime()

  const inProgress = timed.find((e) => nowMs >= eventStartMs(e) && nowMs < eventEndMs(e))
  if (inProgress) {
    const afterMs = eventEndMs(inProgress)
    const next = timed.find((e) => eventStartMs(e) >= afterMs)
    if (!next) {
      return {
        minutes: Math.max(0, Math.round((endOfDayMs - afterMs) / 60_000)),
        nextEvent: null,
      }
    }
    return {
      minutes: Math.max(0, Math.round((eventStartMs(next) - afterMs) / 60_000)),
      nextEvent: next,
    }
  }

  const next = timed.find((e) => eventStartMs(e) > nowMs) ?? null
  if (!next) {
    return {
      minutes: Math.max(0, Math.round((endOfDayMs - nowMs) / 60_000)),
      nextEvent: null,
    }
  }

  return {
    minutes: Math.max(0, Math.round((eventStartMs(next) - nowMs) / 60_000)),
    nextEvent: next,
  }
}

/** True when an event starts within the next N minutes. */
export function eventStartingWithin(
  todayEvents: CalendarEvent[],
  withinMinutes: number,
  now = new Date(),
): CalendarEvent | null {
  const nowMs = now.getTime()
  const horizon = nowMs + withinMinutes * 60_000
  return (
    todayEvents
      .filter((e) => !e.all_day)
      .find((e) => {
        const start = eventStartMs(e)
        return start >= nowMs - 5 * 60_000 && start <= horizon
      }) ?? null
  )
}
