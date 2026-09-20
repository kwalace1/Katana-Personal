import { describe, expect, it } from 'vitest'
import { appPathFromDeepLink } from './deep-links'

describe('appPathFromDeepLink', () => {
  it('maps custom-scheme invite URLs into the app', () => {
    expect(appPathFromDeepLink('katanapersonal://invite/circle/abc')).toBe(
      '/invite/circle/abc',
    )
    expect(appPathFromDeepLink('katanapersonal://invite/friend/zz99')).toBe(
      '/invite/friend/zz99',
    )
  })

  it('maps https marketing-host invite URLs (universal-link style)', () => {
    expect(
      appPathFromDeepLink('https://katana-personal.vercel.app/invite/circle/tok'),
    ).toBe('/invite/circle/tok')
  })

  it('ignores OAuth return and unrelated URLs', () => {
    expect(appPathFromDeepLink('katanapersonal://oauth-return?katana_oauth=x')).toBeNull()
    expect(appPathFromDeepLink('https://katana-personal.vercel.app/privacy')).toBeNull()
  })
})
