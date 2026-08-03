import { describe, it, expect } from 'vitest'
import { mapApplicationStatusForPortal } from './recruitment-db'

describe('mapApplicationStatusForPortal', () => {
  it('maps pipeline statuses to portal labels', () => {
    expect(mapApplicationStatusForPortal('new')).toBe('under-review')
    expect(mapApplicationStatusForPortal('reviewing')).toBe('under-review')
    expect(mapApplicationStatusForPortal('interview-scheduled')).toBe('interview')
    expect(mapApplicationStatusForPortal('interviewed')).toBe('interview')
    expect(mapApplicationStatusForPortal('offer')).toBe('offer')
    expect(mapApplicationStatusForPortal('rejected')).toBe('rejected')
    expect(mapApplicationStatusForPortal('withdrawn')).toBe('rejected')
  })
})
