import { todayKey } from '@/lib/dates'
import { createId } from '@/lib/id'
import { tasksApi } from '@/modules/tasks/api'

const KEY = 'katana-personal:ask-commitments'

export type AskCommitment = {
  id: string
  userId: string
  taskId: string
  title: string
  createdAt: string
}

function readAll(): AskCommitment[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as AskCommitment[]) : []
  } catch {
    return []
  }
}

function writeAll(items: AskCommitment[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

export function listCommitments(userId: string): AskCommitment[] {
  return readAll().filter((c) => c.userId === userId)
}

/** Drop commitments whose tasks are gone or already done. */
export function pruneCommitments(userId: string): AskCommitment[] {
  const kept = listCommitments(userId).filter((c) => {
    const task = tasksApi.getTask(userId, c.taskId)
    return Boolean(task && task.status !== 'done')
  })
  const others = readAll().filter((c) => c.userId !== userId)
  writeAll([...others, ...kept])
  return kept
}

export function getActiveCommitment(userId: string): AskCommitment | null {
  return pruneCommitments(userId)[0] ?? null
}

export function clearCommitmentForTask(userId: string, taskId: string) {
  const others = readAll().filter((c) => !(c.userId === userId && c.taskId === taskId))
  writeAll(others)
}

export function clearCommitment(userId: string, id: string) {
  writeAll(readAll().filter((c) => !(c.userId === userId && c.id === id)))
}

/** Bind an existing open task as the active Ask commitment (one at a time). */
export function bindCommitmentToTask(
  userId: string,
  taskId: string,
  title: string,
): AskCommitment {
  const commitment: AskCommitment = {
    id: createId(),
    userId,
    taskId,
    title: title.trim(),
    createdAt: new Date().toISOString(),
  }
  const others = readAll().filter((c) => c.userId !== userId)
  writeAll([...others, commitment])
  return commitment
}

/** Create a high-priority today task and register it as an Ask commitment. */
export function makeCommitment(
  userId: string,
  title: string,
): { commitment: AskCommitment; taskId: string; title: string } {
  const clean = title.trim().replace(/[.?!]+$/, '')
  const lists = tasksApi.listLists(userId)
  const task = tasksApi.createTask(userId, {
    title: clean,
    list_id: lists[0]?.id ?? null,
    due_at: todayKey(),
    priority: 'high',
  })
  const commitment = bindCommitmentToTask(userId, task.id, task.title)
  return { commitment, taskId: task.id, title: task.title }
}
