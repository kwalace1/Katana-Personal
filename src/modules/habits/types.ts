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
  reminder_time: string | null
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
