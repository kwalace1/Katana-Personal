import { describe, expect, it } from 'vitest'
import {
  APP_STORE_URL,
  isWebPublicPath,
  nativeInviteDeepLink,
  resolveIosDownloadUrl,
  resolveWebAppLocked,
} from './web-app-lock'

describe('resolveWebAppLocked', () => {
  it('never locks the native iOS / Android shell', () => {
    expect(
      resolveWebAppLocked({ isDev: false, isNative: true, lockWebApp: 'true' }),
    ).toBe(false)
    expect(
      resolveWebAppLocked({ isDev: true, isNative: true, lockWebApp: '1' }),
    ).toBe(false)
  })

  it('keeps localhost / Vite dev unlocked so Mac → Xcode work is unchanged', () => {
    expect(resolveWebAppLocked({ isDev: true, isNative: false })).toBe(false)
  })

  it('locks the production website in a browser', () => {
    expect(resolveWebAppLocked({ isDev: false, isNative: false })).toBe(true)
  })

  it('unlocks production web when VITE_ALLOW_WEB_APP is set (fast revert)', () => {
    expect(
      resolveWebAppLocked({ isDev: false, isNative: false, allowWebApp: 'true' }),
    ).toBe(false)
  })

  it('can preview the marketing lock in dev with VITE_LOCK_WEB_APP', () => {
    expect(
      resolveWebAppLocked({ isDev: true, isNative: false, lockWebApp: 'true' }),
    ).toBe(true)
  })
})

describe('isWebPublicPath', () => {
  it('allows marketing, legal, auth, and invite URLs', () => {
    expect(isWebPublicPath('/')).toBe(true)
    expect(isWebPublicPath('/privacy')).toBe(true)
    expect(isWebPublicPath('/terms')).toBe(true)
    expect(isWebPublicPath('/auth')).toBe(true)
    expect(isWebPublicPath('/auth/callback')).toBe(true)
    expect(isWebPublicPath('/invite/circle/abc')).toBe(true)
    expect(isWebPublicPath('/invite/friend/xyz')).toBe(true)
  })

  it('does not allow the product UI', () => {
    expect(isWebPublicPath('/dashboard')).toBe(false)
    expect(isWebPublicPath('/ask')).toBe(false)
    expect(isWebPublicPath('/settings')).toBe(false)
    expect(isWebPublicPath('/settings/legal/privacy')).toBe(false)
    expect(isWebPublicPath('/home')).toBe(false)
  })
})

describe('nativeInviteDeepLink', () => {
  it('builds custom-scheme URLs the iOS app already registers', () => {
    expect(nativeInviteDeepLink('circle', 'tok/en')).toBe(
      'katanapersonal://invite/circle/tok%2Fen',
    )
    expect(nativeInviteDeepLink('friend', 'ab12')).toBe(
      'katanapersonal://invite/friend/ab12',
    )
  })
})

describe('resolveIosDownloadUrl', () => {
  it('defaults to the live App Store listing', () => {
    expect(resolveIosDownloadUrl()).toBe(APP_STORE_URL)
    expect(resolveIosDownloadUrl('')).toBe(APP_STORE_URL)
    expect(resolveIosDownloadUrl('   ')).toBe(APP_STORE_URL)
  })

  it('lets VITE_IOS_DOWNLOAD_URL override the default', () => {
    expect(resolveIosDownloadUrl('https://example.com/app')).toBe('https://example.com/app')
  })
})
