import { tasksApi } from '@/modules/tasks/api'
import type { Task } from '@/modules/tasks/types'

export type TaskImportSource = 'google_tasks' | 'todoist'

export type ExternalImportedTask = {
  external_id: string
  title: string
  notes: string
  due_at: string | null
  status: 'todo' | 'done'
}

/** Merge provider tasks into local IndexedDB; returns count upserted. */
export function mergeExternalTasks(
  userId: string,
  source: TaskImportSource,
  tasks: ExternalImportedTask[],
): number {
  const existing = tasksApi.listTasks(userId).filter((t) => t.source === source)
  const byExternal = new Map(
    existing.filter((t) => t.external_id).map((t) => [t.external_id as string, t]),
  )
  const seen = new Set<string>()
  let count = 0

  for (const ext of tasks) {
    if (ext.status === 'done') continue
    seen.add(ext.external_id)
    const prev = byExternal.get(ext.external_id)
    if (prev) {
      tasksApi.updateTask(userId, prev.id, {
        title: ext.title,
        notes: ext.notes,
        due_at: ext.due_at,
        status: 'todo',
        source,
        external_id: ext.external_id,
      })
    } else {
      tasksApi.createTask(userId, {
        title: ext.title,
        notes: ext.notes,
        due_at: ext.due_at,
        status: 'todo',
        source,
        external_id: ext.external_id,
        category: source === 'todoist' ? 'personal' : 'work',
      })
    }
    count += 1
  }

  for (const task of existing) {
    if (!task.external_id || seen.has(task.external_id)) continue
    if (task.status === 'done') continue
    tasksApi.deleteTask(userId, task.id)
  }

  return count
}

export function removeImportedTasksBySource(userId: string, source: TaskImportSource) {
  for (const task of tasksApi.listTasks(userId)) {
    if (task.source === source) tasksApi.deleteTask(userId, task.id)
  }
}

export function importedTaskCount(userId: string, source: TaskImportSource): number {
  return tasksApi.listTasks(userId).filter((t) => t.source === source && t.status !== 'done').length
}

export function isImportedTask(task: Task): boolean {
  return task.source === 'google_tasks' || task.source === 'todoist'
}
