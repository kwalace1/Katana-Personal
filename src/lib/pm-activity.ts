/** Project management activity types and feed filtering helpers. */

import type { Activity, Project, Subtask, Task, TeamMember } from './project-data'

export const PM_ACTIVITY_TYPES = {
  TASK_CREATED: 'task_created',
  TASK_COMPLETED: 'task_completed',
  TASK_STATUS_CHANGED: 'task_status_changed',
  TASK_PRIORITY_CHANGED: 'task_priority_changed',
  SUBTASK_CREATED: 'subtask_created',
  SUBTASK_COMPLETED: 'subtask_completed',
  SUBTASK_UPDATED: 'subtask_updated',
  TEAM_MEMBER_ADDED: 'team_member_added',
} as const

export type PmActivityCategory = 'all' | 'tasks' | 'subtasks' | 'team'

export type PmTaskStatusFilter =
  | 'backlog'
  | 'todo'
  | 'in-progress'
  | 'review'
  | 'blocked'
  | 'done'

export type PmActivityFeedFilter = 'all' | PmActivityCategory | PmTaskStatusFilter

export const PM_ACTIVITY_CATEGORY_LABELS: Record<PmActivityCategory | 'all', string> = {
  all: 'All activity',
  tasks: 'Tasks',
  subtasks: 'Subtasks',
  team: 'Team',
}

export const PM_TASK_STATUS_LABELS: Record<PmTaskStatusFilter, string> = {
  backlog: 'Backlog tasks',
  todo: 'To do tasks',
  'in-progress': 'In progress tasks',
  review: 'Review tasks',
  blocked: 'Blocked tasks',
  done: 'Done tasks',
}

const TASK_ACTIVITY_TYPES = new Set<string>([
  PM_ACTIVITY_TYPES.TASK_CREATED,
  PM_ACTIVITY_TYPES.TASK_COMPLETED,
  PM_ACTIVITY_TYPES.TASK_STATUS_CHANGED,
  PM_ACTIVITY_TYPES.TASK_PRIORITY_CHANGED,
  'task_deleted',
])

const SUBTASK_ACTIVITY_TYPES = new Set<string>([
  PM_ACTIVITY_TYPES.SUBTASK_CREATED,
  PM_ACTIVITY_TYPES.SUBTASK_COMPLETED,
  PM_ACTIVITY_TYPES.SUBTASK_UPDATED,
])

const TEAM_ACTIVITY_TYPES = new Set<string>([PM_ACTIVITY_TYPES.TEAM_MEMBER_ADDED])

export function getPmActivityCategory(type: string): PmActivityCategory | 'other' {
  if (TASK_ACTIVITY_TYPES.has(type)) return 'tasks'
  if (SUBTASK_ACTIVITY_TYPES.has(type)) return 'subtasks'
  if (TEAM_ACTIVITY_TYPES.has(type)) return 'team'
  return 'other'
}

export function isPmTaskStatusFilter(filter: PmActivityFeedFilter): filter is PmTaskStatusFilter {
  return filter in PM_TASK_STATUS_LABELS
}

export function isPmActivityCategoryFilter(filter: PmActivityFeedFilter): filter is PmActivityCategory {
  return filter === 'tasks' || filter === 'subtasks' || filter === 'team'
}

export function activityMatchesFeedFilter(
  activityType: string,
  filter: PmActivityFeedFilter
): boolean {
  if (filter === 'all') return true
  if (isPmTaskStatusFilter(filter)) return false
  if (filter === 'tasks') return getPmActivityCategory(activityType) === 'tasks'
  if (filter === 'subtasks') return getPmActivityCategory(activityType) === 'subtasks'
  if (filter === 'team') return getPmActivityCategory(activityType) === 'team'
  return true
}

export type PmFeedItem =
  | { kind: 'activity'; id: string; sortAt: number; activity: Activity }
  | { kind: 'task'; id: string; sortAt: number; task: Task }
  | { kind: 'subtask'; id: string; sortAt: number; task: Task; subtask: Subtask }
  | { kind: 'team'; id: string; sortAt: number; member: TeamMember }

export function parseActivitySortTime(timestamp: string): number {
  const parsed = new Date(timestamp).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function parseDateSortTime(date: string | undefined): number {
  if (!date) return 0
  const parsed = new Date(date).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

/** Build the recent-activity feed for a project detail view. */
export function buildPmActivityFeed(
  project: Pick<Project, 'activities' | 'tasks' | 'team' | 'createdAt'>,
  filter: PmActivityFeedFilter
): PmFeedItem[] {
  const activityItems: PmFeedItem[] = project.activities
    .filter((a) => activityMatchesFeedFilter(a.type, filter))
    .map((a) => ({
      kind: 'activity' as const,
      id: a.id,
      sortAt: parseActivitySortTime(a.timestamp),
      activity: a,
    }))

  if (filter === 'all') {
    const taskItems: PmFeedItem[] = project.tasks.map((task) => ({
      kind: 'task' as const,
      id: task.id,
      sortAt: parseDateSortTime(task.deadline),
      task,
    }))
    return [...activityItems, ...taskItems].sort((a, b) => b.sortAt - a.sortAt)
  }

  if (isPmTaskStatusFilter(filter)) {
    return project.tasks
      .filter((task) => task.status === filter)
      .map((task) => ({
        kind: 'task' as const,
        id: task.id,
        sortAt: parseDateSortTime(task.deadline),
        task,
      }))
      .sort((a, b) => b.sortAt - a.sortAt)
  }

  if (filter === 'tasks') {
    const taskItems: PmFeedItem[] = project.tasks.map((task) => ({
      kind: 'task' as const,
      id: task.id,
      sortAt: parseDateSortTime(task.deadline),
      task,
    }))
    return [...activityItems, ...taskItems].sort((a, b) => b.sortAt - a.sortAt)
  }

  if (filter === 'subtasks') {
    const subtaskItems: PmFeedItem[] = project.tasks.flatMap((task) =>
      (task.subtasks ?? []).map((subtask) => ({
        kind: 'subtask' as const,
        id: `${task.id}-${subtask.id}`,
        sortAt: subtask.completedAt
          ? parseActivitySortTime(subtask.completedAt)
          : parseDateSortTime(task.deadline),
        task,
        subtask,
      }))
    )
    return [...activityItems, ...subtaskItems].sort((a, b) => b.sortAt - a.sortAt)
  }

  if (filter === 'team') {
    const fallbackSort = parseDateSortTime(project.createdAt) || Date.now()
    const teamItems: PmFeedItem[] = project.team.map((member) => ({
      kind: 'team' as const,
      id: member.id,
      sortAt: fallbackSort,
      member,
    }))
    return [...activityItems, ...teamItems].sort((a, b) => b.sortAt - a.sortAt)
  }

  return activityItems.sort((a, b) => b.sortAt - a.sortAt)
}
