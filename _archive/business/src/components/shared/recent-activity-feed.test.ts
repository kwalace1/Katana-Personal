import { describe, it, expect } from 'vitest'
import {
  filterByModule,
  filterByPeriod,
  getActivityModules,
  type FeedActivity,
} from './recent-activity-feed'

const sample: FeedActivity[] = [
  {
    type: 'info',
    module: 'PM',
    message: 'Task updated',
    time: '1h ago',
    sortAt: Date.now() - 3_600_000,
  },
  {
    type: 'info',
    module: 'Customers',
    message: 'Call logged',
    time: '2h ago',
    sortAt: Date.now() - 7_200_000,
  },
  {
    type: 'success',
    module: 'PM',
    message: 'Task done',
    time: '3d ago',
    sortAt: Date.now() - 3 * 86_400_000,
  },
]

describe('recent activity filters', () => {
  it('filters by module', () => {
    expect(filterByModule(sample, 'PM')).toHaveLength(2)
    expect(filterByModule(sample, 'Customers')).toHaveLength(1)
    expect(filterByModule(sample, 'all')).toHaveLength(3)
  })

  it('lists unique modules', () => {
    expect(getActivityModules(sample)).toEqual(['Customers', 'PM'])
  })

  it('filters by period', () => {
    const todayOnly: FeedActivity[] = [
      { ...sample[0]!, sortAt: Date.now() - 60_000 },
      { ...sample[2]!, sortAt: Date.now() - 40 * 86_400_000 },
    ]
    const week = filterByPeriod(todayOnly, 'week')
    expect(week).toHaveLength(1)
    expect(week[0]?.module).toBe('PM')
  })
})
