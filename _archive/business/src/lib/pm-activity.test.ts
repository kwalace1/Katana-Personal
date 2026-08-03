import { describe, expect, it } from 'vitest'
import {
  activityMatchesFeedFilter,
  buildPmActivityFeed,
  getPmActivityCategory,
} from './pm-activity'
import type { Project } from './project-data'

const baseProject: Pick<Project, 'activities' | 'tasks' | 'team' | 'createdAt'> = {
  createdAt: '2025-06-01T12:00:00.000Z',
  activities: [
    {
      id: 'a1',
      type: 'task_created',
      description: 'Created task "Design mockup"',
      user: 'Alex',
      timestamp: '2025-06-08T10:00:00.000Z',
    },
    {
      id: 'a2',
      type: 'milestone_created',
      description: 'Created milestone "Launch"',
      user: 'Alex',
      timestamp: '2025-06-07T10:00:00.000Z',
    },
  ],
  tasks: [
    {
      id: 't1',
      title: 'Design mockup',
      status: 'in-progress',
      priority: 'high',
      assignee: { name: 'Alex', avatar: '' },
      deadline: '2025-06-15',
      progress: 50,
      subtasks: [
        {
          id: 's1',
          title: 'Wireframes',
          completed: true,
          completedBy: 'Jordan Lee',
          completedAt: '2025-06-08T11:00:00.000Z',
        },
        { id: 's2', title: 'Color palette', completed: false },
      ],
    },
  ],
  team: [{ id: 'm1', name: 'Jordan Lee', role: 'Designer', avatar: '', capacity: 80 }],
}

describe('getPmActivityCategory', () => {
  it('maps PM activity types to categories', () => {
    expect(getPmActivityCategory('task_created')).toBe('tasks')
    expect(getPmActivityCategory('subtask_completed')).toBe('subtasks')
    expect(getPmActivityCategory('team_member_added')).toBe('team')
    expect(getPmActivityCategory('milestone_created')).toBe('other')
  })
})

describe('activityMatchesFeedFilter', () => {
  it('filters task activity types', () => {
    expect(activityMatchesFeedFilter('task_created', 'tasks')).toBe(true)
    expect(activityMatchesFeedFilter('milestone_created', 'tasks')).toBe(false)
  })
})

describe('buildPmActivityFeed', () => {
  it('includes tasks and task activity when filtering by tasks', () => {
    const feed = buildPmActivityFeed(baseProject, 'tasks')
    expect(feed.some((item) => item.kind === 'task')).toBe(true)
    expect(feed.some((item) => item.kind === 'activity' && item.activity.type === 'task_created')).toBe(true)
    expect(feed.some((item) => item.kind === 'activity' && item.activity.type === 'milestone_created')).toBe(false)
  })

  it('includes subtasks when filtering by subtasks', () => {
    const feed = buildPmActivityFeed(baseProject, 'subtasks')
    expect(feed.filter((item) => item.kind === 'subtask')).toHaveLength(2)
  })

  it('includes team members when filtering by team', () => {
    const feed = buildPmActivityFeed(baseProject, 'team')
    expect(feed.filter((item) => item.kind === 'team')).toHaveLength(1)
  })

  it('includes tasks and all activities for the all filter', () => {
    const feed = buildPmActivityFeed(baseProject, 'all')
    expect(feed.some((item) => item.kind === 'task')).toBe(true)
    expect(feed.filter((item) => item.kind === 'activity')).toHaveLength(2)
  })
})
