import { beforeEach, describe, expect, it } from 'vitest'
import { localDb } from '@/lib/local-db'
import { tasksApi } from '@/modules/tasks/api'
import { habitsApi } from '@/modules/habits/api'
import { calendarApi } from '@/modules/calendar/api'
import { makeCommitment } from '@/modules/assistant/commitments'
import { buildCoachOpening } from '@/modules/assistant/engine'
import { addDays } from '@/lib/dates'
import {
  PERSONAL_CONTEXT_VERSION,
  buildPersonalContext,
  compactPersonalContext,
} from './index'

const USER = 'personal-context-user'

describe('buildPersonalContext', () => {
  beforeEach(() => {
    localStorage.clear()
    localDb.clearAll(USER)
  })

  it('builds a versioned read-only context with empty memory when none saved', () => {
    const ctx = buildPersonalContext(USER, { displayName: 'Alex' })
    expect(ctx.version).toBe(PERSONAL_CONTEXT_VERSION)
    expect(ctx.userId).toBe(USER)
    expect(ctx.identity.displayName).toBe('Alex')
    expect(ctx.life.name).toBe('Alex')
    expect(ctx.extensions).toEqual({ memory: null, patterns: null, history: null })
    expect(ctx.assessment.domainsTotal).toBeGreaterThan(0)
    expect(['light', 'moderate', 'heavy']).toContain(ctx.workload.level)
  })

  it('fills extensions.memory from personal_memory without inventing patterns', async () => {
    const { createMemory } = await import('@/modules/assistant/memory')
    createMemory(USER, { text: 'I prefer texting', kind: 'preference' })
    const ctx = buildPersonalContext(USER, { displayName: 'Alex' })
    expect(ctx.extensions.memory?.items).toHaveLength(1)
    expect(ctx.extensions.memory?.items[0]?.source).toBe('explicit')
    expect(ctx.extensions.patterns).toBeNull()
    expect(ctx.extensions.history).toBeNull()
  })

  it('includes overdue, habits, commitment, and focus consistently', () => {
    const overdueDue = addDays(new Date(), -2)
    overdueDue.setHours(12, 0, 0, 0)
    tasksApi.createTask(USER, { title: 'Overdue report', due_at: overdueDue.toISOString(), priority: 'high' })
    habitsApi.create(USER, { title: 'Walk', schedule: 'daily', reminder_time: '09:00' })
    makeCommitment(USER, 'Ship Phase 1')

    const ctx = buildPersonalContext(USER, { displayName: 'Alex' })
    expect(ctx.pick.overdue.some((t) => t.title.includes('Overdue'))).toBe(true)
    expect(ctx.pick.openHabits.some((h) => h.title === 'Walk')).toBe(true)
    expect(ctx.commitment?.title.toLowerCase()).toContain('ship phase 1')
    expect(ctx.life.activeCommitment?.taskId).toBe(ctx.commitment?.taskId)
    expect(ctx.focus).not.toBeNull()
    expect(ctx.conflicts.some((c) => c.kind === 'commitment_open')).toBe(true)
    expect(ctx.conflicts.some((c) => c.kind === 'overdue_load')).toBe(true)
  })

  it('marks heavy workload when the calendar is tight with many tasks', () => {
    const now = new Date()
    now.setHours(10, 0, 0, 0)
    for (let i = 0; i < 6; i++) {
      tasksApi.createTask(USER, {
        title: `Task ${i}`,
        due_at: now.toISOString(),
        priority: 'high',
      })
    }
    const soon = new Date(now)
    soon.setMinutes(soon.getMinutes() + 20)
    const end = new Date(soon)
    end.setMinutes(end.getMinutes() + 30)
    calendarApi.create(USER, {
      title: 'Standup',
      notes: '',
      starts_at: soon.toISOString(),
      ends_at: end.toISOString(),
      all_day: false,
      location: '',
      recurrence: 'none',
      reminder_minutes: 5,
    })

    const ctx = buildPersonalContext(USER, { displayName: 'Alex', now })
    expect(ctx.workload.freeMinutes).toBeLessThan(45)
    expect(ctx.workload.todayTaskCount).toBeGreaterThanOrEqual(6)
    expect(ctx.conflicts.some((c) => c.kind === 'calendar_tight')).toBe(true)
    expect(ctx.workload.level === 'moderate' || ctx.workload.level === 'heavy').toBe(true)
  })

  it('compacts for LLM with workload and gaps', () => {
    makeCommitment(USER, 'Finish docs')
    const ctx = buildPersonalContext(USER, { displayName: 'Alex' })
    const compact = compactPersonalContext(ctx)
    expect(compact.activeCommitment?.title.toLowerCase()).toContain('finish docs')
    expect(compact.workloadLevel).toBe(ctx.workload.level)
    expect(compact.freeMinutes).toBe(ctx.workload.freeMinutes)
    expect(compact.conflictLabels?.length).toBe(ctx.conflicts.length)
    expect(compact.richnessScore).toBe(ctx.assessment.richnessScore)
  })

  it('feeds coach opening without changing empty-state behavior', () => {
    const ctx = buildPersonalContext(USER, { displayName: 'Alex' })
    const opening = buildCoachOpening(USER, 'Alex', 'supportive', undefined, [], {
      snap: ctx.life,
      next: ctx.focus,
    })
    expect(opening.text.toLowerCase()).toMatch(/nothing urgent|commitment|capture|next move/)
    expect(opening.actions.length).toBeGreaterThanOrEqual(1)
  })

  it('aligns focus with coach opening next move when a priority task exists', () => {
    tasksApi.createTask(USER, { title: 'Ship the demo', priority: 'high' })
    const ctx = buildPersonalContext(USER, { displayName: 'Alex' })
    expect(ctx.focus?.title).toMatch(/Ship the demo/)
    const opening = buildCoachOpening(USER, 'Alex', 'supportive', undefined, [], {
      snap: ctx.life,
      next: ctx.focus,
    })
    expect(opening.text).toMatch(/Next move:/)
    expect(opening.text).toMatch(/Ship the demo/)
  })
})
