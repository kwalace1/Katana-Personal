import { describe, it, expect } from 'vitest'
import { resolveEmployeePhotoUrl } from './employee-portal-profile'

describe('resolveEmployeePhotoUrl', () => {
  it('prefers HR employee photo when set', () => {
    expect(
      resolveEmployeePhotoUrl(
        { photo_url: 'https://example.com/hr.jpg' },
        'https://example.com/user.jpg'
      )
    ).toBe('https://example.com/hr.jpg')
  })

  it('falls back to user profile avatar when HR photo is missing', () => {
    expect(
      resolveEmployeePhotoUrl({ photo_url: null }, 'https://example.com/user.jpg')
    ).toBe('https://example.com/user.jpg')
  })

  it('ignores placeholder HR photos', () => {
    expect(
      resolveEmployeePhotoUrl(
        { photo_url: '/placeholder.svg?height=100&width=100' },
        'https://example.com/user.jpg'
      )
    ).toBe('https://example.com/user.jpg')
  })

  it('returns null when no usable photo exists', () => {
    expect(resolveEmployeePhotoUrl({ photo_url: '' }, null)).toBeNull()
  })
})
