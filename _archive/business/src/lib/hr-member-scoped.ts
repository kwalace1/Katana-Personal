import { parseDateKey } from '@/lib/due-date-utils'
import type { Employee, Goal, PerformanceReview, TimeOffRequest } from '@/lib/hr-api'

export type HrCalendarEventType = 'review' | 'goal' | 'time-off' | 'next-review'

export interface HrCalendarEvent {
  id: string
  dateKey: string
  type: HrCalendarEventType
  title: string
  subtitle?: string
  status?: string
}

function overallReviewRating(review: PerformanceReview): number {
  return (review.collaboration + review.accountability + review.trustworthy + review.leadership) / 4
}

export function computeMemberPerformanceStats(
  reviews: PerformanceReview[],
  employee: Employee | null | undefined
) {
  const avgPerformanceScore =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + overallReviewRating(r), 0) / reviews.length
      : employee?.performance_score ?? 0

  return {
    avgPerformanceScore,
    completedReviews: reviews.filter((r) => r.status === 'on-time').length,
    overdueReviews: reviews.filter((r) => r.status === 'overdue').length,
    upcomingReviews: reviews.filter((r) => r.status === 'upcoming').length,
  }
}

export function buildMemberCalendarEvents(input: {
  reviews: PerformanceReview[]
  goals: Goal[]
  timeOffRequests: TimeOffRequest[]
  employee: Employee | null | undefined
}): HrCalendarEvent[] {
  const events: HrCalendarEvent[] = []

  for (const review of input.reviews) {
    const key = parseDateKey(review.review_date)
    if (!key) continue
    events.push({
      id: `review-${review.id}`,
      dateKey: key,
      type: 'review',
      title: `Performance review · ${review.review_period}`,
      subtitle: review.review_type,
      status: review.status,
    })
  }

  for (const goal of input.goals) {
    const key = parseDateKey(goal.due_date)
    if (!key) continue
    events.push({
      id: `goal-${goal.id}`,
      dateKey: key,
      type: 'goal',
      title: `Goal due · ${goal.goal}`,
      subtitle: goal.category,
      status: goal.status,
    })
  }

  for (const req of input.timeOffRequests) {
    const start = parseDateKey(req.start_date)
    const end = parseDateKey(req.end_date)
    if (!start) continue
    events.push({
      id: `timeoff-${req.id}`,
      dateKey: start,
      type: 'time-off',
      title: `Time off · ${req.type}`,
      subtitle: end && end !== start ? `${start} – ${end}` : undefined,
      status: req.status,
    })
  }

  const nextKey = parseDateKey(input.employee?.next_review_date ?? null)
  if (nextKey && !input.reviews.some((r) => parseDateKey(r.review_date) === nextKey)) {
    events.push({
      id: `next-review-${input.employee?.id ?? 'self'}`,
      dateKey: nextKey,
      type: 'next-review',
      title: 'Upcoming performance review',
      subtitle: 'Scheduled review date',
      status: 'upcoming',
    })
  }

  return events.sort((a, b) => a.dateKey.localeCompare(b.dateKey))
}

export function eventsByDateKey(events: HrCalendarEvent[]): Map<string, HrCalendarEvent[]> {
  const map = new Map<string, HrCalendarEvent[]>()
  for (const ev of events) {
    const list = map.get(ev.dateKey) ?? []
    list.push(ev)
    map.set(ev.dateKey, list)
  }
  return map
}
