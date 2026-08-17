import { describe, expect, it } from 'vitest'
import { getAuthCallbackParams, isAuthCallbackLocation, mapCloudAuthError } from './auth-callback'

describe('auth callback URL', () => {
  it('detects PKCE code on the query string', () => {
    expect(isAuthCallbackLocation('?code=abc123', '')).toBe(true)
    expect(getAuthCallbackParams('?code=abc123', '').code).toBe('abc123')
  })

  it('detects token_hash confirmation links', () => {
    const p = getAuthCallbackParams('?token_hash=xyz&type=signup', '')
    expect(p.tokenHash).toBe('xyz')
    expect(p.type).toBe('signup')
    expect(isAuthCallbackLocation('?token_hash=xyz&type=signup', '')).toBe(true)
  })

  it('detects implicit hash tokens', () => {
    expect(isAuthCallbackLocation('', '#access_token=tok&type=signup')).toBe(true)
  })

  it('ignores the normal landing page', () => {
    expect(isAuthCallbackLocation('', '')).toBe(false)
    expect(isAuthCallbackLocation('?mode=signup', '#cloud')).toBe(false)
  })
})

describe('mapCloudAuthError', () => {
  it('explains unconfirmed email instead of a generic sign-in failure', () => {
    expect(mapCloudAuthError(new Error('Email not confirmed'))).toMatch(/confirm your email/i)
  })
})
