import { describe, expect, it } from 'vitest'
import { shouldWipeStorageKeyForTest } from './erase-space'

describe('eraseLocalWorkspace storage keys', () => {
  it('wipes workspace keys and keeps unrelated ones', () => {
    expect(shouldWipeStorageKeyForTest('katana-personal:plus')).toBe(true)
    expect(shouldWipeStorageKeyForTest('katana-personal-theme')).toBe(true)
    expect(shouldWipeStorageKeyForTest('sb-auth-token')).toBe(false)
  })
})
