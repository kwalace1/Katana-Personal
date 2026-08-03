/**
 * Global in-memory cache of subtasks by task id.
 * Used so we always block "Done" when subtasks are incomplete and never lose subtasks on status change,
 * even if the DB doesn't persist/return them or the UI state is stale.
 */

import type { Subtask, Task } from './project-data'
import { getTaskDisplayProgress } from './project-data'

const CACHE_KEY = '__katana_subtasks_cache'

function getCache(): Map<string, Subtask[]> {
  if (typeof window === 'undefined') return new Map()
  const w = window as unknown as { [key: string]: Map<string, Subtask[]> }
  if (!w[CACHE_KEY]) w[CACHE_KEY] = new Map()
  return w[CACHE_KEY]
}

export function setSubtasksCache(taskId: string, subtasks: Subtask[]): void {
  getCache().set(taskId, subtasks)
}

export function getSubtasksCache(taskId: string): Subtask[] | undefined {
  return getCache().get(taskId)
}

export function getTaskWithCachedSubtasks<T extends { id: string; subtasks?: Subtask[] }>(
  taskId: string,
  task: T
): T & { subtasks: Subtask[] } {
  const cached = getSubtasksCache(taskId)
  const subtasks = cached ?? task.subtasks ?? []
  return { ...task, subtasks }
}

/** Display progress for a task, using cached subtasks so % shows even when server didn't return subtasks. */
export function getTaskDisplayProgressWithCache(taskId: string, task: Task): number | null {
  return getTaskDisplayProgress(getTaskWithCachedSubtasks(taskId, task) as Task)
}
