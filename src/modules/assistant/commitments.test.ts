import { beforeEach, describe, expect, it } from 'vitest'
import { localDb } from '@/lib/local-db'
import { tasksApi } from '@/modules/tasks/api'
import {
  clearCommitmentForTask,
  getActiveCommitment,
  listCommitmentOutcomes,
  makeCommitment,
  markCommitmentCheckedIn,
  migrateLegacyCommitments,
  needsCommitmentCheckIn,
  pruneCommitments,
  snoozeCommitment,
} from './commitments'

const USER = 'test-commit-user'
const LEGACY_KEY = 'katana-personal:ask-commitments'

describe('Ask commitments', () => {
  beforeEach(() => {
    localStorage.clear()
    localDb.clearAll(USER)
  })

  it('creates a high-priority today task and stores the commitment in IndexedDB', () => {
    const { taskId, title } = makeCommitment(USER, 'Ship the coach plan')
    expect(title).toBe('Ship the coach plan')
    const task = tasksApi.getTask(USER, taskId)
    expect(task?.priority).toBe('high')
    expect(task?.status).toBe('todo')
    expect(getActiveCommitment(USER)?.taskId).toBe(taskId)
    expect(localDb.list('ask_commitments', USER).some((c: { taskId: string }) => c.taskId === taskId)).toBe(
      true,
    )
  })

  it('migrates legacy localStorage commitments without data loss', () => {
    const task = tasksApi.createTask(USER, { title: 'Legacy task', priority: 'high' })
    const legacyId = 'legacy-commit-1'
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify([
        {
          id: legacyId,
          userId: USER,
          taskId: task.id,
          title: 'Legacy task',
          createdAt: new Date().toISOString(),
          lastCheckInAt: undefined,
        },
      ]),
    )

    const result = migrateLegacyCommitments(USER)
    expect(result.migrated).toBe(1)
    expect(getActiveCommitment(USER)?.id).toBe(legacyId)
    expect(getActiveCommitment(USER)?.title).toBe('Legacy task')
    // Idempotent
    expect(migrateLegacyCommitments(USER).migrated).toBe(0)
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it('does not overwrite an existing IndexedDB row during migration', () => {
    const task = tasksApi.createTask(USER, { title: 'Keep IDB', priority: 'high' })
    const id = 'shared-id'
    localDb.insert('ask_commitments', USER, {
      id,
      userId: USER,
      taskId: task.id,
      title: 'From IDB',
      createdAt: new Date().toISOString(),
      status: 'active',
    })
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify([
        {
          id,
          userId: USER,
          taskId: task.id,
          title: 'From legacy',
          createdAt: new Date().toISOString(),
        },
      ]),
    )
    migrateLegacyCommitments(USER)
    expect(getActiveCommitment(USER)?.title).toBe('From IDB')
  })

  it('prunes when the task is completed and records an outcome', () => {
    const { taskId } = makeCommitment(USER, 'Do the thing')
    tasksApi.completeTask(USER, taskId)
    expect(pruneCommitments(USER)).toHaveLength(0)
    expect(getActiveCommitment(USER)).toBeNull()
    expect(listCommitmentOutcomes(USER).some((o) => o.outcome === 'completed')).toBe(true)
  })

  it('clears by task id with completed outcome', () => {
    const { taskId } = makeCommitment(USER, 'Another')
    clearCommitmentForTask(USER, taskId)
    expect(getActiveCommitment(USER)).toBeNull()
    expect(listCommitmentOutcomes(USER)[0]?.outcome).toBe('completed')
  })

  it('snoozes check-ins until the snooze window ends', () => {
    makeCommitment(USER, 'Write the brief')
    expect(needsCommitmentCheckIn(USER, [])).toBe(true)
    const snoozed = snoozeCommitment(USER, { hours: 3 })
    expect(snoozed?.status).toBe('snoozed')
    expect(getActiveCommitment(USER)).toBeNull()
    expect(needsCommitmentCheckIn(USER, [])).toBe(false)
    expect(listCommitmentOutcomes(USER).some((o) => o.outcome === 'snoozed')).toBe(true)

    // Past snooze → wakes as active
    const past = new Date(Date.now() + 4 * 3_600_000)
    expect(needsCommitmentCheckIn(USER, [], past)).toBe(true)
  })

  it('needs check-in until marked for today', () => {
    makeCommitment(USER, 'Write the brief')
    expect(needsCommitmentCheckIn(USER, [])).toBe(true)
    const active = getActiveCommitment(USER)!
    markCommitmentCheckedIn(USER, active.id)
    expect(needsCommitmentCheckIn(USER, [])).toBe(false)
  })

  it('defers check-in on heavy + tight workload for fresh commitments', () => {
    makeCommitment(USER, 'Packed day task')
    expect(
      needsCommitmentCheckIn(USER, [], new Date(), {
        workloadLevel: 'heavy',
        conflictKinds: ['calendar_tight'],
      }),
    ).toBe(false)
  })

  it('keeps a single active commitment when replacing', () => {
    makeCommitment(USER, 'First')
    makeCommitment(USER, 'Second')
    expect(getActiveCommitment(USER)?.title).toBe('Second')
    expect(listCommitmentOutcomes(USER).some((o) => o.outcome === 'replaced')).toBe(true)
  })

  it('selects the newest active commitment deterministically and retires extras', () => {
    const olderTask = tasksApi.createTask(USER, { title: 'Older', priority: 'high' })
    const newerTask = tasksApi.createTask(USER, { title: 'Newer', priority: 'high' })
    localDb.insert('ask_commitments', USER, {
      id: 'commit-older',
      userId: USER,
      taskId: olderTask.id,
      title: 'Older',
      createdAt: '2026-01-01T10:00:00.000Z',
      status: 'active',
      snoozeUntil: null,
      source: 'ask',
    })
    localDb.insert('ask_commitments', USER, {
      id: 'commit-newer',
      userId: USER,
      taskId: newerTask.id,
      title: 'Newer',
      createdAt: '2026-01-02T10:00:00.000Z',
      status: 'active',
      snoozeUntil: null,
      source: 'ask',
    })
    expect(getActiveCommitment(USER)?.id).toBe('commit-newer')
    expect(localDb.list('ask_commitments', USER)).toHaveLength(1)
    expect(listCommitmentOutcomes(USER).some((o) => o.note?.includes('Deterministic'))).toBe(true)
  })
})
