import { describe, it, expect } from 'vitest'
import { addWidgetToLayout, removeWidgetFromLayout } from '@/lib/module-widget-layout'
import {
  DEFAULT_FINANCE_OVERVIEW_WIDGETS,
  FINANCE_OVERVIEW_WIDGET_CATALOG,
  FINANCE_TAB_SURFACE_IDS,
  FINANCE_TAB_SURFACE_REGISTRY,
  getFinanceTabSurfaceConfig,
  isFinanceTabSurfaceId,
  normalizeFinanceOverviewWidgetLayout,
} from './finance-widget-layout'

describe('finance-widget-layout', () => {
  it('normalizes default overview widget order', () => {
    const layout = normalizeFinanceOverviewWidgetLayout(null)
    expect(layout.version).toBe(2)
    expect(layout.widgets.map((w) => w.i)).toEqual(
      DEFAULT_FINANCE_OVERVIEW_WIDGETS.map((w) => w.i)
    )
  })

  it('drops unknown widget ids from overview layout', () => {
    const layout = normalizeFinanceOverviewWidgetLayout({
      version: 2,
      widgets: [
        { i: 'stats', x: 0, y: 0, w: 12, h: 4 },
        { i: 'not_real', x: 0, y: 4, w: 6, h: 4 },
      ],
      extras: {},
    })
    expect(layout.widgets.every((w) => w.i !== 'not_real')).toBe(true)
    expect(layout.widgets.some((w) => w.i === 'stats')).toBe(true)
  })

  it('adds and removes a widget from the overview layout', () => {
    let layout = normalizeFinanceOverviewWidgetLayout(null)
    const metric = FINANCE_OVERVIEW_WIDGET_CATALOG.find((e) => e.id === 'metric_inflow')!
    expect(layout.widgets.some((w) => w.i === 'metric_inflow')).toBe(false)

    layout = addWidgetToLayout(layout, metric) as typeof layout
    expect(layout.widgets.some((w) => w.i === 'metric_inflow')).toBe(true)

    layout = removeWidgetFromLayout(layout, 'metric_inflow') as typeof layout
    expect(layout.widgets.some((w) => w.i === 'metric_inflow')).toBe(false)
  })

  describe('FINANCE_TAB_SURFACE_REGISTRY', () => {
    it('has an entry for every FINANCE_TAB_SURFACE_IDS value', () => {
      for (const id of FINANCE_TAB_SURFACE_IDS) {
        expect(FINANCE_TAB_SURFACE_REGISTRY[id]).toBeDefined()
        expect(FINANCE_TAB_SURFACE_REGISTRY[id].id).toBe(id)
      }
    })

    it('gives every surface a non-empty catalog', () => {
      for (const id of FINANCE_TAB_SURFACE_IDS) {
        const config = FINANCE_TAB_SURFACE_REGISTRY[id]
        expect(config.catalog.length).toBeGreaterThan(0)
      }
    })

    it('normalize(null) returns a non-empty default widget layout for every surface', () => {
      for (const id of FINANCE_TAB_SURFACE_IDS) {
        const config = FINANCE_TAB_SURFACE_REGISTRY[id]
        const layout = config.normalize(null)
        expect(layout.widgets.length).toBeGreaterThan(0)
        const catalogIds = new Set(config.catalog.map((entry) => entry.id))
        for (const widget of layout.widgets) {
          expect(catalogIds.has(widget.i)).toBe(true)
        }
      }
    })

    it('toBase round-trips through normalize without losing widgets', () => {
      for (const id of FINANCE_TAB_SURFACE_IDS) {
        const config = FINANCE_TAB_SURFACE_REGISTRY[id]
        const layout = config.normalize(null)
        const base = config.toBase(layout)
        const renormalized = config.normalize(base)
        expect(renormalized.widgets.map((w) => w.i).sort()).toEqual(
          layout.widgets.map((w) => w.i).sort()
        )
      }
    })
  })

  describe('getFinanceTabSurfaceConfig / isFinanceTabSurfaceId', () => {
    it('recognizes every tab surface id', () => {
      for (const id of FINANCE_TAB_SURFACE_IDS) {
        expect(isFinanceTabSurfaceId(id)).toBe(true)
        expect(getFinanceTabSurfaceConfig(id).id).toBe(id)
      }
    })

    it('falls back to overview for unknown tabs', () => {
      expect(isFinanceTabSurfaceId('not-a-tab')).toBe(false)
      expect(getFinanceTabSurfaceConfig('not-a-tab').id).toBe('overview')
    })
  })
})
