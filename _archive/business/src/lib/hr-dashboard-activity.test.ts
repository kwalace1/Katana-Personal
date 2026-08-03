import { describe, it, expect } from 'vitest'
import { buildHrDashboardActivities, mergeHrDashboardActivities } from './hr-dashboard-activity'

describe('buildHrDashboardActivities', () => {
  it('includes new employees and applications', () => {
    const items = buildHrDashboardActivities({
      employees: [
        {
          id: 'e1',
          name: 'Alex Kim',
          position: 'Engineer',
          department: 'Engineering',
          status: 'Active',
          email: 'alex@example.com',
          hire_date: '2026-01-01',
          created_at: '2026-05-19T12:00:00Z',
          updated_at: '2026-05-19T12:00:00Z',
        },
      ],
      reviews: [],
      goals: [],
      applications: [
        {
          id: 'a1',
          jobId: 'j1',
          anonymousId: 'CAND-123',
          jobTitle: 'Service Advisor',
          appliedDate: '2026-05-18T10:00:00Z',
          firstName: 'Hidden',
          lastName: 'User',
          email: 'h@example.com',
          phone: '',
          location: '',
          coverLetter: '',
        },
      ],
      recognitions: [],
      learningPaths: [],
      mentorships: [],
    })

    expect(items.length).toBeGreaterThanOrEqual(2)
    expect(items.some((i) => i.message.includes('Alex Kim'))).toBe(true)
    expect(items.some((i) => i.category === 'Recruitment')).toBe(true)
  })
})

describe('mergeHrDashboardActivities', () => {
  it('dedupes and sorts by date', () => {
    const merged = mergeHrDashboardActivities(
      [
        {
          id: '1',
          type: 'employee_added',
          description: 'Logged event',
          created_at: '2026-05-19T10:00:00Z',
        },
      ],
      [
        {
          id: 's1',
          message: 'Logged event',
          sortAt: new Date('2026-05-19T10:00:00Z').getTime(),
          time: '1h ago',
          category: 'HR',
          variant: 'info',
        },
        {
          id: 's2',
          message: 'Newer synthetic',
          sortAt: new Date('2026-05-19T14:00:00Z').getTime(),
          time: 'now',
          category: 'HR',
          variant: 'info',
        },
      ],
      5
    )

    expect(merged[0]?.message).toBe('Newer synthetic')
    expect(merged.length).toBe(2)
  })
})
