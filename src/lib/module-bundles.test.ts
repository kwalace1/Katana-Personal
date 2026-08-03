import { describe, it, expect } from 'vitest'
import { TIER_DEFAULT_MODULES, CORE_SUITE_MODULE_IDS } from './module-bundles'

describe('module-bundles', () => {
  it('core suite includes hub and customers', () => {
    expect(CORE_SUITE_MODULE_IDS).toContain('hub')
    expect(CORE_SUITE_MODULE_IDS).toContain('customer-success')
  })

  it('enterprise includes all product-visible modules', () => {
    expect(TIER_DEFAULT_MODULES.enterprise).not.toContain('manufacturing')
    expect(TIER_DEFAULT_MODULES.enterprise.length).toBeGreaterThanOrEqual(14)
  })

  it('starter is a subset of professional', () => {
    const starter = new Set(TIER_DEFAULT_MODULES.starter)
    for (const id of TIER_DEFAULT_MODULES.starter) {
      expect(starter.has(id)).toBe(true)
    }
    expect(TIER_DEFAULT_MODULES.professional.length).toBeGreaterThan(TIER_DEFAULT_MODULES.starter.length)
  })
})
