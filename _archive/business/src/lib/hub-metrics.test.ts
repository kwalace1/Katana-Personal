import { describe, it, expect } from 'vitest'
import { buildHubMetricsBundle } from './hub-metrics'
import type { HubDashboardMetricInput } from './hub-metrics'

function emptyInput(overrides: Partial<HubDashboardMetricInput> = {}): HubDashboardMetricInput {
  return {
    projects: [],
    projectMetrics: {
      completionRate: 0,
      overdueTasks: 0,
      totalTasks: 0,
      completedTasks: 0,
    },
    csClients: [],
    csMetrics: {
      avgHealthScore: 0,
      atRiskClients: 0,
      upcomingRenewals: 0,
      avgNPS: 0,
    },
    hrMetrics: {
      activeEmployees: 0,
      reviewsDue: 0,
      openPositions: 0,
      newApplications: 0,
      avgPerformance: 0,
    },
    goals: [],
    jobApplications: [],
    purchaseOrders: [],
    supportSubmissions: [],
    kyiCompanies: [],
    inventoryMetrics: {
      totalItems: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
      openPurchaseOrders: 0,
    },
    wfmMetrics: {
      activeJobs: 0,
      pendingTimesheets: 0,
      activeTechnicians: 0,
      unassignedJobs: 0,
      overdueJobs: 0,
    },
    financeSummary: null,
    ...overrides,
  }
}

describe('buildHubMetricsBundle', () => {
  it('returns only KPIs for allowed modules', () => {
    const bundle = buildHubMetricsBundle(
      emptyInput({
        projects: [{ id: '1', status: 'active', totalTasks: 5, completedTasks: 2, tasks: [] } as never],
        projectMetrics: {
          completionRate: 40,
          overdueTasks: 1,
          totalTasks: 5,
          completedTasks: 2,
        },
        csClients: [{ status: 'healthy' }],
        csMetrics: {
          avgHealthScore: 88,
          atRiskClients: 0,
          upcomingRenewals: 2,
          avgNPS: 45,
        },
      }),
      ['projects', 'customer-success']
    )

    expect(bundle.kpis.map((k) => k.title)).toEqual([
      'Active Projects',
      'Open Tasks',
      'Healthy clients',
      'Renewals (60d)',
    ])
    expect(bundle.performanceMetrics.every((m) => ['projects', 'customer-success'].includes(m.moduleId))).toBe(
      true
    )
  })

  it('excludes HR metrics when HR access is not granted', () => {
    const bundle = buildHubMetricsBundle(
      emptyInput({
        hrMetrics: {
          activeEmployees: 12,
          reviewsDue: 3,
          openPositions: 2,
          newApplications: 4,
          avgPerformance: 4.2,
        },
      }),
      ['projects']
    )

    expect(bundle.kpis.some((k) => k.title === 'Active employees')).toBe(false)
    expect(bundle.performanceMetrics.some((m) => m.label === 'Avg performance')).toBe(false)
  })

  it('includes inventory and support metrics when those modules are allowed', () => {
    const bundle = buildHubMetricsBundle(
      emptyInput({
        inventoryMetrics: {
          totalItems: 40,
          lowStockItems: 3,
          outOfStockItems: 1,
          openPurchaseOrders: 2,
        },
        supportSubmissions: [
          { status: 'open' } as never,
          { status: 'in_progress' } as never,
        ],
      }),
      ['inventory', 'support']
    )

    expect(bundle.kpis.map((k) => k.title)).toEqual(['Inventory SKUs', 'Open POs', 'Open support items'])
    expect(bundle.performanceMetrics.map((m) => m.label)).toEqual(['Low stock SKUs', 'Support queue'])
  })
})
