import { supabase } from './supabase'
import type { ClientTask } from './customer-success-api'
import type { Task } from './project-data'
import {
  enrichPmTask,
  isPastDueDate,
  isPmTaskOverdue,
  PM_OVERDUE_REVERT_FROM_STATUS,
  PM_OVERDUE_REVERT_TO_STATUS,
} from './due-date-utils'

/**
 * PM: past-due tasks still marked in-progress move to backlog (persisted).
 * Returns tasks with isOverdue / dueDateLabel enriched for UI.
 */
export async function reconcilePmTasksOverdue(
  tasks: Task[],
  projectId?: string
): Promise<Task[]> {
  const toRevert = tasks.filter(
    (t) => t.status === PM_OVERDUE_REVERT_FROM_STATUS && isPastDueDate(t.deadline),
  )

  if (toRevert.length > 0) {
    await Promise.all(
      toRevert.map((t) =>
        supabase.from('tasks').update({ status: PM_OVERDUE_REVERT_TO_STATUS }).eq('id', t.id),
      ),
    )

    if (projectId) {
      const { notifyPmTaskOverdue } = await import('@/lib/notification-modules')
      for (const t of toRevert) {
        void notifyPmTaskOverdue({
          projectId,
          taskId: t.id,
          taskTitle: t.title,
          assigneeEmployeeId: t.assigneeEmployeeId,
          assigneeName: t.assignee?.name,
          reason: 'status_reverted',
        })
      }
    }
  }

  const revertedIds = new Set(toRevert.map((t) => t.id))

  if (projectId) {
    const overdueTasks = tasks.filter(
      (t) => isPmTaskOverdue(t) && !revertedIds.has(t.id)
    )
    if (overdueTasks.length > 0) {
      const { notifyPmTaskOverdue } = await import('@/lib/notification-modules')
      for (const t of overdueTasks) {
        void notifyPmTaskOverdue({
          projectId,
          taskId: t.id,
          taskTitle: t.title,
          assigneeEmployeeId: t.assigneeEmployeeId,
          assigneeName: t.assignee?.name,
          reason: 'past_due',
        })
      }
    }
  }

  return tasks.map((t) => {
    const next =
      revertedIds.has(t.id) ? { ...t, status: PM_OVERDUE_REVERT_TO_STATUS } : t
    return enrichPmTask(next)
  })
}

/** CS: active tasks past due_date become status overdue */
export async function reconcileCsTasksOverdue<T extends ClientTask>(tasks: T[]): Promise<T[]> {
  const toUpdate = tasks.filter((t) => t.status === 'active' && isPastDueDate(t.due_date))
  if (toUpdate.length === 0) return tasks

  await Promise.all(
    toUpdate.map((t) => supabase.from('cs_tasks').update({ status: 'overdue' }).eq('id', t.id)),
  )

  const updatedIds = new Set(toUpdate.map((t) => t.id))
  const result = tasks.map((t) => (updatedIds.has(t.id) ? { ...t, status: 'overdue' as const } : t))

  if (toUpdate.length > 0) {
    const { notifyCsTaskOverdue } = await import('@/lib/notification-modules')
    for (const t of toUpdate) {
      void notifyCsTaskOverdue({ ...t, status: 'overdue' })
    }
  }

  return result
}

/** HR goals: On Track goals past due_date become Behind */
export async function reconcileHrGoalsOverdue<
  T extends { id: string; status: string; due_date: string; employee_id: string; goal: string },
>(goals: T[]): Promise<T[]> {
  const toUpdate = goals.filter((g) => g.status === 'On Track' && isPastDueDate(g.due_date))
  if (toUpdate.length === 0) return goals

  await Promise.all(
    toUpdate.map((g) => supabase.from('hr_goals').update({ status: 'Behind' }).eq('id', g.id)),
  )

  const updatedIds = new Set(toUpdate.map((g) => g.id))
  const result = goals.map((g) => (updatedIds.has(g.id) ? { ...g, status: 'Behind' as const } : g))

  if (toUpdate.length > 0) {
    const { notifyHrGoalBehind } = await import('@/lib/notification-modules')
    for (const g of toUpdate) {
      void notifyHrGoalBehind({ id: g.id, employee_id: g.employee_id, goal: g.goal })
    }
  }

  return result
}
