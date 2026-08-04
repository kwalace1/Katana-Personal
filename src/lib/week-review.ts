import { format, startOfWeek, todayKey, addDays } from '@/lib/dates'

/** Monday-start week id, e.g. 2026-08-03 */
export function weekKey(date = new Date()): string {
  return todayKey(startOfWeek(date, { weekStartsOn: 1 }))
}

export function weekLabel(date = new Date()): string {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = addDays(start, 6)
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`
}

const REVIEW_KEY = 'katana-personal:week-review'

export function reviewedThisWeek(): boolean {
  return localStorage.getItem(REVIEW_KEY) === weekKey()
}

export function markWeekReviewed(): void {
  localStorage.setItem(REVIEW_KEY, weekKey())
}

/** Show weekly review on Sunday or Monday, or if they haven't closed one this week yet late in the week. */
export function shouldOfferWeekReview(date = new Date()): boolean {
  if (reviewedThisWeek()) return false
  const day = date.getDay() // 0 Sun … 6 Sat
  const hour = date.getHours()
  if (day === 0 || day === 1) return true
  if (day >= 5 && hour >= 16) return true
  return false
}
