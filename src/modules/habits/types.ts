export type HabitSchedule = 'daily' | 'weekdays' | 'weekends' | 'custom' | 'once'

/** JS Date#getDay(): 0 = Sunday … 6 = Saturday */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Habit {
  id: string
  user_id: string
  title: string
  schedule: HabitSchedule
  /** Used when schedule is `custom` — which weekdays repeat. */
  custom_days: Weekday[]
  /** Used when schedule is `once` — YYYY-MM-DD. */
  once_date: string | null
  /** First reminder slot (kept for older data + calendar chips). */
  reminder_time: string | null
  /** Extra HH:mm slots. Combined with `reminder_time` when firing. */
  reminder_times: string[]
  /** After the first reminder, keep pinging through the day until checked in. */
  nudge_until_done: boolean
  created_at: string
  updated_at: string
}

export interface HabitLog {
  id: string
  user_id: string
  habit_id: string
  date: string
  completed: boolean
  created_at: string
}

export const WEEKDAY_OPTIONS: { day: Weekday; short: string; label: string }[] = [
  { day: 0, short: 'Sun', label: 'Sunday' },
  { day: 1, short: 'Mon', label: 'Monday' },
  { day: 2, short: 'Tue', label: 'Tuesday' },
  { day: 3, short: 'Wed', label: 'Wednesday' },
  { day: 4, short: 'Thu', label: 'Thursday' },
  { day: 5, short: 'Fri', label: 'Friday' },
  { day: 6, short: 'Sat', label: 'Saturday' },
]

export function resolveHabitDays(habit: Pick<Habit, 'schedule' | 'custom_days'>): Weekday[] {
  if (habit.schedule === 'daily') return [0, 1, 2, 3, 4, 5, 6]
  if (habit.schedule === 'weekdays') return [1, 2, 3, 4, 5]
  if (habit.schedule === 'weekends') return [0, 6]
  if (habit.schedule === 'custom') {
    return [...(habit.custom_days || [])].sort((a, b) => a - b) as Weekday[]
  }
  return []
}

export function formatHabitSchedule(
  habit: Pick<Habit, 'schedule' | 'custom_days' | 'once_date'>,
): string {
  if (habit.schedule === 'daily') return 'Every day'
  if (habit.schedule === 'weekdays') return 'Weekdays'
  if (habit.schedule === 'weekends') return 'Weekends'
  if (habit.schedule === 'once') return habit.once_date ? `Once · ${habit.once_date}` : 'One time'
  const days = resolveHabitDays(habit)
  if (days.length === 0) return 'Custom (pick days)'
  return days.map((d) => WEEKDAY_OPTIONS.find((o) => o.day === d)?.short || String(d)).join(', ')
}

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/

export function parseReminderClock(value: string): { hh: number; mm: number } | null {
  const match = TIME_RE.exec(value.trim())
  if (!match) return null
  return { hh: Number(match[1]), mm: Number(match[2]) }
}

export function formatReminderClock(hh: number, mm: number): string {
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** Unique, sorted, valid HH:mm values. */
export function normalizeReminderTimes(times: Array<string | null | undefined>): string[] {
  const set = new Set<string>()
  for (const raw of times) {
    if (!raw) continue
    const parsed = parseReminderClock(raw)
    if (!parsed) continue
    set.add(formatReminderClock(parsed.hh, parsed.mm))
  }
  return [...set].sort()
}

export function reminderTimesOf(
  habit: Pick<Habit, 'reminder_time' | 'reminder_times'>,
): string[] {
  return normalizeReminderTimes([...(habit.reminder_times || []), habit.reminder_time])
}

/**
 * If the habit should keep pinging, fill gaps every `stepHours` from the first
 * slot until `untilHour` (local), capped so a day never explodes with alerts.
 */
export function resolveHabitReminderTimes(
  habit: Pick<Habit, 'reminder_time' | 'reminder_times' | 'nudge_until_done'>,
  stepHours = 3,
  untilHour = 21,
  maxSlots = 5,
): string[] {
  const set = reminderTimesOf(habit)
  if (set.length === 0) return []
  if (habit.nudge_until_done === false) return set.slice(0, maxSlots)

  const first = parseReminderClock(set[0]!)
  if (!first) return set.slice(0, maxSlots)
  const extras: string[] = []
  for (let hour = first.hh + stepHours; hour <= untilHour; hour += stepHours) {
    extras.push(formatReminderClock(hour, first.mm))
  }
  return normalizeReminderTimes([...set, ...extras]).slice(0, maxSlots)
}
