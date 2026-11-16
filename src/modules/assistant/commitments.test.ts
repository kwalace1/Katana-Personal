import { beforeEach, describe, expect, it } from 'vitest'
import { localDb } from '@/lib/local-db'
import { tasksApi } from '@/modules/tasks/api'
import {
  clearCommitmentForTask,
  getActiveCommitment,
  makeCommitment,
  pruneCommitments,
} from './commitments'

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
})
