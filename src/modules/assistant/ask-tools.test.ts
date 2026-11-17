import { beforeEach, describe, expect, it } from 'vitest'
import { localDb } from '@/lib/local-db'
import { ASK_TOOL_NAMES } from './ask-llm-types'
import { executeAskTool } from './ask-tools'
import { getActiveCommitment } from './commitments'
import { buildSnapshot } from './engine'
import { goalsApi } from '@/modules/goals/api'
import { habitsApi } from '@/modules/habits/api'
import { calendarApi } from '@/modules/calendar/api'
import { createId } from '@/lib/id'

const USER = 'test-ask-tools-user'

function tool(name: string, args: Record<string, unknown> = {}) {
  return {
    id: createId(),
    type: 'function' as const,
    function: { name, arguments: JSON.stringify(args) },
  }
}

describe('Ask tool parity', () => {
  beforeEach(() => {
    localStorage.clear()
    localDb.clearAll(USER)
  })

  it('exposes the Phase 0 tool set', () => {
    expect(ASK_TOOL_NAMES).toEqual(
      expect.arrayContaining([
        'create_task',
        'make_commitment',
        'drop_commitment',
        'complete_task',
        'toggle_habit',
        'create_habit',
        'create_goal',
        'create_event',
        'schedule_workout',
        'log_water',
        'upsert_journal',
        'park_tasks',
        'close_day',
      ]),
    )
  })

  it('create_goal / create_habit write through runAskAction', () => {
    const goal = executeAskTool(USER, tool('create_goal', { title: 'Run a 5K' }))
    expect(goal.ok).toBe(true)
    expect(goalsApi.active(USER).some((g) => g.title === 'Run a 5K')).toBe(true)

    const habit = executeAskTool(USER, tool('create_habit', { title: 'Stretch' }))
    expect(habit.ok).toBe(true)
    expect(habitsApi.list(USER).some((h) => h.title === 'Stretch')).toBe(true)
  })

  it('make_commitment and drop_commitment manage accountability without deleting the task', () => {
    const made = executeAskTool(USER, tool('make_commitment', { title: 'Finish the deck' }))
    expect(made.ok).toBe(true)
    const active = getActiveCommitment(USER)
    expect(active?.title.toLowerCase()).toContain('finish the deck')
    const taskId = active!.taskId

    const dropped = executeAskTool(USER, tool('drop_commitment'))
    expect(dropped.ok).toBe(true)
    expect(getActiveCommitment(USER)).toBeNull()
    expect(buildSnapshot(USER).openTasks.some((t) => t.id === taskId)).toBe(true)
  })

  it('schedule_workout creates a calendar event', () => {
    const before = calendarApi.list(USER).length
    const result = executeAskTool(USER, tool('schedule_workout', { preferTomorrow: true }))
    expect(result.ok).toBe(true)
    expect(calendarApi.list(USER).length).toBeGreaterThan(before)
  })
})
