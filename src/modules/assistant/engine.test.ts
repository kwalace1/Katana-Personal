import { describe, expect, it, beforeEach } from 'vitest'
import { answerQuestionWithActions, buildSnapshot, runAskAction } from './engine'
import { localDb } from '@/lib/local-db'

const USER = 'test-ask-user'

describe('Ask engine (no LLM)', () => {
  beforeEach(() => {
    localStorage.clear()
    localDb.clearAll(USER)
  })

  it('answers focus with empty state', () => {
    const reply = answerQuestionWithActions(USER, 'What should I work on today?', 'Alex')
    expect(reply.text.toLowerCase()).toMatch(/nothing urgent|rest|small thing/)
    expect(reply.actions.some((a) => a.kind === 'open_route')).toBe(true)
  })

  it('parses create task', () => {
    const reply = answerQuestionWithActions(USER, 'Add buy milk tomorrow', 'Alex')
    expect(reply.actions[0]?.kind).toBe('create_task')
    expect(reply.actions[0]?.title?.toLowerCase()).toContain('buy milk')
  })

  it('routes close day intent', () => {
    const reply = answerQuestionWithActions(USER, 'Close my day', 'Alex')
    expect(reply.actions.some((a) => a.kind === 'close_day' || a.kind === 'park_tasks')).toBe(true)
  })

  it('routes week review', () => {
    const reply = answerQuestionWithActions(USER, 'Review my week', 'Alex')
    expect(reply.text.toLowerCase()).toMatch(/week|open task/)
  })

  it('answers tell me about myself', () => {
    const reply = answerQuestionWithActions(USER, 'Tell me about myself', 'Alex')
    expect(reply.text.toLowerCase()).toMatch(/snapshot|alex|task|habit/)
    expect(reply.text.toLowerCase()).not.toMatch(/didn.t catch/)
  })

  it('answers what can you do', () => {
    const reply = answerQuestionWithActions(USER, 'What can you do?', 'Alex')
    expect(reply.text.toLowerCase()).toMatch(/day guide|brief|habit|health/)
    expect(reply.text.toLowerCase()).not.toMatch(/didn.t catch/)
  })

  it('answers hi with a greeting', () => {
    const reply = answerQuestionWithActions(USER, 'hi', 'Alex')
    expect(reply.text.toLowerCase()).toMatch(/hi|morning|evening|alex/)
    expect(reply.text.toLowerCase()).not.toMatch(/didn.t catch/)
  })

  it('answers anything needing attention', () => {
    const reply = answerQuestionWithActions(USER, 'anything needing attention', 'Alex')
    expect(reply.text.toLowerCase()).toMatch(/attention|nothing major|habit|task|water|journal/)
    expect(reply.text.toLowerCase()).not.toMatch(/didn.t catch/)
  })

  it('never says it did not catch the ask', () => {
    const reply = answerQuestionWithActions(USER, 'asdfgh random nonsense', 'Alex')
    expect(reply.text.toLowerCase()).not.toMatch(/didn.t catch/)
    expect(reply.text.length).toBeGreaterThan(20)
  })

  it('builds a snapshot', () => {
    const snap = buildSnapshot(USER, 'Alex')
    expect(snap.name).toBe('Alex')
    expect(snap.openTasks).toEqual([])
    expect(snap.recentLifts).toBe(0)
  })

  it('runs park_tasks safely when empty', () => {
    expect(runAskAction(USER, { id: '1', label: 'Park', kind: 'park_tasks' })).toMatch(/Nothing to park/)
  })
})
