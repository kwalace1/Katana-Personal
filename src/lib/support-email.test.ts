import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SUPPORT_INBOX,
  DEFAULT_SUPPORT_PUBLIC_KEY,
  DEFAULT_SUPPORT_SERVICE_ID,
  DEFAULT_SUPPORT_TEMPLATE_ID,
  getSupportInboxEmail,
  getSupportPublicKey,
  getSupportServiceId,
  getSupportTemplateId,
  isSupportEmailConfigured,
} from './support-email'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('support email configuration', () => {
  it('ships the Katana support service, template, and public key as defaults', () => {
    expect(DEFAULT_SUPPORT_SERVICE_ID).toBe('service_svo9pq8')
    expect(DEFAULT_SUPPORT_TEMPLATE_ID).toBe('template_u1xja4v')
    expect(DEFAULT_SUPPORT_PUBLIC_KEY).toBe('LIT8H9ccVvlJbCL7U')
    expect(DEFAULT_SUPPORT_INBOX).toBe('katanatechnologysystems@gmail.com')
  })

  it('is configured out of the box with no env vars set', () => {
    expect(isSupportEmailConfigured()).toBe(true)
    expect(getSupportPublicKey()).toBeTruthy()
    expect(getSupportServiceId()).toBeTruthy()
    expect(getSupportTemplateId()).toBeTruthy()
    expect(getSupportInboxEmail()).toBeTruthy()
  })

  it('lets env vars override the built-in defaults', () => {
    vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', 'pk_override')
    vi.stubEnv('VITE_EMAILJS_SUPPORT_SERVICE_ID', 'service_override')
    vi.stubEnv('VITE_EMAILJS_SUPPORT_TEMPLATE_ID', 'template_override')
    vi.stubEnv('VITE_SUPPORT_INBOX_EMAIL', 'ops@example.com')

    expect(getSupportPublicKey()).toBe('pk_override')
    expect(getSupportServiceId()).toBe('service_override')
    expect(getSupportTemplateId()).toBe('template_override')
    expect(getSupportInboxEmail()).toBe('ops@example.com')
  })
})
