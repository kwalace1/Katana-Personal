import { describe, expect, it } from 'vitest'
import {
  deriveEmployeePresence,
  formatRelativeLastActive,
  presenceLabel,
  PRESENCE_ONLINE_WINDOW_MINUTES,
} from './employee-directory-presence'

describe('deriveEmployeePresence', () => {
  const now = new Date('2026-05-22T12:00:00Z').getTime()

  it('returns never without a Katana account', () => {
    expect(deriveEmployeePresence(false, null, now)).toBe('never')
    expect(deriveEmployeePresence(false, '2026-05-22T11:00:00Z', now)).toBe('never')
  })

  it('returns never when account exists but never logged in', () => {
    expect(deriveEmployeePresence(true, null, now)).toBe('never')
  })

  it('returns online within the active window', () => {
    const recent = new Date(now - (PRESENCE_ONLINE_WINDOW_MINUTES - 1) * 60 * 1000).toISOString()
    expect(deriveEmployeePresence(true, recent, now)).toBe('online')
  })

  it('returns recent when logged in before the active window', () => {
    const older = new Date(now - (PRESENCE_ONLINE_WINDOW_MINUTES + 5) * 60 * 1000).toISOString()
    expect(deriveEmployeePresence(true, older, now)).toBe('recent')
  })
})

describe('presenceLabel', () => {
  it('describes each state', () => {
    expect(presenceLabel('online')).toBe('Active now')
    expect(presenceLabel('never')).toBe('Not signed in yet')
    expect(presenceLabel('recent', '2026-05-21T12:00:00Z')).toMatch(/Last active/)
  })
})

describe('formatRelativeLastActive', () => {
  const now = new Date('2026-05-22T12:00:00Z').getTime()

  it('formats minutes ago', () => {
    expect(formatRelativeLastActive('2026-05-22T11:50:00Z', now)).toBe('10 minutes ago')
  })
})
