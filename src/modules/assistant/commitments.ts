import { addDays, todayKey } from '@/lib/dates'
import { createId } from '@/lib/id'
import { localDb } from '@/lib/local-db'
import { tasksApi } from '@/modules/tasks/api'
import type { AskAction } from './ask-api'

const LEGACY_KEY = 'katana-personal:ask-commitments'
const MIGRATED_PREFIX = 'katana-personal:ask-commitments-migrated:'
const COLLECTION = 'ask_commitments'
const OUTCOMES = 'ask_commitment_outcomes'

export type CommitmentStatus = 'active' | 'snoozed'

export type CommitmentOutcomeKind = 'completed' | 'dropped' | 'snoozed' | 'replaced'

export type AskCommitment = {
  id: string
  userId: string
  taskId: string
  title: string
  createdAt: string
  status: CommitmentStatus
  /** ISO timestamp of the last Ask check-in prompt for this commitment. */
  lastCheckInAt?: string
  /** When set and in the future, automatic check-ins are deferred. */
  snoozeUntil?: string | null
  /** Provenance for future multi-commitment / memory work. */
  source?: 'user' | 'ask' | 'today'
}

export type CommitmentOutcome = {
  id: string
  userId: string
  commitmentId: string
  taskId: string
  title: string
  outcome: CommitmentOutcomeKind
  at: string
  note?: string
}

export type CommitmentSnapshot = {
  id: string
  taskId: string
  title: string
  createdAt: string
  status: CommitmentStatus
  lastCheckInAt?: string
  snoozeUntil?: string | null
}

export type CommitmentCheckInOptions = {
  workloadLevel?: 'light' | 'moderate' | 'heavy'
  conflictKinds?: string[]
}

type LegacyCommitment = {
  id: string
  userId: string
  taskId: string
  title: string
  createdAt: string
  lastCheckInAt?: string
}

function migratedKey(userId: string) {
  return `${MIGRATED_PREFIX}${userId}`
}

function readLegacyAll(): LegacyCommitment[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as LegacyCommitment[]) : []
  } catch {
    return []
  }
}

function writeLegacyAll(items: LegacyCommitment[]) {
  if (items.length === 0) {
    localStorage.removeItem(LEGACY_KEY)
    return
  }
  localStorage.setItem(LEGACY_KEY, JSON.stringify(items))
}

/**
 * One-time, idempotent migration: localStorage → IndexedDB for this user.
 * Safe to call on every read. Does not overwrite existing IDB rows with the same id.
 */
export function migrateLegacyCommitments(userId: string): { migrated: number } {
  if (typeof localStorage === 'undefined') return { migrated: 0 }
  if (localStorage.getItem(migratedKey(userId)) === '1') return { migrated: 0 }

  const legacy = readLegacyAll()
  const mine = legacy.filter((c) => c.userId === userId)
  const existing = localDb.list<AskCommitment>(COLLECTION, userId)
  const byId = new Set(existing.map((c) => c.id))
  let migrated = 0

  for (const row of mine) {
    if (byId.has(row.id)) continue
    localDb.insert(COLLECTION, userId, {
      id: row.id,
      userId: row.userId,
      taskId: row.taskId,
      title: row.title,
      createdAt: row.createdAt,
      status: 'active' as const,
      lastCheckInAt: row.lastCheckInAt,
      snoozeUntil: null,
      source: 'ask' as const,
    })
    migrated += 1
  }

  // Only strip this user's rows after a successful pass.
  writeLegacyAll(legacy.filter((c) => c.userId !== userId))
  localStorage.setItem(migratedKey(userId), '1')
  return { migrated }
}

function ensureMigrated(userId: string) {
  migrateLegacyCommitments(userId)
}

function normalize(row: AskCommitment): AskCommitment {
  return {
    ...row,
    status: row.status === 'snoozed' ? 'snoozed' : 'active',
    snoozeUntil: row.snoozeUntil ?? null,
    source: row.source || 'ask',
  }
}

function listRaw(userId: string): AskCommitment[] {
  ensureMigrated(userId)
  return localDb.list<AskCommitment>(COLLECTION, userId).map(normalize)
}

function recordOutcome(
  userId: string,
  commitment: AskCommitment,
  outcome: CommitmentOutcomeKind,
  note?: string,
) {
  localDb.insert(OUTCOMES, userId, {
    id: createId(),
    userId,
    commitmentId: commitment.id,
    taskId: commitment.taskId,
    title: commitment.title,
    outcome,
    at: new Date().toISOString(),
    note,
  })
}

export function listCommitments(userId: string): AskCommitment[] {
  return listRaw(userId)
}

export function listCommitmentOutcomes(userId: string, limit = 50): CommitmentOutcome[] {
  ensureMigrated(userId)
  return localDb
    .list<CommitmentOutcome>(OUTCOMES, userId)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
}

function isSnoozed(commitment: AskCommitment, now = new Date()): boolean {
  if (!commitment.snoozeUntil) return false
  try {
    return new Date(commitment.snoozeUntil).getTime() > now.getTime()
  } catch {
    return false
  }
}

/** Wake snoozed commitments whose snooze window has elapsed. */
function wakeExpiredSnoozes(userId: string, now = new Date()) {
  for (const c of listRaw(userId)) {
    if (c.status === 'snoozed' && !isSnoozed(c, now)) {
      localDb.update<AskCommitment>(COLLECTION, userId, c.id, {
        status: 'active',
        snoozeUntil: null,
      })
    }
  }
}

/**
 * Drop commitments whose tasks are gone or already done.
 * Completing a task records a completed outcome.
 */
export function pruneCommitments(userId: string, now = new Date()): AskCommitment[] {
  ensureMigrated(userId)
  wakeExpiredSnoozes(userId, now)
  const rows = listRaw(userId)
  const kept: AskCommitment[] = []
  for (const c of rows) {
    const task = tasksApi.getTask(userId, c.taskId)
    if (task && task.status !== 'done') {
      kept.push(c)
      continue
    }
    if (task?.status === 'done') {
      recordOutcome(userId, c, 'completed', 'Task marked done')
    } else {
      recordOutcome(userId, c, 'dropped', 'Task missing')
    }
    localDb.remove(COLLECTION, userId, c.id)
  }
  return kept
}

/** The single active (non-snoozed) commitment, if any. */
export function getActiveCommitment(userId: string, now = new Date()): AskCommitment | null {
  const open = pruneCommitments(userId, now).filter((c) => c.status === 'active' && !isSnoozed(c, now))
  return open[0] ?? null
}

/** Compact shape for LifeSnapshot / LLM / PersonalContext. */
export function getActiveCommitmentSnapshot(userId: string): CommitmentSnapshot | null {
  const c = getActiveCommitment(userId)
  if (!c) return null
  return {
    id: c.id,
    taskId: c.taskId,
    title: c.title,
    createdAt: c.createdAt,
    status: c.status,
    lastCheckInAt: c.lastCheckInAt,
    snoozeUntil: c.snoozeUntil,
  }
}

export function clearCommitmentForTask(userId: string, taskId: string) {
  ensureMigrated(userId)
  for (const c of listRaw(userId).filter((row) => row.taskId === taskId)) {
    recordOutcome(userId, c, 'completed', 'Task completed')
    localDb.remove(COLLECTION, userId, c.id)
  }
}

export function clearCommitment(userId: string, id: string) {
  ensureMigrated(userId)
  const c = localDb.getById<AskCommitment>(COLLECTION, userId, id)
  if (c) {
    recordOutcome(userId, normalize(c), 'dropped')
    localDb.remove(COLLECTION, userId, id)
  }
}

function checkedInToday(commitment: AskCommitment, now = new Date()): boolean {
  if (!commitment.lastCheckInAt) return false
  try {
    return todayKey(new Date(commitment.lastCheckInAt)) === todayKey(now)
  } catch {
    return false
  }
}

function hoursSince(iso: string, now: Date): number {
  try {
    return (now.getTime() - new Date(iso).getTime()) / 3_600_000
  } catch {
    return 0
  }
}

/**
 * True when Ask should surface a check-in for the active commitment.
 * Considers snooze, once-per-day check-ins, recent chat coverage, and heavy workload.
 */
export function needsCommitmentCheckIn(
  userId: string,
  messages: { role: string; actions?: AskAction[] }[] = [],
  now = new Date(),
  options: CommitmentCheckInOptions = {},
): boolean {
  const active = getActiveCommitment(userId, now)
  if (!active) return false
  if (isSnoozed(active, now)) return false
  if (checkedInToday(active, now)) return false
  if (messagesCoverCommitment(messages, active)) return false

  const heavy = options.workloadLevel === 'heavy'
  const tight = options.conflictKinds?.includes('calendar_tight')
  const aged = hoursSince(active.createdAt, now) >= 20
  // Soft deferral: don't nag on a packed day unless the commitment has been sitting ~a day.
  if (heavy && tight && !aged) return false

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
    if (acts.some((a) => a.kind === 'snooze_commitment')) return true
    if (acts.some((a) => a.kind === 'complete_task' && a.taskId === commitment.taskId)) return true
  }
  return false
}

export function markCommitmentCheckedIn(userId: string, commitmentId: string, at = new Date()) {
  ensureMigrated(userId)
  localDb.update<AskCommitment>(COLLECTION, userId, commitmentId, {
    lastCheckInAt: at.toISOString(),
  })
}

function retireActiveCommitments(userId: string, exceptTaskId?: string) {
  for (const c of listRaw(userId)) {
    if (exceptTaskId && c.taskId === exceptTaskId) continue
    if (isSnoozed(c)) {
      recordOutcome(userId, c, 'replaced', 'Superseded by a new commitment')
    } else {
      recordOutcome(userId, c, 'replaced', 'Superseded by a new commitment')
    }
    localDb.remove(COLLECTION, userId, c.id)
  }
}

/** Bind an existing open task as the active Ask commitment (one at a time). */
export function bindCommitmentToTask(
  userId: string,
  taskId: string,
  title: string,
  source: AskCommitment['source'] = 'ask',
): AskCommitment {
  ensureMigrated(userId)
  retireActiveCommitments(userId, taskId)
  // If already committed to this task, refresh it.
  const existing = listRaw(userId).find((c) => c.taskId === taskId)
  if (existing) {
    const updated = localDb.update<AskCommitment>(COLLECTION, userId, existing.id, {
      title: title.trim(),
      status: 'active',
      snoozeUntil: null,
      source,
    })
    return normalize(updated || existing)
  }
  return normalize(
    localDb.insert(COLLECTION, userId, {
      id: createId(),
      userId,
      taskId,
      title: title.trim(),
      createdAt: new Date().toISOString(),
      status: 'active' as const,
      snoozeUntil: null,
      source,
    }),
  )
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
  const commitment = bindCommitmentToTask(userId, task.id, task.title, 'ask')
  return { commitment, taskId: task.id, title: task.title }
}

/**
 * Snooze the active commitment. Default: later today evening, or tomorrow morning if evening.
 * Records a snoozed outcome without deleting the commitment.
 */
export function snoozeCommitment(
  userId: string,
  opts: { hours?: number; until?: string | null } = {},
  now = new Date(),
): AskCommitment | null {
  const active = getActiveCommitment(userId)
  if (!active) return null

  let until: Date
  if (opts.until) {
    until = new Date(opts.until)
  } else if (opts.hours != null && opts.hours > 0) {
    until = new Date(now.getTime() + opts.hours * 3_600_000)
  } else {
    until = new Date(now)
    if (until.getHours() < 17) {
      until.setHours(18, 0, 0, 0)
    } else {
      until = addDays(until, 1)
      until.setHours(9, 0, 0, 0)
    }
  }

  recordOutcome(userId, active, 'snoozed', `Until ${until.toISOString()}`)
  const updated = localDb.update<AskCommitment>(COLLECTION, userId, active.id, {
    status: 'snoozed',
    snoozeUntil: until.toISOString(),
    lastCheckInAt: now.toISOString(),
  })
  return updated ? normalize(updated) : null
}
