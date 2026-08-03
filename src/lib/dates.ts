import { format, isToday, isSameDay, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isWithinInterval } from 'date-fns'

export function todayKey(date = new Date()): string {
  return format(date, 'yyyy-MM-dd')
}

export function formatShortDate(value: string | Date) {
  const date = typeof value === 'string' ? parseISO(value) : value
  if (isToday(date)) return 'Today'
  return format(date, 'MMM d')
}

export function formatTime(value: string | Date) {
  const date = typeof value === 'string' ? parseISO(value) : value
  return format(date, 'h:mm a')
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
