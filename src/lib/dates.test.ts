import { describe, expect, it } from 'vitest'
import { formatShortWhen, hasClockTime } from './dates'

describe('formatShortWhen', () => {
  it('keeps a captured clock time on the label', () => {
    const due = new Date()
    due.setDate(due.getDate() + ((5 - due.getDay() + 7) % 7 || 7))
    due.setHours(15, 0, 0, 0)
    expect(hasClockTime(due)).toBe(true)
    expect(formatShortWhen(due)).toMatch(/3pm/)
  })

  it('hides the 5pm date-only sentinel', () => {
    const due = new Date()
    due.setHours(17, 0, 0, 0)
    expect(hasClockTime(due)).toBe(false)
    expect(formatShortWhen(due)).not.toMatch(/5pm|5:00/i)
  })
})
