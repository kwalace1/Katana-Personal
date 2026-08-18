import { format, isToday, isSameDay, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isWithinInterval } from 'date-fns'

export function todayKey(date = new Date()): string {
  return format(date, 'yyyy-MM-dd')
}

export function formatShortDate(value: string | Date) {
  const date = typeof value === 'string' ? parseISO(value) : value
  if (isToday(date)) return 'Today'
  return format(date, 'MMM d')
}

/** True when due/start is a real clock time, not the date-only sentinels (midnight or 5pm). */
export function hasClockTime(value: string | Date) {
  const date = typeof value === 'string' ? parseISO(value) : value
  const hours = date.getHours()
  const minutes = date.getMinutes()
  if (hours === 0 && minutes === 0) return false
  if (hours === 17 && minutes === 0) return false
  return true
}

function formatClock(date: Date) {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? 'pm' : 'am'
  const hour = hours % 12 || 12
  return minutes ? `${hour}:${String(minutes).padStart(2, '0')}${ampm}` : `${hour}${ampm}`
}

/** “Today 3pm”, “Aug 21 3pm”, or date-only when no clock was set. */
export function formatShortWhen(value: string | Date) {
  const date = typeof value === 'string' ? parseISO(value) : value
  const day = formatShortDate(date)
  return hasClockTime(date) ? `${day} ${formatClock(date)}` : day
}

export function formatTime(value: string | Date) {
  const date = typeof value === 'string' ? parseISO(value) : value
  if (!hasClockTime(date)) return format(date, 'h:mm a')
  return formatClock(date)
}

export function toIsoDate(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

export {
  format,
  isToday,
  isSameDay,
  parseISO,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  isWithinInterval,
}
