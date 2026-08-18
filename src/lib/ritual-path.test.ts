import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { isFirstMinuteActive } from './ritual-path'

describe('isFirstMinuteActive', () => {
  beforeEach(() => {
    localStorage.removeItem('katana-personal:ritual-step')
  })
  afterEach(() => {
    localStorage.removeItem('katana-personal:ritual-step')
  })

  it('is false when First Minute is not running', () => {
    expect(isFirstMinuteActive()).toBe(false)
  })

  it('is true during First Minute', () => {
    localStorage.setItem('katana-personal:ritual-step', 'capture')
    expect(isFirstMinuteActive()).toBe(true)
  })
})
