import { describe, it, expect } from 'vitest'
import { addWidgetToLayout, removeWidgetFromLayout } from '@/lib/module-widget-layout'
import {
  AUTOMATION_DASHBOARD_WIDGET_CATALOG,
  AUTOMATION_TAB_SURFACE_IDS,
  AUTOMATION_TAB_SURFACE_REGISTRY,
  DEFAULT_AUTOMATION_DASHBOARD_WIDGETS,
  getAutomationTabSurfaceConfig,
  isAutomationTabSurfaceId,
  normalizeAutomationDashboardWidgetLayout,
  resolveAutomationSurfaceId,
} from './automation-widget-layout'

describe('automation-widget-layout', () => {
  it('normalizes default dashboard widget order', () => {
    const layout = normalizeAutomationDashboardWidgetLayout(null)
    expect(layout.version).toBe(2)
    expect(layout.widgets.map((w) => w.i)).toEqual(
      DEFAULT_AUTOMATION_DASHBOARD_WIDGETS.map((w) => w.i)
    )
  })

  it('drops unknown widget ids from dashboard layout', () => {
    const layout = normalizeAutomationDashboardWidgetLayout({
      version: 2,
      widgets: [
        { i: 'kpi_strip', x: 0, y: 0, w: 12, h: 4 },
        { i: 'not_real', x: 0, y: 4, w: 6, h: 4 },
      ],
      extras: {},
    })
    expect(layout.widgets.every((w) => w.i !== 'not_real')).toBe(true)
    expect(layout.widgets.some((w) => w.i === 'kpi_strip')).toBe(true)
  })

  it('adds and removes a catalog widget from dashboard layout', () => {
    let layout = normalizeAutomationDashboardWidgetLayout(null)
    layout = removeWidgetFromLayout(layout, 'recent_activity') as typeof layout
    expect(layout.widgets.some((w) => w.i === 'recent_activity')).toBe(false)

    const entry = AUTOMATION_DASHBOARD_WIDGET_CATALOG.find((e) => e.id === 'recent_activity')!
    layout = addWidgetToLayout(layout, entry) as typeof layout
    expect(layout.widgets.some((w) => w.i === 'recent_activity')).toBe(true)
  })

  it('does not expose empty_* placeholder catalog entries', () => {
    for (const id of AUTOMATION_TAB_SURFACE_IDS) {
      const catalogIds = AUTOMATION_TAB_SURFACE_REGISTRY[id].catalog.map((e) => e.id)
      expect(catalogIds.every((widgetId) => !widgetId.startsWith('empty_'))).toBe(true)
    }
  })

  describe('AUTOMATION_TAB_SURFACE_REGISTRY', () => {
    it('has an entry for every AUTOMATION_TAB_SURFACE_IDS value', () => {
      for (const id of AUTOMATION_TAB_SURFACE_IDS) {
        expect(AUTOMATION_TAB_SURFACE_REGISTRY[id]).toBeDefined()
        expect(AUTOMATION_TAB_SURFACE_REGISTRY[id].id).toBe(id)
      }
    })

    it('normalize(null) returns defaults whose ids are all in the catalog', () => {
      for (const id of AUTOMATION_TAB_SURFACE_IDS) {
        const config = AUTOMATION_TAB_SURFACE_REGISTRY[id]
        const layout = config.normalize(null)
        expect(layout.widgets.length).toBeGreaterThan(0)
        const catalogIds = new Set(config.catalog.map((entry) => entry.id))
        for (const widget of layout.widgets) {
          expect(catalogIds.has(widget.i)).toBe(true)
        }
      }
    })

    it('toBase round-trips through normalize without losing widgets', () => {
      for (const id of AUTOMATION_TAB_SURFACE_IDS) {
        const config = AUTOMATION_TAB_SURFACE_REGISTRY[id]
        const layout = config.normalize(null)
        const base = config.toBase(layout)
        const renormalized = config.normalize(base)
        expect(renormalized.widgets.map((w) => w.i).sort()).toEqual(
          layout.widgets.map((w) => w.i).sort()
        )
      }
    })
  })

  describe('resolveAutomationSurfaceId / getAutomationTabSurfaceConfig', () => {
    it('maps customizable tabs to surfaces', () => {
      expect(resolveAutomationSurfaceId('dashboard')).toBe('dashboard')
      expect(resolveAutomationSurfaceId('documents')).toBe('documents')
      expect(resolveAutomationSurfaceId('automation')).toBe('automation')
      expect(getAutomationTabSurfaceConfig('automation')?.id).toBe('automation')
    })

    it('skips Ask Agent and falls back for unknown tabs', () => {
      expect(resolveAutomationSurfaceId('agent')).toBeNull()
      expect(getAutomationTabSurfaceConfig('agent')).toBeNull()
      expect(isAutomationTabSurfaceId('not-a-tab')).toBe(false)
      expect(resolveAutomationSurfaceId('not-a-tab')).toBe('documents')
      expect(getAutomationTabSurfaceConfig('not-a-tab')?.id).toBe('documents')
    })
  })
})
