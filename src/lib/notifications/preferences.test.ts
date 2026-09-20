import { describe, expect, it } from 'vitest'
import {
  canNotifyNow,
  DEFAULT_QUIET_HOURS,
  isQuietHour,
  parseQuietHours,
} from '@/lib/notifications/preferences'

describe('notification preferences', () => {
  it('parses quiet hours with defaults', () => {
    expect(parseQuietHours(null)).toEqual(DEFAULT_QUIET_HOURS)
    expect(parseQuietHours({ quiet_hours: { enabled: false, start: 23, end: 6 } })).toEqual({
      enabled: false,
      start: 23,
      end: 6,
    })
  })

  it('detects overnight quiet hours', () => {
    const quiet = { enabled: true, start: 22, end: 7 }
    expect(isQuietHour(new Date('2026-08-29T23:00:00'), quiet)).toBe(true)
    expect(isQuietHour(new Date('2026-08-29T10:00:00'), quiet)).toBe(false)
    expect(isQuietHour(new Date('2026-08-29T06:30:00'), quiet)).toBe(true)
  })

  it('respects day closed', () => {
    const prefs = { day_closed_on: '2026-08-29' }
    expect(canNotifyNow(prefs, new Date('2026-08-29T14:00:00'))).toBe(false)
    expect(canNotifyNow(prefs, new Date('2026-08-30T14:00:00'))).toBe(true)
  })

  it('defaults social push on unless explicitly disabled', async () => {
    const { socialPushEnabled } = await import('@/lib/notifications/preferences')
    expect(socialPushEnabled(null)).toBe(true)
    expect(socialPushEnabled({})).toBe(true)
    expect(socialPushEnabled({ social_push: false })).toBe(false)
    expect(socialPushEnabled({ social_push: true })).toBe(true)
  })
})
