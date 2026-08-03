import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeClientMetrics, getClientStats, resolveTaskAssignee } from './customer-success-api'

// Re-test last-contact merge logic used when loading clients
function effectiveLastContactDate(
  stored: string | null | undefined,
  latestInteraction: string | undefined,
): string | null {
  if (!latestInteraction) return stored || null
  if (!stored) return latestInteraction
  const storedMs = new Date(stored).getTime()
  const interactionMs = new Date(latestInteraction).getTime()
  if (isNaN(storedMs)) return latestInteraction
  if (isNaN(interactionMs)) return stored
  return interactionMs > storedMs ? latestInteraction : stored
}

describe('effectiveLastContactDate', () => {
  it('prefers a newer logged interaction over a stale stored contact date', () => {
    expect(
      effectiveLastContactDate('2026-06-05T12:00:00.000Z', '2026-06-14T15:00:00.000Z'),
    ).toBe('2026-06-14T15:00:00.000Z')
  })

  it('keeps the stored date when it is already newer than interactions', () => {
    expect(
      effectiveLastContactDate('2026-06-14T15:00:00.000Z', '2026-06-05T12:00:00.000Z'),
    ).toBe('2026-06-14T15:00:00.000Z')
  })
})

const mockDb = vi.hoisted(() => ({
  clients: [] as Record<string, unknown>[],
  tasks: [] as Record<string, unknown>[],
}))

vi.mock('./auth-helpers', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue('user-1'),
  getOrganizationId: vi.fn().mockResolvedValue('org-1'),
}))

vi.mock('./supabase', () => {
  const resultFor = async (table: string) => {
    if (table === 'cs_clients') return { data: mockDb.clients, error: null }
    if (table === 'cs_tasks') return { data: mockDb.tasks, error: null }
    return { data: [], error: null }
  }

  const chain = (table: string, columns?: string) => {
    const api: Record<string, unknown> = {}
    api.order = vi.fn(async () => resultFor(table))
    api.limit = vi.fn(() => api)
    api.eq = vi.fn((_col: string, id: string) => {
      if (columns === 'csm_id') {
        return {
          maybeSingle: vi.fn(async () => {
            if (table === 'cs_clients') {
              const client = mockDb.clients.find((c) => c.id === id)
              return { data: client ? { csm_id: client.csm_id ?? null } : null, error: null }
            }
            return { data: null, error: null }
          }),
        }
      }
      return api
    })
    api.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
    api.single = vi.fn(async () => ({ data: null, error: null }))
    // Allow awaiting the builder directly (thenable) if needed
    api.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(resultFor(table)).then(resolve, reject)
    return api
  }

  return {
    supabase: {
      from: vi.fn((table: string) => ({
        select: vi.fn((columns?: string) => chain(table, columns)),
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    },
  }
})

const RECENT_CONTACT = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

describe('computeClientMetrics', () => {
  it('scores healthy when NPS is high, engagement strong, few tickets, and contact is recent', () => {
    const metrics = computeClientMetrics({
      nps_score: 10,
      engagement_score: 100,
      support_tickets: 0,
      last_contact_date: RECENT_CONTACT,
    })
    expect(metrics.health_score).toBeGreaterThanOrEqual(80)
    expect(metrics.status).toBe('healthy')
  })

  it('marks at-risk when inputs are weak and last contact is stale', () => {
    const metrics = computeClientMetrics({
      nps_score: 2,
      engagement_score: 10,
      support_tickets: 8,
      last_contact_date: '2025-01-01',
      feature_usage: 'low',
    })
    expect(metrics.status).toBe('at-risk')
  })
})

describe('resolveTaskAssignee', () => {
  beforeEach(() => {
    mockDb.clients = [
      { id: 'c1', csm_id: 'csm-1' },
      { id: 'c2', csm_id: null },
    ]
  })

  it('keeps an explicit assignee when provided', async () => {
    await expect(resolveTaskAssignee('c1', 'csm-override')).resolves.toBe('csm-override')
  })

  it('falls back to the account CSM when no assignee is provided', async () => {
    await expect(resolveTaskAssignee('c1', null)).resolves.toBe('csm-1')
    await expect(resolveTaskAssignee('c1')).resolves.toBe('csm-1')
  })

  it('returns null when the account has no CSM and no assignee is provided', async () => {
    await expect(resolveTaskAssignee('c2', null)).resolves.toBeNull()
  })
})

describe('getClientStats', () => {
  beforeEach(() => {
    mockDb.clients = [
      {
        id: 'c1',
        name: 'Healthy Co',
        industry: '',
        last_contact_date: RECENT_CONTACT,
        nps_score: 10,
        engagement_score: 100,
        support_tickets: 0,
        feature_usage: 'High',
        portal_logins: 10,
        arr: 100_000,
        renewal_date: '2027-06-01',
        csm_id: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        churn_trend: 'stable',
      },
      {
        id: 'c2',
        name: 'Struggling LLC',
        industry: '',
        last_contact_date: '2025-01-02',
        nps_score: 2,
        engagement_score: 10,
        support_tickets: 8,
        feature_usage: 'low',
        portal_logins: 0,
        arr: 20_000,
        renewal_date: '2027-06-01',
        csm_id: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        churn_trend: 'stable',
      },
    ]
    mockDb.tasks = [
      {
        id: 't1',
        client_id: 'c1',
        title: 'Done',
        status: 'completed',
        due_date: '2026-03-01',
        priority: 'low',
        assigned_to: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: 't2',
        client_id: 'c1',
        title: 'Also done',
        status: 'completed',
        due_date: '2026-03-15',
        priority: 'low',
        assigned_to: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: 't3',
        client_id: 'c2',
        title: 'Overdue active',
        status: 'active',
        due_date: '2026-01-01',
        priority: 'high',
        assigned_to: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ]
  })

  it('aggregates totals from mocked clients and tasks', async () => {
    const metricsHealthy = computeClientMetrics({
      nps_score: 10,
      engagement_score: 100,
      support_tickets: 0,
      last_contact_date: RECENT_CONTACT,
      feature_usage: 'High',
      portal_logins: 10,
    })
    const metricsRisk = computeClientMetrics({
      nps_score: 2,
      engagement_score: 10,
      support_tickets: 8,
      last_contact_date: '2025-01-02',
      feature_usage: 'low',
      portal_logins: 0,
    })

    const stats = await getClientStats()

    expect(stats.totalClients).toBe(2)
    expect(stats.totalARR).toBe(120_000)
    expect(stats.avgNPS).toBe(Math.round((10 + 2) / 2))
    expect(stats.completedTasks).toBe(2)
    expect(stats.totalTasks).toBe(3)
    expect(stats.overdueTasks).toBe(1)

    const avgHealth = Math.round((metricsHealthy.health_score + metricsRisk.health_score) / 2)
    expect(stats.avgHealthScore).toBe(avgHealth)
    expect(stats.atRiskCount).toBe(1)
    expect(stats.highChurnRiskCount).toBe(1)
  })
})
