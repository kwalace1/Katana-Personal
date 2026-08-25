import { beforeEach, describe, expect, it } from 'vitest'
import { localDb } from '@/lib/local-db'
import { dueHabitReminderSlots } from '@/lib/reminders'
import { habitsApi } from '@/modules/habits/api'

const USER = 'test-habit-reminders'

describe('due habit reminder slots', () => {
  beforeEach(() => {
    localStorage.clear()
    localDb.clearAll(USER)
  })

  it('fires every slot that has already passed and is not checked in', () => {
    const created = habitsApi.create(USER, {
      title: 'Walk',
      reminder_times: ['08:00', '13:00', '18:00'],
      nudge_until_done: false,
    })
    const now = new Date()
    now.setHours(14, 5, 0, 0)
    const due = dueHabitReminderSlots(USER, now, new Set())
    expect(due.map((s) => s.time)).toEqual(['08:00', '13:00'])
    expect(due.every((s) => s.habit.id === created.id)).toBe(true)
  })

  it('skips slots that already fired and habits that are done', () => {
    const created = habitsApi.create(USER, {
      title: 'Walk',
      reminder_times: ['08:00', '13:00'],
      nudge_until_done: false,
    })
    habitsApi.toggleToday(USER, created.id)
    const now = new Date()
    now.setHours(16, 0, 0, 0)
    expect(dueHabitReminderSlots(USER, now, new Set())).toEqual([])
  })
})
