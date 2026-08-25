import { describe, expect, it } from 'vitest'
import {
  normalizeReminderTimes,
  resolveHabitReminderTimes,
  type Habit,
} from './types'

function habit(patch: Partial<Habit>): Habit {
  return {
    id: 'h1',
    user_id: 'u1',
    title: 'Water',
    schedule: 'daily',
    custom_days: [],
    once_date: null,
    reminder_time: null,
    reminder_times: [],
    nudge_until_done: true,
    created_at: '',
    updated_at: '',
    ...patch,
  }
}

describe('habit reminder times', () => {
  it('normalizes and sorts clock times', () => {
    expect(normalizeReminderTimes(['9:00', '08:00', 'bad', '18:00', '08:00'])).toEqual([
      '08:00',
      '09:00',
      '18:00',
    ])
  })

  it('fills extra pings through the day until check-in', () => {
    expect(
      resolveHabitReminderTimes(
        habit({ reminder_time: '08:00', reminder_times: ['08:00'], nudge_until_done: true }),
      ),
    ).toEqual(['08:00', '11:00', '14:00', '17:00', '20:00'])
  })

  it('keeps only the times the user set when follow-ups are off', () => {
    expect(
      resolveHabitReminderTimes(
        habit({
          reminder_time: '08:00',
          reminder_times: ['08:00', '13:00', '18:00'],
          nudge_until_done: false,
        }),
      ),
    ).toEqual(['08:00', '13:00', '18:00'])
  })
})
