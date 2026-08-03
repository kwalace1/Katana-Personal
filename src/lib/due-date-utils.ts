import type { Task } from './project-data'

/** Calendar date in local timezone as YYYY-MM-DD */
export function getTodayDateKey(asOf: Date = new Date()): string {
  const y = asOf.getFullYear()
  const m = String(asOf.getMonth() + 1).padStart(2, '0')
  const d = String(asOf.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Convert a Date (e.g. calendar picker) to YYYY-MM-DD in local timezone */
export function toDateKey(date: Date): string {
  return getTodayDateKey(date)
}

/** Local calendar date N days from a reference day */
export function dateKeyDaysFromNow(days: number, asOf: Date = new Date()): string {
  const d = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate(), 12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return getTodayDateKey(d)
}

/** Parse stored date-only value as local calendar date (noon avoids DST edge cases) */
export function parseDateOnly(value: string | null | undefined): Date | null {
  const key = parseDateKey(value)
  if (!key) return null
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/** Format a stored date-only value for display (never shifts day in US/other timezones) */
export function formatDateOnly(
  value: string | null | undefined,
  localeOrOptions?: string | Intl.DateTimeFormatOptions,
  maybeOptions?: Intl.DateTimeFormatOptions
): string {
  const date = parseDateOnly(value)
  if (!date) return ''
  let locale: string | undefined
  let options: Intl.DateTimeFormatOptions
  if (typeof localeOrOptions === 'string') {
    locale = localeOrOptions
    options = maybeOptions ?? { month: 'short', day: 'numeric', year: 'numeric' }
  } else {
    options = localeOrOptions ?? { month: 'short', day: 'numeric', year: 'numeric' }
  }
  return date.toLocaleDateString(locale, options)
}

/** Format date-only or ISO timestamp; date-only strings always keep their calendar day */
export function formatStoredDate(
  value: string | null | undefined,
  localeOrOptions?: string | Intl.DateTimeFormatOptions,
  maybeOptions?: Intl.DateTimeFormatOptions
): string {
  if (!value?.trim()) return ''
  const key = parseDateKey(value)
  if (key) return formatDateOnly(key, localeOrOptions, maybeOptions)
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  let locale: string | undefined
  let options: Intl.DateTimeFormatOptions
  if (typeof localeOrOptions === 'string') {
    locale = localeOrOptions
    options = maybeOptions ?? { month: 'short', day: 'numeric', year: 'numeric' }
  } else {
    locale = undefined
    options = localeOrOptions ?? { month: 'short', day: 'numeric', year: 'numeric' }
  }
  return parsed.toLocaleDateString(locale, options)
}

/** Normalize ISO or date string to YYYY-MM-DD for comparison */
export function parseDateKey(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10)
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return getTodayDateKey(parsed)
}

/** True when the due date is strictly before today (not including today) */
export function isPastDueDate(dueDate: string | null | undefined, asOf: Date = new Date()): boolean {
  const due = parseDateKey(dueDate)
  if (!due) return false
  return due < getTodayDateKey(asOf)
}

export function daysUntilDue(dueDate: string | null | undefined, asOf: Date = new Date()): number | null {
  const due = parseDateKey(dueDate)
  if (!due) return null
  const dueMs = parseDateOnly(due)!.getTime()
  const todayMs = parseDateOnly(getTodayDateKey(asOf))!.getTime()
  return Math.round((dueMs - todayMs) / (24 * 60 * 60 * 1000))
}

/** Human-readable due date relative to today */
export function formatDueDateLabel(dueDate: string | null | undefined, asOf: Date = new Date()): string {
  const due = parseDateKey(dueDate)
  if (!due) return 'No due date'

  const diff = daysUntilDue(due, asOf)
  if (diff === null) return 'No due date'
  if (diff === 0) return 'Due today'
  if (diff === 1) return 'Due tomorrow'
  if (diff === -1) return '1 day overdue'
  if (diff < 0) return `${Math.abs(diff)} days overdue`
  if (diff <= 7) return `Due in ${diff} days`

  return `Due ${formatDateOnly(due, { month: 'short', day: 'numeric', year: 'numeric' })}`
}

export function isPmTaskOverdue(task: Pick<Task, 'deadline' | 'status'>, asOf: Date = new Date()): boolean {
  return task.status !== 'done' && isPastDueDate(task.deadline, asOf)
}

export function enrichPmTask<T extends Task>(task: T, asOf: Date = new Date()): T {
  const overdue = isPmTaskOverdue(task, asOf)
  return {
    ...task,
    isOverdue: overdue,
    dueDateLabel: formatDueDateLabel(task.deadline, asOf),
  }
}

export const PM_OVERDUE_REVERT_FROM_STATUS = 'in-progress' as const
export const PM_OVERDUE_REVERT_TO_STATUS = 'backlog' as const
