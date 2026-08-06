import { describe, expect, it, beforeEach } from 'vitest'
import { answerQuestionWithActions, buildSnapshot, runAskAction } from './engine'
import { localDb } from '@/lib/local-db'
import { tasksApi } from '@/modules/tasks/api'
import { calendarApi } from '@/modules/calendar/api'
import { todayKey, addDays } from '@/lib/dates'
import { buildWeekStats } from '@/lib/week-review'

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

  it('routes week review with week aggregates', () => {
    const reply = answerQuestionWithActions(USER, 'Review my week', 'Alex')
    expect(reply.text.toLowerCase()).toMatch(/week|task|habit|workout|lift/)
    expect(reply.text.toLowerCase()).not.toMatch(/habits today/)
  })

  it('answers tell me about myself', () => {
    const reply = answerQuestionWithActions(USER, 'Tell me about myself', 'Alex')
    expect(reply.text.toLowerCase()).toMatch(/snapshot|alex|task|habit/)
    expect(reply.text.toLowerCase()).not.toMatch(/didn.t catch/)
  })

  it('answers what can you do including Together', () => {
    const reply = answerQuestionWithActions(USER, 'What can you do?', 'Alex')
    expect(reply.text.toLowerCase()).toMatch(/day guide|brief|habit|health|together|friend/)
    expect(reply.actions.some((a) => a.route === '/friends' || a.route === '/circles')).toBe(true)
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

  it('routes invite a friend to Together', () => {
    const reply = answerQuestionWithActions(USER, 'Invite a friend', 'Alex')
    expect(reply.actions.some((a) => a.route === '/friends')).toBe(true)
    expect(reply.text.toLowerCase()).toMatch(/friend|invite|together/)
  })

  it('routes what’s shared with me', () => {
    const reply = answerQuestionWithActions(USER, 'What’s shared with me?', 'Alex')
    expect(reply.actions.some((a) => a.route === '/shared')).toBe(true)
  })

  it('routes how are my Circles', () => {
    const reply = answerQuestionWithActions(USER, 'How are my Circles?', 'Alex')
    expect(reply.actions.some((a) => a.route === '/circles')).toBe(true)
  })

  it('never says it did not catch the ask', () => {
    const reply = answerQuestionWithActions(USER, 'asdfgh random nonsense', 'Alex')
    expect(reply.text.toLowerCase()).not.toMatch(/didn.t catch/)
    expect(reply.text.length).toBeGreaterThan(20)
  })

  it('builds a snapshot with week stats', () => {
    const snap = buildSnapshot(USER, 'Alex')
    expect(snap.name).toBe('Alex')
    expect(snap.openTasks).toEqual([])
    expect(snap.recentLifts).toBe(0)
    expect(snap.week.tasksCompleted).toBe(0)
    expect(snap.week.label).toBeTruthy()
  })

  it('runs park_tasks safely when empty', () => {
    expect(runAskAction(USER, { id: '1', label: 'Park', kind: 'park_tasks' })).toMatch(/Nothing to park/)
  })

  it('runs create_event and close_day side effects', () => {
    const start = new Date()
    start.setHours(15, 0, 0, 0)
    const end = new Date(start)
    end.setHours(16, 0, 0, 0)
    expect(
      runAskAction(USER, {
        id: 'e1',
        label: 'Schedule',
        kind: 'create_event',
        title: 'Dentist',
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      }),
    ).toMatch(/Scheduled/)
    expect(calendarApi.list(USER).some((e) => e.title === 'Dentist')).toBe(true)

    const lists = tasksApi.listLists(USER)
    const task = tasksApi.createTask(USER, {
      title: 'Park me',
      list_id: lists[0]?.id ?? null,
      due_at: new Date().toISOString(),
    })
    expect(task.status).not.toBe('done')
    const msg = runAskAction(USER, {
      id: 'c1',
      label: 'Close',
      kind: 'close_day',
      body: 'Good day',
    })
    expect(msg.toLowerCase()).toMatch(/day closed|parked/)
    expect(localStorage.getItem('katana-personal:day-close')).toBe(todayKey())
  })

  it('counts completed tasks in week stats', () => {
    const lists = tasksApi.listLists(USER)
    const t = tasksApi.createTask(USER, {
      title: 'Done this week',
      list_id: lists[0]?.id ?? null,
    })
    tasksApi.completeTask(USER, t.id)
    const week = buildWeekStats(USER)
    expect(week.tasksCompleted).toBeGreaterThanOrEqual(1)
  })

  it('answers health with open route', () => {
    const reply = answerQuestionWithActions(USER, 'How is my water?', 'Alex')
    expect(reply.actions.some((a) => a.kind === 'log_water' || a.route === '/health')).toBe(true)
  })
})
