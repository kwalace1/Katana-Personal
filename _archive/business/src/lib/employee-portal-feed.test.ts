import { describe, it, expect } from 'vitest'
import {
  mentionsEmployee,
  isHrActivityForYou,
  isHrActivityCompany,
  isProjectActivityForYou,
  buildEmployeePortalFeed,
  filterEmployeePortalFeed,
  mergeCommsIntoFeed,
  compareEmployeePortalFeedItems,
  sortEmployeePortalFeed,
  isDeadlineFeedItem,
  isUpdateFeedItem,
  isCommsFeedItem,
  FEED_PRIORITY,
  EMPLOYEE_PORTAL_PM_ACTIVITY_COMPANY_CAP,
} from './employee-portal-feed'
import type { EmployeePortalFeedItem } from './employee-portal-feed'
import type { Activity } from './hr-api'

describe('mentionsEmployee', () => {
  it('matches full name in description', () => {
    expect(mentionsEmployee('Performance review completed for Kevin Wallace', 'Kevin Wallace')).toBe(true)
  })

  it('does not match unrelated text', () => {
    expect(mentionsEmployee('New employee Jane Doe added', 'Kevin Wallace')).toBe(false)
  })
})

describe('isHrActivityForYou', () => {
  const activity: Activity = {
    id: '1',
    type: 'goal_completed',
    description: 'Kevin Wallace completed goal: Q1 target',
    employee_id: 'emp-1',
    employee_name: 'Kevin Wallace',
    created_at: new Date().toISOString(),
  }

  it('matches by employee_id', () => {
    expect(isHrActivityForYou(activity, 'emp-1', 'Kevin Wallace')).toBe(true)
  })

  it('matches by name in description when id differs', () => {
    expect(isHrActivityForYou(activity, 'other', 'Kevin Wallace')).toBe(true)
  })
})

describe('isHrActivityCompany', () => {
  it('treats org-wide types as company', () => {
    const a: Activity = {
      id: '2',
      type: 'employee_added',
      description: 'New employee added',
      employee_id: null,
      created_at: new Date().toISOString(),
    }
    expect(isHrActivityCompany(a, 'emp-1')).toBe(true)
  })

  it('treats other employees as company', () => {
    const a: Activity = {
      id: '3',
      type: 'goal_added',
      description: 'Goal for Jane',
      employee_id: 'emp-2',
      created_at: new Date().toISOString(),
    }
    expect(isHrActivityCompany(a, 'emp-1')).toBe(true)
  })
})

describe('isProjectActivityForYou', () => {
  const myIds = new Set(['proj-1'])

  it('matches when project is assigned', () => {
    expect(
      isProjectActivityForYou(
        { description: 'Task updated', user: 'Someone', project_id: 'proj-1' },
        'Kevin Wallace',
        myIds
      )
    ).toBe(true)
  })

  it('matches when description mentions employee', () => {
    expect(
      isProjectActivityForYou(
        { description: 'Assigned to Kevin Wallace', user: 'PM', project_id: 'proj-9' },
        'Kevin Wallace',
        myIds
      )
    ).toBe(true)
  })
})

describe('buildEmployeePortalFeed and filter', () => {
  const base = {
    employeeId: 'emp-1',
    employeeName: 'Kevin Wallace',
    goals: [],
    learningPaths: [],
    recognitions: [],
    reviews: [],
    myProjects: [],
    hrActivities: [],
    projectActivities: [],
    goalsCompleted: 0,
    recognitionsCount: 0,
    trainingCompleted: 0,
  }

  it('includes assigned goals under for_you scope', () => {
    const items = buildEmployeePortalFeed({
      ...base,
      goals: [
        {
          id: 'g1',
          employee_id: 'emp-1',
          goal: 'Ship feature',
          status: 'On Track',
          due_date: new Date(Date.now() + 86400000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    })
    expect(items.some((i) => i.category === 'assigned' && i.scope === 'for_you')).toBe(true)
  })

  it('does not include HR notices in the activity feed (pinned HR card only)', () => {
    const items = buildEmployeePortalFeed(base)
    expect(items.some((i) => i.id.startsWith('hr-notice-'))).toBe(false)
  })

  it('caps company-wide PM activity while keeping for_you project activity', () => {
    const companyActivities = Array.from({ length: 25 }, (_, i) => ({
      id: `company-${i}`,
      project_id: `proj-other-${i}`,
      type: 'task_created',
      description: `Activity ${i} on other project`,
      user: 'Someone Else',
      created_at: new Date(Date.now() - i * 60000).toISOString(),
    }))
    const forYouActivity = {
      id: 'mine-1',
      project_id: 'proj-mine',
      type: 'task_completed',
      description: 'Kevin Wallace completed a task',
      user: 'Kevin Wallace',
      created_at: new Date().toISOString(),
    }

    const items = buildEmployeePortalFeed({
      ...base,
      myProjects: [
        {
          projectId: 'proj-mine',
          projectName: 'My Project',
          tasks: [{ id: 't1', title: 'Task 1' }],
        },
      ],
      projectActivities: [forYouActivity, ...companyActivities],
    })

    const pmItems = items.filter((i) => i.id.startsWith('pm-activity-'))
    const companyPm = pmItems.filter((i) => i.scope === 'company')
    const forYouPm = pmItems.filter((i) => i.scope === 'for_you')

    expect(forYouPm).toHaveLength(1)
    expect(companyPm).toHaveLength(EMPLOYEE_PORTAL_PM_ACTIVITY_COMPANY_CAP)
    expect(pmItems).toHaveLength(EMPLOYEE_PORTAL_PM_ACTIVITY_COMPANY_CAP + 1)
  })

  it('filters to company scope only', () => {
    const items = buildEmployeePortalFeed({
      ...base,
      hrActivities: [
        {
          id: 'a1',
          type: 'employee_added',
          description: 'New hire joined',
          employee_id: null,
          created_at: new Date().toISOString(),
        },
        {
          id: 'a2',
          type: 'goal_completed',
          description: 'Kevin Wallace completed goal',
          employee_id: 'emp-1',
          created_at: new Date().toISOString(),
        },
      ],
    })
    const companyOnly = filterEmployeePortalFeed(items, 'company', 'all')
    expect(companyOnly.every((i) => i.scope === 'company')).toBe(true)
    expect(companyOnly.some((i) => i.title.includes('New hire'))).toBe(true)
  })

  it('deadlines filter excludes comms messages', () => {
    const items = mergeCommsIntoFeed(
      buildEmployeePortalFeed({
        ...base,
        goals: [
          {
            id: 'g1',
            employee_id: 'emp-1',
            goal: 'Ship feature',
            status: 'On Track',
            due_date: new Date(Date.now() + 2 * 86400000).toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      }),
      [
        {
          id: 'comms-abc',
          scope: 'for_you',
          category: 'notification',
          sortAt: Date.now(),
          priorityRank: FEED_PRIORITY.COMMS_UNREAD,
          title: 'Message from Jane',
          unread: true,
          iconKind: 'message',
          quickView: { details: [] },
        },
      ]
    )
    const deadlines = filterEmployeePortalFeed(items, 'all', 'deadlines')
    expect(deadlines.some((i) => isCommsFeedItem(i))).toBe(false)
    expect(deadlines.some((i) => i.id.startsWith('event-goal-') || i.id.startsWith('notif-goal-'))).toBe(
      true
    )
  })

  it('updates filter includes comms but not due-soon goal alerts', () => {
    const dueSoon = new Date(Date.now() + 2 * 86400000).toISOString()
    const items = mergeCommsIntoFeed(
      buildEmployeePortalFeed({
        ...base,
        goals: [
          {
            id: 'g1',
            employee_id: 'emp-1',
            goal: 'Ship feature',
            status: 'On Track',
            due_date: dueSoon,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      }),
      [
        {
          id: 'comms-xyz',
          scope: 'for_you',
          category: 'notification',
          sortAt: Date.now(),
          priorityRank: FEED_PRIORITY.COMMS_UNREAD,
          title: 'Message from Jane',
          unread: true,
          iconKind: 'message',
          quickView: { details: [] },
        },
      ]
    )
    const updates = filterEmployeePortalFeed(items, 'all', 'updates')
    expect(updates.some((i) => isCommsFeedItem(i))).toBe(true)
    expect(updates.some((i) => isDeadlineFeedItem(i))).toBe(false)
  })
})

describe('sortEmployeePortalFeed', () => {
  const mk = (overrides: Partial<EmployeePortalFeedItem>): EmployeePortalFeedItem => ({
    id: overrides.id ?? 'item-1',
    scope: 'for_you',
    category: 'notification',
    sortAt: Date.now(),
    title: 'Test',
    iconKind: 'bell',
    quickView: { details: [] },
    ...overrides,
  })

  it('sorts unread comms messages before read items', () => {
    const items = sortEmployeePortalFeed([
      mk({ id: 'read', sortAt: Date.now(), priorityRank: FEED_PRIORITY.ACTIVITY }),
      mk({
        id: 'comms-unread',
        unread: true,
        priorityRank: FEED_PRIORITY.COMMS_UNREAD,
        urgencyLabel: 'Unread message',
        iconKind: 'message',
      }),
    ])
    expect(items[0].id).toBe('comms-unread')
  })

  it('sorts due-soon deadlines before general activity at same unread state', () => {
    const dueSoon = Date.now() + 86400000
    const items = sortEmployeePortalFeed([
      mk({ id: 'activity', category: 'activity', priorityRank: FEED_PRIORITY.ACTIVITY }),
      mk({
        id: 'deadline',
        category: 'event',
        sortAt: dueSoon,
        priorityRank: FEED_PRIORITY.DUE_SOON,
        urgencyLabel: 'Due soon',
      }),
    ])
    expect(items[0].id).toBe('deadline')
  })

  it('orders soonest deadlines first among deadline items', () => {
    const sooner = Date.now() + 86400000
    const later = Date.now() + 3 * 86400000
    const items = sortEmployeePortalFeed([
      mk({
        id: 'later',
        category: 'event',
        sortAt: later,
        priorityRank: FEED_PRIORITY.DUE_SOON,
      }),
      mk({
        id: 'sooner',
        category: 'event',
        sortAt: sooner,
        priorityRank: FEED_PRIORITY.DUE_SOON,
      }),
    ])
    expect(items[0].id).toBe('sooner')
  })

  it('mergeCommsIntoFeed applies priority sort', () => {
    const base = [
      mk({ id: 'goal-due', category: 'event', priorityRank: FEED_PRIORITY.DUE_TODAY, sortAt: Date.now() + 3600000 }),
    ]
    const comms = [
      mk({
        id: 'comms-1',
        unread: true,
        priorityRank: FEED_PRIORITY.COMMS_UNREAD,
        iconKind: 'message',
      }),
    ]
    const merged = mergeCommsIntoFeed(base, comms)
    expect(merged[0].id).toBe('comms-1')
  })

  it('compareEmployeePortalFeedItems is stable for equal items', () => {
    const a = mk({ id: 'a' })
    const b = mk({ id: 'b' })
    expect(compareEmployeePortalFeedItems(a, b)).toBeLessThan(0)
  })
})
