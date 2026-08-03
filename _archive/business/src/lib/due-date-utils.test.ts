import { describe, it, expect } from 'vitest'
import {
  getTodayDateKey,
  isPastDueDate,
  formatDueDateLabel,
  isPmTaskOverdue,
  parseDateOnly,
  formatDateOnly,
  toDateKey,
} from './due-date-utils'

describe('due-date-utils', () => {
  const asOf = new Date('2026-05-18T15:00:00')

  it('detects past due dates by calendar day', () => {
    expect(isPastDueDate('2026-05-17', asOf)).toBe(true)
    expect(isPastDueDate('2026-05-18', asOf)).toBe(false)
    expect(isPastDueDate('2026-05-19', asOf)).toBe(false)
  })

  it('formats relative due labels', () => {
    expect(formatDueDateLabel('2026-05-17', asOf)).toBe('1 day overdue')
    expect(formatDueDateLabel('2026-05-18', asOf)).toBe('Due today')
    expect(formatDueDateLabel('2026-05-19', asOf)).toBe('Due tomorrow')
  })

  it('marks in-progress PM tasks as overdue when past deadline', () => {
    expect(
      isPmTaskOverdue(
        { deadline: '2026-05-17', status: 'in-progress' },
        asOf,
      ),
    ).toBe(true)
    expect(
      isPmTaskOverdue({ deadline: '2026-05-17', status: 'done' }, asOf),
    ).toBe(false)
  })

  it('getTodayDateKey uses local calendar', () => {
    expect(getTodayDateKey(asOf)).toBe('2026-05-18')
  })

  it('formatDateOnly keeps the stored calendar day (no UTC shift)', () => {
    const parsed = parseDateOnly('2026-06-15')
    expect(parsed?.getDate()).toBe(15)
    expect(parsed?.getMonth()).toBe(5)
    expect(formatDateOnly('2026-06-15', { month: 'numeric', day: 'numeric', year: 'numeric' }, 'en-US')).toBe(
      '6/15/2026'
    )
  })

  it('toDateKey uses local calendar from picker dates', () => {
    const picked = new Date(2026, 5, 15, 0, 0, 0)
    expect(toDateKey(picked)).toBe('2026-06-15')
  })
})
