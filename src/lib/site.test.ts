import { describe, expect, it } from 'vitest'
import {
  APP_STORE_URL,
  APPLE_APP_ID,
  MARKETING_FAQS,
  SEO_DESCRIPTION,
  SEO_TITLE,
  SITE_URL,
} from './site'

describe('site SEO constants', () => {
  it('uses the live .app origin and App Store listing', () => {
    expect(SITE_URL).toBe('https://www.katanapersonal.app')
    expect(APPLE_APP_ID).toBe('6813697936')
    expect(APP_STORE_URL).toContain(APPLE_APP_ID)
    expect(APP_STORE_URL).toContain('apps.apple.com')
  })

  it('keeps title and description useful for search snippets', () => {
    expect(SEO_TITLE.toLowerCase()).toContain('katana')
    expect(SEO_DESCRIPTION.length).toBeGreaterThan(80)
    expect(SEO_DESCRIPTION.length).toBeLessThan(200)
    expect(SEO_DESCRIPTION.toLowerCase()).toMatch(/wellness|habit|daily/)
  })

  it('ships FAQ copy for FAQPage rich results', () => {
    expect(MARKETING_FAQS.length).toBeGreaterThanOrEqual(4)
    for (const item of MARKETING_FAQS) {
      expect(item.question.trim().length).toBeGreaterThan(10)
      expect(item.answer.trim().length).toBeGreaterThan(40)
    }
  })
})
