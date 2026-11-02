import {
  THEME_FAMILIES,
  type DayPeriod,
  type ThemeChange,
  type ThemeFamily,
  type ThemePreferences,
  type ThemeSchedule,
} from './types'

/** Local clock minutes when each period starts. Night continues until morning. */
const PERIOD_START_MINUTES = {
  morning: 5 * 60,
  day: 11 * 60,
  evening: 17 * 60,
  night: 21 * 60,
} as const

export const PERIOD_LABELS: Record<DayPeriod, string> = {
  morning: 'Morning',
  day: 'Daytime',
  evening: 'Evening',
  night: 'Night',
}

export const PERIOD_RANGES: Record<DayPeriod, string> = {
  morning: '5:00 AM – 11:00 AM',
  day: '11:00 AM – 5:00 PM',
  evening: '5:00 PM – 9:00 PM',
  night: '9:00 PM – 5:00 AM',
}

/** The one period active at this local time. Night covers 9:00 PM through 4:59 AM. */
export function periodAt(date: Date): DayPeriod {
  const minutes = date.getHours() * 60 + date.getMinutes()
  if (minutes >= PERIOD_START_MINUTES.morning && minutes < PERIOD_START_MINUTES.day) return 'morning'
  if (minutes >= PERIOD_START_MINUTES.day && minutes < PERIOD_START_MINUTES.evening) return 'day'
  if (minutes >= PERIOD_START_MINUTES.evening && minutes < PERIOD_START_MINUTES.night) return 'evening'
  return 'night'
}

/** The next local 5:00, 11:00, 5:00 PM, or 9:00 boundary after `date`. */
export function nextPeriodChange(date: Date): Date {
  return nextScheduleChange(presetChanges({
    morning: 'sunrise',
    day: 'ocean',
    evening: 'sunset',
    night: 'forest',
  }), date)
}

export function presetChanges(schedule: ThemeSchedule): ThemeChange[] {
  return [
    { minutes: PERIOD_START_MINUTES.morning, theme: schedule.morning },
    { minutes: PERIOD_START_MINUTES.day, theme: schedule.day },
    { minutes: PERIOD_START_MINUTES.evening, theme: schedule.evening },
    { minutes: PERIOD_START_MINUTES.night, theme: schedule.night },
  ]
}

export function sortChanges(changes: ThemeChange[]): ThemeChange[] {
  return [...changes].sort((a, b) => a.minutes - b.minutes)
}

/** Two or more distinct times. A shorter list is not used. */
export function isUsableSchedule(changes: ThemeChange[]): boolean {
  return changes.length >= 2 && new Set(changes.map((change) => change.minutes)).size === changes.length
}

/** Preset changes, unless a usable custom list is the saved kind. */
export function changesFor(
  prefs: Pick<ThemePreferences, 'scheduleKind' | 'schedule' | 'customSchedule'>,
): ThemeChange[] {
  if (prefs.scheduleKind === 'custom' && isUsableSchedule(prefs.customSchedule)) {
    return sortChanges(prefs.customSchedule)
  }
  return presetChanges(prefs.schedule)
}

/**
 * The change in effect at this local time.
 * The latest start at or before now wins. Before the first start, the last change carries overnight.
 */
export function activeChangePoint(changes: ThemeChange[], date: Date): ThemeChange | null {
  if (changes.length === 0) return null
  const sorted = sortChanges(changes)
  const minutes = date.getHours() * 60 + date.getMinutes()
  let active = sorted[sorted.length - 1]
  for (const change of sorted) {
    if (change.minutes <= minutes) active = change
  }
  return active ?? null
}

/**
 * The next local minute after `date` where a different change is active.
 * Walking real elapsed time follows a skipped or repeated daylight-saving hour.
 */
export function nextScheduleChange(changes: ThemeChange[], date: Date): Date {
  const current = activeChangePoint(changes, date)?.minutes
  const start = date.getTime()
  if (changes.length > 0) {
    for (let step = 1; step <= 26 * 60; step++) {
      const probe = new Date(start + step * 60 * 1000)
      if (activeChangePoint(changes, probe)?.minutes === current) continue
      probe.setSeconds(0, 0)
      return probe.getTime() > start ? probe : new Date(start + 1000)
    }
  }
  const tomorrow = new Date(date)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(PERIOD_START_MINUTES.morning / 60, 0, 0, 0)
  if (tomorrow.getTime() <= start) tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow
}

export function formatClock(minutes: number): string {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const twelve = hour % 12 || 12
  return `${twelve}:${String(minute).padStart(2, '0')} ${suffix}`
}

export type ThemeChangeDraft = {
  minutes: number | null
  theme: ThemeFamily
}

/** True when the draft still matches the saved list, including order-independent times. */
export function schedulesMatch(draft: ThemeChangeDraft[], saved: ThemeChange[]): boolean {
  if (draft.length !== saved.length || draft.some((change) => change.minutes == null)) return false
  const left = [...draft].sort((a, b) => (a.minutes ?? 0) - (b.minutes ?? 0))
  const right = sortChanges(saved)
  return left.every((change, index) => change.minutes === right[index]?.minutes && change.theme === right[index]?.theme)
}

/**
 * A free clock time for a new row.
 * One hour after the latest change keeps the new row at the end of the list.
 * If that hour is taken or would pass midnight, the middle of the largest open gap is used.
 */
export function suggestChangeMinutes(minutes: Array<number | null>): number | null {
  const used = new Set(
    minutes.filter((value): value is number => value != null && Number.isInteger(value) && value >= 0 && value <= 1439),
  )
  const times = [...used].sort((a, b) => a - b)
  if (times.length === 0) return 12 * 60

  const last = times[times.length - 1] ?? 0
  for (const step of [60, 30, 90, 120]) {
    const candidate = last + step
    if (candidate <= 1439 && !used.has(candidate)) return candidate
  }

  let bestStart = last
  let bestEnd = (times[0] ?? 0) + 24 * 60
  let bestGap = bestEnd - bestStart
  for (let index = 0; index < times.length - 1; index++) {
    const start = times[index] ?? 0
    const end = times[index + 1] ?? start
    const gap = end - start
    if (gap > bestGap) {
      bestGap = gap
      bestStart = start
      bestEnd = end
    }
  }
  if (bestGap < 2) return null

  const snapped = Math.round((bestStart + Math.floor(bestGap / 2)) / 30) * 30
  const inGap = (value: number) => {
    const later = value <= bestStart ? value + 24 * 60 : value
    return later > bestStart && later < bestEnd
  }
  for (let step = 0; step < 24 * 60; step += 30) {
    const forward = (snapped + step) % (24 * 60)
    if (!used.has(forward) && inGap(forward)) return forward
    if (step === 0) continue
    const backward = (snapped - step + 24 * 60) % (24 * 60)
    if (!used.has(backward) && inGap(backward)) return backward
  }
  for (let minute = 0; minute < 24 * 60; minute++) {
    if (!used.has(minute)) return minute
  }
  return null
}

export function validateCustomSchedule(
  draft: ThemeChangeDraft[],
): { ok: true; changes: ThemeChange[] } | { ok: false; message: string } {
  if (draft.length < 2) return { ok: false, message: 'Add at least two theme changes.' }
  if (draft.some((change) => change.minutes == null)) return { ok: false, message: 'Each change needs a time.' }
  const changes = draft.map((change) => ({
    minutes: change.minutes ?? 0,
    theme: change.theme,
  }))
  if (changes.some((change) => !Number.isInteger(change.minutes) || change.minutes < 0 || change.minutes > 1439)) {
    return { ok: false, message: 'Each change needs a time.' }
  }
  if (changes.some((change) => !(THEME_FAMILIES as readonly string[]).includes(change.theme))) {
    return { ok: false, message: 'Choose a theme for each time.' }
  }
  if (new Set(changes.map((change) => change.minutes)).size !== changes.length) {
    return { ok: false, message: 'Two changes use the same time.' }
  }
  return { ok: true, changes: sortChanges(changes) }
}
