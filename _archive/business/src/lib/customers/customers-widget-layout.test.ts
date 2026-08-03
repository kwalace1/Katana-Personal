import { describe, it, expect } from 'vitest'
import { addWidgetToLayout, removeWidgetFromLayout } from '@/lib/module-widget-layout'
import {
  CUSTOMERS_CLIENT_DETAIL_WIDGET_CATALOG,
  CUSTOMERS_DASHBOARD_WIDGET_CATALOG,
  CUSTOMERS_TAB_SURFACE_IDS,
  CUSTOMERS_TAB_SURFACE_REGISTRY,
  DEFAULT_CUSTOMERS_CLIENT_DETAIL_WIDGETS,
  DEFAULT_CUSTOMERS_DASHBOARD_WIDGETS,
  getCustomersTabSurfaceConfig,
  isCustomersTabSurfaceId,
  normalizeCustomersClientDetailWidgetLayout,
  normalizeCustomersDashboardWidgetLayout,
} from './customers-widget-layout'

describe('customers-widget-layout', () => {
  it('normalizes default dashboard widget order', () => {
    const layout = normalizeCustomersDashboardWidgetLayout(null)
    expect(layout.version).toBe(2)
    expect(layout.widgets.map((w) => w.i)).toEqual(
      DEFAULT_CUSTOMERS_DASHBOARD_WIDGETS.map((w) => w.i)
    )
  })

  it('normalizes default client_detail widget ids', () => {
    const layout = normalizeCustomersClientDetailWidgetLayout(null)
    expect(layout.version).toBe(2)
    expect(layout.widgets.map((w) => w.i)).toEqual(
      DEFAULT_CUSTOMERS_CLIENT_DETAIL_WIDGETS.map((w) => w.i)
    )
  })

  it('drops unknown widget ids from dashboard layout', () => {
    const layout = normalizeCustomersDashboardWidgetLayout({
      version: 2,
      widgets: [
        { i: 'stats', x: 0, y: 0, w: 12, h: 3 },
        { i: 'not_real', x: 0, y: 3, w: 6, h: 4 },
      ],
      extras: {},
    })
    expect(layout.widgets.every((w) => w.i !== 'not_real')).toBe(true)
    expect(layout.widgets.some((w) => w.i === 'stats')).toBe(true)
  })

  it('drops unknown widget ids from client_detail layout', () => {
    const layout = normalizeCustomersClientDetailWidgetLayout({
      version: 2,
      widgets: [
        { i: 'account_overview', x: 0, y: 0, w: 8, h: 8 },
        { i: 'not_real', x: 0, y: 8, w: 6, h: 4 },
      ],
      extras: {},
    })
    expect(layout.widgets.every((w) => w.i !== 'not_real')).toBe(true)
    expect(layout.widgets.some((w) => w.i === 'account_overview')).toBe(true)
  })

  it('adds and removes a widget from the dashboard layout', () => {
    let layout = normalizeCustomersDashboardWidgetLayout(null)
    const metric = CUSTOMERS_DASHBOARD_WIDGET_CATALOG.find((e) => e.id === 'metric_total_customers')!
    expect(layout.widgets.some((w) => w.i === 'metric_total_customers')).toBe(false)

    layout = addWidgetToLayout(layout, metric) as typeof layout
    expect(layout.widgets.some((w) => w.i === 'metric_total_customers')).toBe(true)

    layout = removeWidgetFromLayout(layout, 'metric_total_customers') as typeof layout
    expect(layout.widgets.some((w) => w.i === 'metric_total_customers')).toBe(false)
  })

  it('adds and removes a widget from the client_detail layout', () => {
    let layout = normalizeCustomersClientDetailWidgetLayout(null)
    const entitlements = CUSTOMERS_CLIENT_DETAIL_WIDGET_CATALOG.find((e) => e.id === 'entitlements')!
    layout = removeWidgetFromLayout(layout, 'entitlements') as typeof layout
    expect(layout.widgets.some((w) => w.i === 'entitlements')).toBe(false)

    layout = addWidgetToLayout(layout, entitlements) as typeof layout
    expect(layout.widgets.some((w) => w.i === 'entitlements')).toBe(true)
  })

  describe('CUSTOMERS_TAB_SURFACE_REGISTRY', () => {
    it('has an entry for every CUSTOMERS_TAB_SURFACE_IDS value', () => {
      for (const id of CUSTOMERS_TAB_SURFACE_IDS) {
        expect(CUSTOMERS_TAB_SURFACE_REGISTRY[id]).toBeDefined()
        expect(CUSTOMERS_TAB_SURFACE_REGISTRY[id].id).toBe(id)
      }
    })

    it('gives every surface a non-empty catalog', () => {
      for (const id of CUSTOMERS_TAB_SURFACE_IDS) {
        const config = CUSTOMERS_TAB_SURFACE_REGISTRY[id]
        expect(config.catalog.length).toBeGreaterThan(0)
      }
    })

    it('normalize(null) returns a non-empty default widget layout for every surface', () => {
      for (const id of CUSTOMERS_TAB_SURFACE_IDS) {
        const config = CUSTOMERS_TAB_SURFACE_REGISTRY[id]
        const layout = config.normalize(null)
        expect(layout.widgets.length).toBeGreaterThan(0)
        // Every default widget id must exist in that surface's catalog.
        const catalogIds = new Set(config.catalog.map((entry) => entry.id))
        for (const widget of layout.widgets) {
          expect(catalogIds.has(widget.i)).toBe(true)
        }
      }
    })

    it('toBase round-trips through normalize without losing widgets', () => {
      for (const id of CUSTOMERS_TAB_SURFACE_IDS) {
        const config = CUSTOMERS_TAB_SURFACE_REGISTRY[id]
        const layout = config.normalize(null)
        const base = config.toBase(layout)
        const renormalized = config.normalize(base)
        expect(renormalized.widgets.map((w) => w.i).sort()).toEqual(
          layout.widgets.map((w) => w.i).sort()
        )
      }
    })
  })

  describe('isCustomersTabSurfaceId / getCustomersTabSurfaceConfig', () => {
    it('recognizes every known surface id', () => {
      for (const id of CUSTOMERS_TAB_SURFACE_IDS) {
        expect(isCustomersTabSurfaceId(id)).toBe(true)
      }
    })

    it('rejects unknown ids', () => {
      expect(isCustomersTabSurfaceId('not_a_real_tab')).toBe(false)
    })

    it('returns the matching surface config for known tabs', () => {
      const pipeline = getCustomersTabSurfaceConfig('pipeline')
      expect(pipeline.id).toBe('pipeline')
      expect(pipeline.catalog.length).toBeGreaterThan(0)

      const clients = getCustomersTabSurfaceConfig('clients')
      expect(clients.id).toBe('clients')

      const analytics = getCustomersTabSurfaceConfig('analytics')
      expect(analytics.id).toBe('analytics')
    })

    it('falls back to dashboard for unknown tabs', () => {
      const fallback = getCustomersTabSurfaceConfig('not_a_real_tab')
      expect(fallback.id).toBe('dashboard')
    })
  })
})
