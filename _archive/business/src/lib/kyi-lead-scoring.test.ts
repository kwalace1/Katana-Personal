import { describe, expect, it } from 'vitest'
import {
  computeLeadScore,
  getLeadScoreBreakdown,
  leadMatchesSector,
  leadMatchesFilterPresets,
} from './kyi-lead-scoring'

describe('kyi-lead-scoring', () => {
  it('boosts capital signals when preferred types include VC', () => {
    const signals = { sec_form_d: true, sec_13f: true }
    const base = computeLeadScore(signals, { hasCoordinates: true })
    const boosted = computeLeadScore(signals, {
      hasCoordinates: true,
      raise: { preferredTypes: ['VC'] },
    })
    expect(boosted).toBeGreaterThan(base)
  })

  it('returns top signal contributors', () => {
    const breakdown = getLeadScoreBreakdown({ sec_13d: true, press_release: true })
    expect(breakdown[0]?.key).toBe('sec_13d')
  })

  it('matches sector when industry appears in tags', () => {
    expect(
      leadMatchesSector(
        { tags: ['fintech'], metadata: {} },
        { industry: 'fintech', sectorTags: [] },
      ),
    ).toBe(true)
  })

  it('applies filter presets', () => {
    expect(
      leadMatchesFilterPresets(
        { entity_type: 'firm', signals: { sec_form_d: true } },
        ['capital_signals'],
      ),
    ).toBe(true)
    expect(
      leadMatchesFilterPresets(
        { entity_type: 'person', signals: { sec_form_d: true } },
        ['firms_only'],
      ),
    ).toBe(false)
  })
})
