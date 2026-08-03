import { describe, it, expect } from 'vitest'
import { addWidgetToLayout, removeWidgetFromLayout } from '@/lib/module-widget-layout'
import {
  DEFAULT_WORKFORCE_TODAY_WIDGETS,
  WORKFORCE_TAB_SURFACE_IDS,
  WORKFORCE_TAB_SURFACE_REGISTRY,
  WORKFORCE_TODAY_WIDGET_CATALOG,
  getWorkforceTabSurfaceConfig,
  isWorkforceTabSurfaceId,
  normalizeWorkforceTodayWidgetLayout,
  resolveWorkforceSurfaceId,
} from './workforce-widget-layout'

describe('workforce-widget-layout', () => {
  it('normalizes default today widget order', () => {
    const layout = normalizeWorkforceTodayWidgetLayout(null)
    expect(layout.version).toBe(2)
    expect(layout.widgets.map((w) => w.i)).toEqual(
      DEFAULT_WORKFORCE_TODAY_WIDGETS.map((w) => w.i)
    )
  })

  it('drops unknown widget ids from today layout', () => {
    const layout = normalizeWorkforceTodayWidgetLayout({
      version: 2,
      widgets: [
        { i: 'hero', x: 0, y: 0, w: 12, h: 4 },
        { i: 'not_real', x: 0, y: 4, w: 6, h: 4 },
      ],
      extras: {},
    })
    expect(layout.widgets.every((w) => w.i !== 'not_real')).toBe(true)
    expect(layout.widgets.some((w) => w.i === 'hero')).toBe(true)
  })

  it('adds and removes a catalog widget from today layout', () => {
    let layout = normalizeWorkforceTodayWidgetLayout(null)
    layout = removeWidgetFromLayout(layout, 'recent_activity') as typeof layout
    expect(layout.widgets.some((w) => w.i === 'recent_activity')).toBe(false)

    const entry = WORKFORCE_TODAY_WIDGET_CATALOG.find((e) => e.id === 'recent_activity')!
    layout = addWidgetToLayout(layout, entry) as typeof layout
    expect(layout.widgets.some((w) => w.i === 'recent_activity')).toBe(true)
  })

  it('does not expose empty_* placeholder catalog entries', () => {
    for (const id of WORKFORCE_TAB_SURFACE_IDS) {
      const catalogIds = WORKFORCE_TAB_SURFACE_REGISTRY[id].catalog.map((e) => e.id)
      expect(catalogIds.every((widgetId) => !widgetId.startsWith('empty_'))).toBe(true)
    }
  })

  describe('WORKFORCE_TAB_SURFACE_REGISTRY', () => {
    it('has an entry for every WORKFORCE_TAB_SURFACE_IDS value', () => {
      for (const id of WORKFORCE_TAB_SURFACE_IDS) {
        expect(WORKFORCE_TAB_SURFACE_REGISTRY[id]).toBeDefined()
        expect(WORKFORCE_TAB_SURFACE_REGISTRY[id].id).toBe(id)
      }
    })

    it('normalize(null) returns defaults whose ids are all in the catalog', () => {
      for (const id of WORKFORCE_TAB_SURFACE_IDS) {
        const config = WORKFORCE_TAB_SURFACE_REGISTRY[id]
        const layout = config.normalize(null)
        expect(layout.widgets.length).toBeGreaterThan(0)
        const catalogIds = new Set(config.catalog.map((entry) => entry.id))
        for (const widget of layout.widgets) {
          expect(catalogIds.has(widget.i)).toBe(true)
        }
      }
    })

    it('toBase round-trips through normalize without losing widgets', () => {
      for (const id of WORKFORCE_TAB_SURFACE_IDS) {
        const config = WORKFORCE_TAB_SURFACE_REGISTRY[id]
        const layout = config.normalize(null)
        const base = config.toBase(layout)
        const renormalized = config.normalize(base)
        expect(renormalized.widgets.map((w) => w.i).sort()).toEqual(
          layout.widgets.map((w) => w.i).sort()
        )
      }
    })
  })

  describe('resolveWorkforceSurfaceId / getWorkforceTabSurfaceConfig', () => {
    it('maps work sub-tabs to dedicated surfaces', () => {
      expect(resolveWorkforceSurfaceId('work', 'list')).toBe('work_list')
      expect(resolveWorkforceSurfaceId('work', 'board')).toBe('work_board')
      expect(resolveWorkforceSurfaceId('work', 'schedule')).toBe('work_schedule')
      expect(resolveWorkforceSurfaceId('work', 'reports')).toBe('work_reports')
      expect(getWorkforceTabSurfaceConfig('work', 'board').id).toBe('work_board')
    })

    it('falls back to today for unknown tabs', () => {
      expect(isWorkforceTabSurfaceId('not-a-tab')).toBe(false)
      expect(resolveWorkforceSurfaceId('not-a-tab', 'list')).toBe('today')
      expect(getWorkforceTabSurfaceConfig('not-a-tab').id).toBe('today')
    })
  })
})
