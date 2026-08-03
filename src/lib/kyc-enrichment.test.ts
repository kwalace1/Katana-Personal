import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseEnrichmentToSignals,
  mergeSignalLayers,
  type EnrichmentPayload,
} from './kyc-enrichment'

describe('parseEnrichmentToSignals', () => {
  it('flags registry and news signals from enrichment payload', () => {
    const payload: EnrichmentPayload = {
      company_query: 'Acme Corp',
      registry: {
        company_name: 'Acme Corp',
        company_number: '123',
        jurisdiction: 'us',
        status: 'Active',
        incorporation_date: '2010-01-01',
        company_type: 'LLC',
        city: 'Austin',
        state: 'TX',
        url: 'https://example.com',
      },
      news: [
        {
          title: 'Acme Corp raises Series B funding round',
          url: 'https://news.example/a',
          date: '20260301',
          tone: 2,
          themes: [],
        },
        {
          title: 'Acme announces major expansion into Europe',
          url: 'https://news.example/b',
          date: '20260215',
          tone: 1,
          themes: [],
        },
      ],
      fetched_at: '2026-03-14T12:00:00.000Z',
      errors: [],
    }

    const signals = parseEnrichmentToSignals(payload)
    expect(signals.registry_match).toBe(true)
    expect(signals.registry_active).toBe(true)
    expect(signals.recent_news).toBe(true)
    expect(signals.funding_news).toBe(true)
    expect(signals.expansion_news).toBe(true)
  })

  it('flags contraction risk from negative headlines', () => {
    const signals = parseEnrichmentToSignals({
      company_query: 'Beta LLC',
      registry: null,
      news: [
        {
          title: 'Beta LLC announces layoffs amid restructuring',
          url: '',
          date: '',
          tone: -4,
          themes: [],
        },
      ],
      fetched_at: '2026-03-14T12:00:00.000Z',
      errors: [],
    })
    expect(signals.contraction_news).toBe(true)
  })
})

describe('mergeSignalLayers', () => {
  it('merges internal and external signal objects', () => {
    const merged = mergeSignalLayers(
      { nps_promoter: true, open_support_tickets: true },
      { funding_news: true },
    )
    expect(merged.nps_promoter).toBe(true)
    expect(merged.funding_news).toBe(true)
  })
})

describe('buildSuggestedActions external', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('includes contraction play from external signal', async () => {
    const { buildSuggestedActions } = await import('./kyc-client-scoring')
    const actions = buildSuggestedActions({ contraction_news: true })
    expect(actions.some((a) => a.id === 'contraction-risk')).toBe(true)
  })
})
