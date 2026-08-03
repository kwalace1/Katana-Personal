import { describe, expect, it } from 'vitest'
import {
  getWfmTerminology,
  inferWfmWorkProfileFromIndustry,
  isWfmWorkProfile,
} from './wfm-terminology'
import { resolveWfmWorkProfile } from './wfm-settings'

describe('wfm-terminology', () => {
  it('infers field service from trade industries', () => {
    expect(inferWfmWorkProfileFromIndustry('HVAC & Plumbing')).toBe('field_service')
  })

  it('infers professional services from agency industries', () => {
    expect(inferWfmWorkProfileFromIndustry('Marketing Agency')).toBe('professional_services')
  })

  it('defaults to general for unknown industries', () => {
    expect(inferWfmWorkProfileFromIndustry('Retail')).toBe('general')
  })

  it('adapts labels per profile', () => {
    const field = getWfmTerminology('field_service')
    const general = getWfmTerminology('general')
    expect(field.showMapRoutes).toBe(true)
    expect(general.showMapRoutes).toBe(false)
    expect(field.workItem).toBe('Job')
    expect(general.workItem).toBe('Work item')
  })
})

describe('wfm-settings', () => {
  it('prefers org setting over industry inference', () => {
    expect(
      resolveWfmWorkProfile({
        industry: 'HVAC',
        wfm_work_profile: 'general',
      }),
    ).toBe('general')
  })

  it('validates work profile values', () => {
    expect(isWfmWorkProfile('field_service')).toBe(true)
    expect(isWfmWorkProfile('invalid')).toBe(false)
  })
})
