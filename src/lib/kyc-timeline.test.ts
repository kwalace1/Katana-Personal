import { describe, it, expect } from 'vitest'
import { buildClientTimeline, filterTimelineEvents } from './kyc-timeline'

describe('buildClientTimeline', () => {
  it('merges and sorts events from multiple sources', () => {
    const events = buildClientTimeline({
      interactions: [
        {
          id: 'i1',
          client_id: 'c1',
          type: 'meeting',
          subject: 'QBR',
          description: 'Quarterly review',
          csm_id: null,
          interaction_date: '2026-05-10T10:00:00.000Z',
          created_at: '2026-05-10T10:00:00.000Z',
        },
      ],
      tasks: [
        {
          id: 't1',
          client_id: 'c1',
          title: 'Send adoption guide',
          status: 'active',
          due_date: '2026-05-12',
          priority: 'medium',
          assigned_to: null,
          created_at: '2026-05-01T10:00:00.000Z',
          updated_at: '2026-05-01T10:00:00.000Z',
        },
      ],
      milestones: [
        {
          id: 'm1',
          client_id: 'c1',
          title: 'Renewal planning',
          status: 'upcoming',
          target_date: '2026-06-01',
          created_at: '2026-04-01T10:00:00.000Z',
          updated_at: '2026-04-01T10:00:00.000Z',
        },
      ],
      contracts: [],
      deals: [],
      invoices: [],
      healthHistory: [],
      client: {
        id: 'c1',
        name: 'Acme Co',
        renewal_date: '2026-06-15',
        created_at: '2025-01-01T10:00:00.000Z',
        last_contact_date: '2026-05-08',
      },
    })

    expect(events.length).toBeGreaterThanOrEqual(5)
    expect(new Date(events[0]!.occurred_at).getTime()).toBeGreaterThanOrEqual(
      new Date(events[1]!.occurred_at).getTime(),
    )
    expect(events.some((e) => e.type === 'meeting')).toBe(true)
    expect(events.some((e) => e.type === 'renewal-date')).toBe(true)
  })

  it('assigns interaction filter groups for meetings and notes', () => {
    const events = buildClientTimeline({
      interactions: [
        {
          id: 'i1',
          client_id: 'c1',
          type: 'call',
          subject: 'Check-in call',
          description: '',
          csm_id: null,
          interaction_date: '2026-05-10T10:00:00.000Z',
          created_at: '2026-05-10T10:00:00.000Z',
        },
        {
          id: 'i2',
          client_id: 'c1',
          type: 'note',
          subject: 'Follow-up note',
          description: '',
          csm_id: null,
          interaction_date: '2026-05-09T10:00:00.000Z',
          created_at: '2026-05-09T10:00:00.000Z',
        },
      ],
      tasks: [],
      milestones: [],
      contracts: [],
      deals: [],
      invoices: [],
      healthHistory: [],
      client: {
        id: 'c1',
        name: 'Acme Co',
        renewal_date: '',
        created_at: '2025-01-01T10:00:00.000Z',
        last_contact_date: '',
      },
    })

    expect(filterTimelineEvents(events, 'meetings').some((e) => e.id === 'interaction-i1')).toBe(true)
    expect(filterTimelineEvents(events, 'notes').some((e) => e.id === 'interaction-i2')).toBe(true)
    expect(filterTimelineEvents(events, 'renewals')).toHaveLength(0)
  })
})

describe('filterTimelineEvents', () => {
  const sample = buildClientTimeline({
    interactions: [],
    tasks: [],
    milestones: [],
    contracts: [
      {
        id: 'ct1',
        title: 'Annual agreement',
        status: 'active',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        created_at: '2025-12-01T10:00:00.000Z',
        updated_at: '2025-12-01T10:00:00.000Z',
      },
    ],
    deals: [],
    invoices: [],
    healthHistory: [],
    client: {
      id: 'c1',
      name: 'Acme Co',
      renewal_date: '2026-12-31',
      created_at: '2025-01-01T10:00:00.000Z',
      last_contact_date: '',
    },
  })

  it('returns all events for all filter', () => {
    expect(filterTimelineEvents(sample, 'all')).toHaveLength(sample.length)
  })

  it('filters renewal-related commerce and contract events', () => {
    const renewals = filterTimelineEvents(sample, 'renewals')
    expect(renewals.some((e) => e.category === 'contract')).toBe(true)
    expect(renewals.some((e) => e.type === 'renewal-date')).toBe(true)
  })
})
