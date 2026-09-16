import { localDb } from '@/lib/local-db'
import { createId } from '@/lib/id'
import { todayKey } from '@/lib/dates'
import type { Task, TaskList, TaskPriority, TaskStatus, Recurrence } from './types'

const TASKS = 'tasks'
const LISTS = 'task_lists'

function now() {
  return new Date().toISOString()
}

function normalizeTask(task: Task): Task {
  const raw = task.category || 'personal'
  const legacy =
    raw === 'General' || raw === 'general' ? 'personal' : raw
  const known = ['personal', 'work', 'health', 'errand', 'social', 'other'].includes(legacy)
  return {
    ...task,
    sort_order: typeof task.sort_order === 'number' ? task.sort_order : 0,
    goal_id: task.goal_id ?? null,
    habit_id: task.habit_id ?? null,
    notes: task.notes ?? '',
    category: known ? legacy : 'personal',
    completed_at: task.completed_at ?? null,
    source: task.source ?? 'local',
    external_id: task.external_id ?? null,
  }
}

export const tasksApi = {
  listTasks(userId: string): Task[] {
    return localDb
      .list<Task>(TASKS, userId)
      .map(normalizeTask)
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'done' ? 1 : b.status === 'done' ? -1 : 0
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
        const ad = a.due_at || '9999'
        const bd = b.due_at || '9999'
        return ad.localeCompare(bd)
      })
  },

  getTask(userId: string, id: string): Task | null {
    const task = localDb.getById<Task>(TASKS, userId, id)
    return task ? normalizeTask(task) : null
  },

  listLists(userId: string): TaskList[] {
    const lists = localDb.list<TaskList>(LISTS, userId)
    if (lists.length === 0) {
      const created = tasksApi.createList(userId, 'Personal', '#2A9D8F')
      return [created]
    }
    return lists.sort((a, b) => a.name.localeCompare(b.name))
  },

  createList(userId: string, name: string, color = '#2A9D8F'): TaskList {
    const ts = now()
    return localDb.insert(LISTS, userId, {
      id: createId(),
      user_id: userId,
      name: name.trim() || 'List',
      color,
      created_at: ts,
      updated_at: ts,
    })
  },

  updateList(userId: string, id: string, patch: Partial<Pick<TaskList, 'name' | 'color'>>): TaskList | null {
    return localDb.update<TaskList>(LISTS, userId, id, { ...patch, updated_at: now() })
  },

  deleteList(userId: string, id: string): boolean {
    const lists = tasksApi.listLists(userId)
    if (lists.length <= 1) return false
    const fallback = lists.find((l) => l.id !== id)
    if (!fallback) return false
    for (const task of tasksApi.listTasks(userId).filter((t) => t.list_id === id)) {
      tasksApi.updateTask(userId, task.id, { list_id: fallback.id })
    }
    return localDb.remove(LISTS, userId, id)
  },

  createTask(
    userId: string,
    input: {
      title: string
      notes?: string
      priority?: TaskPriority
      status?: TaskStatus
      due_at?: string | null
      recurrence?: Recurrence
      category?: string
      list_id?: string | null
      goal_id?: string | null
      habit_id?: string | null
      sort_order?: number
      source?: Task['source']
      external_id?: string | null
    },
  ): Task {
    const ts = now()
    const existing = tasksApi.listTasks(userId).filter((t) => t.status !== 'done')
    const maxOrder = existing.reduce((m, t) => Math.max(m, t.sort_order), 0)
    const lists = tasksApi.listLists(userId)
    const fallbackList = lists[0]?.id ?? null
    return normalizeTask(
      localDb.insert(TASKS, userId, {
        id: createId(),
        user_id: userId,
        list_id: input.list_id || fallbackList,
        title: input.title.trim(),
        notes: input.notes || '',
        priority: input.priority || 'medium',
        status: input.status || 'todo',
        due_at: input.due_at ?? null,
        completed_at: input.status === 'done' ? ts : null,
        recurrence: input.recurrence || 'none',
        category: input.category || 'personal',
        sort_order: input.sort_order ?? maxOrder + 1,
        goal_id: input.goal_id ?? null,
        habit_id: input.habit_id ?? null,
        source: input.source ?? 'local',
        external_id: input.external_id ?? null,
        created_at: ts,
        updated_at: ts,
      }),
    )
  },

  updateTask(userId: string, id: string, patch: Partial<Task>): Task | null {
    const current = tasksApi.getTask(userId, id)
    if (!current) return null
    const next = { ...patch, updated_at: now() } as Partial<Task>
    if (patch.status === 'done' && current.status !== 'done') {
      next.completed_at = patch.completed_at ?? now()
    }
    if (patch.status && patch.status !== 'done' && current.status === 'done') {
      next.completed_at = null
    }
    const updated = localDb.update<Task>(TASKS, userId, id, next)
    return updated ? normalizeTask(updated) : null
  },

  reorder(userId: string, orderedIds: string[]): void {
    orderedIds.forEach((id, index) => {
      tasksApi.updateTask(userId, id, { sort_order: index })
    })
  },

  /** Mark done; if recurring, spawn the next occurrence. */
  completeTask(userId: string, id: string): Task | null {
    const task = tasksApi.getTask(userId, id)
    if (!task) return null
    const updated = tasksApi.updateTask(userId, id, { status: 'done', completed_at: now() })
    if (task.recurrence !== 'none') {
      const base = task.due_at ? new Date(task.due_at) : new Date()
      const next = new Date(base)
      if (task.recurrence === 'daily') next.setDate(next.getDate() + 1)
      if (task.recurrence === 'weekly') next.setDate(next.getDate() + 7)
      if (task.recurrence === 'monthly') next.setMonth(next.getMonth() + 1)
      tasksApi.createTask(userId, {
        title: task.title,
        notes: task.notes,
        priority: task.priority,
        status: 'todo',
        due_at: next.toISOString(),
        recurrence: task.recurrence,
        category: task.category,
        list_id: task.list_id,
        goal_id: task.goal_id,
        habit_id: task.habit_id,
      })
    }
    return updated
  },

  deleteTask(userId: string, id: string): boolean {
    return localDb.remove(TASKS, userId, id)
  },

  priorityTasks(userId: string, limit = 5): Task[] {
    return tasksApi
      .listTasks(userId)
      .filter((t) => t.status !== 'done')
      .sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2 }
        return rank[a.priority] - rank[b.priority]
      })
      .slice(0, limit)
  },

  todayTasks(userId: string): Task[] {
    const today = todayKey()
    return tasksApi.listTasks(userId).filter((t) => t.status !== 'done' && t.due_at?.slice(0, 10) === today)
  },

  overdue(userId: string): Task[] {
    const today = todayKey()
    return tasksApi
      .listTasks(userId)
      .filter((t) => t.status !== 'done' && t.due_at && t.due_at.slice(0, 10) < today)
  },

  forGoal(userId: string, goalId: string): Task[] {
    return tasksApi.listTasks(userId).filter((t) => t.goal_id === goalId)
  },

  forHabit(userId: string, habitId: string): Task[] {
    return tasksApi.listTasks(userId).filter((t) => t.habit_id === habitId)
  },

  /** Tasks on a list, including unassigned rows that belong to the default list. */
  resolvedListId(userId: string, listId: string | null | undefined): string | null {
    const lists = tasksApi.listLists(userId)
    if (listId && lists.some((list) => list.id === listId)) return listId
    return lists[0]?.id ?? null
  },

  tasksOnList(userId: string, listId: string): Task[] {
    return tasksApi.listTasks(userId).filter((task) => tasksApi.resolvedListId(userId, task.list_id) === listId)
  },
}
