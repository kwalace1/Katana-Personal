import { todayKey } from '@/lib/dates'
import { createId } from '@/lib/id'
import { tasksApi } from '@/modules/tasks/api'
import type { AskAction } from './ask-api'

const KEY = 'katana-personal:ask-commitments'

export type AskCommitment = {
  id: string
  userId: string
  taskId: string
  title: string
  createdAt: string
  /** ISO timestamp of the last Ask check-in prompt for this commitment. */
  lastCheckInAt?: string
}

export type CommitmentSnapshot = {
  id: string
  taskId: string
  title: string
  createdAt: string
  lastCheckInAt?: string
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

function patchCommitment(userId: string, id: string, patch: Partial<AskCommitment>) {
  const all = readAll()
  const next = all.map((c) => (c.userId === userId && c.id === id ? { ...c, ...patch } : c))
  writeAll(next)
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

/** Compact shape for LifeSnapshot / LLM context. */
export function getActiveCommitmentSnapshot(userId: string): CommitmentSnapshot | null {
  const c = getActiveCommitment(userId)
  if (!c) return null
  return {
    id: c.id,
    taskId: c.taskId,
    title: c.title,
    createdAt: c.createdAt,
    lastCheckInAt: c.lastCheckInAt,
  }
}

export function clearCommitmentForTask(userId: string, taskId: string) {
  const others = readAll().filter((c) => !(c.userId === userId && c.taskId === taskId))
  writeAll(others)
}

export function clearCommitment(userId: string, id: string) {
  writeAll(readAll().filter((c) => !(c.userId === userId && c.id === id)))
}

function checkedInToday(commitment: AskCommitment, now = new Date()): boolean {
  if (!commitment.lastCheckInAt) return false
  try {
    return todayKey(new Date(commitment.lastCheckInAt)) === todayKey(now)
  } catch {
    return false
  }
}

/**
 * True when Ask should surface a check-in for the active commitment.
 * Once per local calendar day, and skipped if recent chat already covers it.
 */
export function needsCommitmentCheckIn(
  userId: string,
  messages: { role: string; actions?: AskAction[] }[] = [],
  now = new Date(),
): boolean {
  const active = getActiveCommitment(userId)
  if (!active) return false
  if (checkedInToday(active, now)) return false
  if (messagesCoverCommitment(messages, active)) return false
  return true
}

/** Recent Katana turns already talk about this commitment (create reply or prior check-in). */
export function messagesCoverCommitment(
  messages: { role: string; actions?: AskAction[] }[],
  commitment: AskCommitment,
  lookback = 12,
): boolean {
  const recent = messages.slice(-lookback)
  for (const m of recent) {
    if (m.role !== 'katana' && m.role !== 'assistant') continue
    const acts = m.actions || []
    if (acts.some((a) => a.kind === 'drop_commitment')) return true
    if (acts.some((a) => a.kind === 'complete_task' && a.taskId === commitment.taskId)) return true
  }
  return false
}

export function markCommitmentCheckedIn(userId: string, commitmentId: string, at = new Date()) {
  patchCommitment(userId, commitmentId, { lastCheckInAt: at.toISOString() })
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
