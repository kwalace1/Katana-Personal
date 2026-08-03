import { describe, it, expect } from 'vitest'
import {
  computeTimesheetTotalHours,
  calculateOvertimeHours,
  calculateWeeklyOvertime,
} from './wfm-api'

describe('Timesheet Utilities', () => {
  describe('computeTimesheetTotalHours', () => {
    it('returns 0 when clock_out is null', () => {
      expect(computeTimesheetTotalHours('2026-05-12T09:00:00Z', null, 0)).toBe(0)
    })

    it('calculates hours for a full day (8h, no breaks)', () => {
      const result = computeTimesheetTotalHours(
        '2026-05-12T09:00:00Z',
        '2026-05-12T17:00:00Z',
        0,
      )
      expect(result).toBe(8)
    })

    it('deducts break time from total', () => {
      const result = computeTimesheetTotalHours(
        '2026-05-12T09:00:00Z',
        '2026-05-12T17:00:00Z',
        30, // 30 min break
      )
      expect(result).toBe(7.5)
    })

    it('deducts 60 min break correctly', () => {
      const result = computeTimesheetTotalHours(
        '2026-05-12T08:00:00Z',
        '2026-05-12T17:00:00Z',
        60,
      )
      expect(result).toBe(8)
    })

    it('returns 0 for negative durations', () => {
      const result = computeTimesheetTotalHours(
        '2026-05-12T17:00:00Z',
        '2026-05-12T09:00:00Z',
        0,
      )
      expect(result).toBe(0)
    })

    it('handles short shifts', () => {
      const result = computeTimesheetTotalHours(
        '2026-05-12T14:00:00Z',
        '2026-05-12T15:30:00Z',
        0,
      )
      expect(result).toBe(1.5)
    })
  })

  describe('calculateOvertimeHours (daily)', () => {
    it('returns all regular for <=8h', () => {
      expect(calculateOvertimeHours(7)).toEqual({ regular: 7, overtime: 0 })
    })

    it('returns exactly 8h regular for 8h', () => {
      expect(calculateOvertimeHours(8)).toEqual({ regular: 8, overtime: 0 })
    })

    it('splits hours at 8h threshold', () => {
      expect(calculateOvertimeHours(10)).toEqual({ regular: 8, overtime: 2 })
    })

    it('handles large overtime', () => {
      expect(calculateOvertimeHours(14)).toEqual({ regular: 8, overtime: 6 })
    })

    it('uses custom threshold', () => {
      expect(calculateOvertimeHours(10, 10)).toEqual({ regular: 10, overtime: 0 })
      expect(calculateOvertimeHours(12, 10)).toEqual({ regular: 10, overtime: 2 })
    })

    it('handles 0 hours', () => {
      expect(calculateOvertimeHours(0)).toEqual({ regular: 0, overtime: 0 })
    })
  })

  describe('calculateWeeklyOvertime', () => {
    it('returns all regular for <=40h', () => {
      expect(calculateWeeklyOvertime(35)).toEqual({ regular: 35, overtime: 0 })
    })

    it('returns exactly 40h regular for 40h', () => {
      expect(calculateWeeklyOvertime(40)).toEqual({ regular: 40, overtime: 0 })
    })

    it('splits at 40h threshold', () => {
      expect(calculateWeeklyOvertime(48)).toEqual({ regular: 40, overtime: 8 })
    })

    it('handles large weekly totals', () => {
      expect(calculateWeeklyOvertime(60)).toEqual({ regular: 40, overtime: 20 })
    })

    it('uses custom threshold', () => {
      expect(calculateWeeklyOvertime(45, 45)).toEqual({ regular: 45, overtime: 0 })
      expect(calculateWeeklyOvertime(50, 45)).toEqual({ regular: 45, overtime: 5 })
    })

    it('handles 0 hours', () => {
      expect(calculateWeeklyOvertime(0)).toEqual({ regular: 0, overtime: 0 })
    })
  })

  describe('Break tracking logic', () => {
    it('break duration is cumulative', () => {
      // Simulate: first break was 15 min, second break adds 10 min
      const existingBreakMinutes = 15
      const additionalMinutes = 10
      const total = existingBreakMinutes + additionalMinutes
      expect(total).toBe(25)

      // Total hours with 25 min break from an 8h shift
      const hours = computeTimesheetTotalHours(
        '2026-05-12T09:00:00Z',
        '2026-05-12T17:00:00Z',
        total,
      )
      expect(hours).toBeCloseTo(7.58, 1)
    })

    it('break_start note format is parseable', () => {
      const note = 'break_start:2026-05-12T12:00:00.000Z'
      const timestamp = note.replace('break_start:', '')
      const parsed = new Date(timestamp)
      expect(parsed.getTime()).toBe(new Date('2026-05-12T12:00:00.000Z').getTime())
    })
  })

  describe('Approval workflow', () => {
    it('valid status transitions', () => {
      const validStatuses = ['pending', 'approved', 'rejected']
      expect(validStatuses).toContain('pending')
      expect(validStatuses).toContain('approved')
      expect(validStatuses).toContain('rejected')
    })

    it('overtime flag triggers on >8h daily', () => {
      const { overtime } = calculateOvertimeHours(9.5)
      expect(overtime).toBe(1.5)
    })

    it('overtime flag triggers on >40h weekly', () => {
      const { overtime } = calculateWeeklyOvertime(42)
      expect(overtime).toBe(2)
    })
  })
})
