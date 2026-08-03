import { describe, expect, it } from 'vitest'
import {
  buildMemberCalendarEvents,
  computeMemberPerformanceStats,
} from './hr-member-scoped'
import type { Employee, Goal, PerformanceReview, TimeOffRequest } from './hr-api'

const employee: Employee = {
  id: 'emp-1',
  name: 'Alex',
  email: 'alex@example.com',
  department: 'Engineering',
  position: 'Engineer',
  hire_date: '2024-01-01',
  status: 'Active',
  performance_score: 4,
  next_review_date: '2026-06-15',
} as Employee

describe('computeMemberPerformanceStats', () => {
  it('counts completed, overdue, and upcoming from member reviews only', () => {
    const reviews: PerformanceReview[] = [
      {
        id: 'r1',
        employee_id: 'emp-1',
        review_date: '2026-01-01',
        status: 'on-time',
        collaboration: 4,
        accountability: 4,
        trustworthy: 4,
        leadership: 4,
      } as PerformanceReview,
      {
        id: 'r2',
        employee_id: 'emp-1',
        review_date: '2026-02-01',
        status: 'overdue',
        collaboration: 3,
        accountability: 3,
        trustworthy: 3,
        leadership: 3,
      } as PerformanceReview,
      {
        id: 'r3',
        employee_id: 'emp-1',
        review_date: '2026-08-01',
        status: 'upcoming',
        collaboration: 5,
        accountability: 5,
        trustworthy: 5,
        leadership: 5,
      } as PerformanceReview,
    ]

    const stats = computeMemberPerformanceStats(reviews, employee)
    expect(stats.completedReviews).toBe(1)
    expect(stats.overdueReviews).toBe(1)
    expect(stats.upcomingReviews).toBe(1)
    expect(stats.avgPerformanceScore).toBeCloseTo(4, 1)
  })
})

describe('buildMemberCalendarEvents', () => {
  it('includes reviews, goals, time off, and next review date', () => {
    const events = buildMemberCalendarEvents({
      reviews: [
        {
          id: 'r1',
          employee_id: 'emp-1',
          review_date: '2026-03-10',
          review_period: 'Q1',
          review_type: 'quarterly',
          status: 'on-time',
        } as PerformanceReview,
      ],
      goals: [
        {
          id: 'g1',
          employee_id: 'emp-1',
          goal: 'Ship feature',
          due_date: '2026-04-01',
          category: 'Delivery',
          status: 'On Track',
        } as Goal,
      ],
      timeOffRequests: [
        {
          id: 't1',
          employee_id: 'emp-1',
          start_date: '2026-05-01',
          end_date: '2026-05-03',
          type: 'PTO',
          status: 'approved',
        } as TimeOffRequest,
      ],
      employee,
    })

    const types = new Set(events.map((e) => e.type))
    expect(types.has('review')).toBe(true)
    expect(types.has('goal')).toBe(true)
    expect(types.has('time-off')).toBe(true)
    expect(types.has('next-review')).toBe(true)
  })
})
