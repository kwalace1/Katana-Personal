import { beforeEach, describe, expect, it } from 'vitest'
import { localDb } from '@/lib/local-db'
import { tasksApi } from '@/modules/tasks/api'
import {
  clearCommitmentForTask,
  getActiveCommitment,
  makeCommitment,
  markCommitmentCheckedIn,
  messagesCoverCommitment,
  needsCommitmentCheckIn,
  pruneCommitments,
} from './commitments'
import type { AskAction } from './ask-api'

const USER = 'test-commit-user'

describe('Ask commitments', () => {
  beforeEach(() => {
    localStorage.clear()
    localDb.clearAll(USER)
  })

  it('creates a high-priority today task and stores the commitment', () => {
    const { taskId, title } = makeCommitment(USER, 'Ship the coach plan')
    expect(title).toBe('Ship the coach plan')
    const task = tasksApi.getTask(USER, taskId)
    expect(task?.priority).toBe('high')
    expect(task?.status).toBe('todo')
    expect(getActiveCommitment(USER)?.taskId).toBe(taskId)
  })

  it('prunes when the task is completed', () => {
    const { taskId } = makeCommitment(USER, 'Do the thing')
    tasksApi.completeTask(USER, taskId)
    expect(pruneCommitments(USER)).toHaveLength(0)
    expect(getActiveCommitment(USER)).toBeNull()
  })

  it('clears by task id', () => {
    const { taskId } = makeCommitment(USER, 'Another')
    clearCommitmentForTask(USER, taskId)
    expect(getActiveCommitment(USER)).toBeNull()
  })

  it('needs check-in until marked for today', () => {
    makeCommitment(USER, 'Write the brief')
    expect(needsCommitmentCheckIn(USER, [])).toBe(true)
    const active = getActiveCommitment(USER)!
    markCommitmentCheckedIn(USER, active.id)
    expect(needsCommitmentCheckIn(USER, [])).toBe(false)
  })

  it('skips check-in when recent messages already cover the commitment', () => {
    const { taskId } = makeCommitment(USER, 'Call Mom')
    const actions: AskAction[] = [
      { id: '1', label: 'Done', kind: 'complete_task', taskId },
      { id: '2', label: 'Drop', kind: 'drop_commitment' },
    ]
    expect(
      needsCommitmentCheckIn(USER, [{ role: 'katana', actions }]),
    ).toBe(false)
  })

  it('messagesCoverCommitment detects complete_task for the committed task', () => {
    const { taskId } = makeCommitment(USER, 'Ship it')
    const active = getActiveCommitment(USER)!
    expect(
      messagesCoverCommitment(
        [{ role: 'katana', actions: [{ id: '1', label: 'x', kind: 'complete_task', taskId }] }],
        active,
      ),
    ).toBe(true)
    expect(
      messagesCoverCommitment(
        [{ role: 'katana', actions: [{ id: '1', label: 'x', kind: 'complete_task', taskId: 'other' }] }],
        active,
      ),
    ).toBe(false)
  })
})
