import { describe, it, expect } from 'vitest'
import { addWidgetToLayout, removeWidgetFromLayout } from '@/lib/module-widget-layout'
import {
  DEFAULT_HR_DASHBOARD_ADMIN_WIDGETS,
  HR_DASHBOARD_ADMIN_WIDGET_CATALOG,
  HR_TAB_SURFACE_IDS,
  HR_TAB_SURFACE_REGISTRY,
  getHrTabSurfaceConfig,
  isHrTabSurfaceId,
  resolveHrSurfaceId,
} from './hr-widget-layout'

describe('hr-widget-layout', () => {
  it('normalizes default admin dashboard widget order', () => {
    const layout = HR_TAB_SURFACE_REGISTRY.dashboard.normalize(null)
    expect(layout.version).toBe(2)
    expect(layout.widgets.map((w) => w.i)).toEqual(
      DEFAULT_HR_DASHBOARD_ADMIN_WIDGETS.map((w) => w.i)
    )
  })

  it('drops unknown widget ids from dashboard layout', () => {
    const layout = HR_TAB_SURFACE_REGISTRY.dashboard.normalize({
      version: 2,
      widgets: [
        { i: 'directory', x: 0, y: 0, w: 8, h: 14 },
        { i: 'not_real', x: 0, y: 14, w: 6, h: 4 },
      ],
      extras: {},
    })
    expect(layout.widgets.every((w) => w.i !== 'not_real')).toBe(true)
    expect(layout.widgets.some((w) => w.i === 'directory')).toBe(true)
  })

  it('adds and removes a catalog widget from dashboard layout', () => {
    let layout = HR_TAB_SURFACE_REGISTRY.dashboard.normalize(null)
    layout = removeWidgetFromLayout(layout, 'recent_activity') as typeof layout
    expect(layout.widgets.some((w) => w.i === 'recent_activity')).toBe(false)

    const entry = HR_DASHBOARD_ADMIN_WIDGET_CATALOG.find((e) => e.id === 'recent_activity')!
    layout = addWidgetToLayout(layout, entry) as typeof layout
    expect(layout.widgets.some((w) => w.i === 'recent_activity')).toBe(true)
  })

  it('does not expose empty_* placeholder catalog entries', () => {
    for (const id of HR_TAB_SURFACE_IDS) {
      const catalogIds = HR_TAB_SURFACE_REGISTRY[id].catalog.map((e) => e.id)
      expect(catalogIds.every((widgetId) => !widgetId.startsWith('empty_'))).toBe(true)
    }
  })

  it('uses member dashboard catalog when isAdmin is false', () => {
    const config = getHrTabSurfaceConfig('dashboard', { isAdmin: false })
    const layout = config.normalize(null)
    expect(layout.widgets.map((w) => w.i)).toEqual(['my_overview'])
    expect(config.catalog.every((e) => e.id !== 'directory')).toBe(true)
  })

  describe('HR_TAB_SURFACE_REGISTRY', () => {
    it('has an entry for every HR_TAB_SURFACE_IDS value', () => {
      for (const id of HR_TAB_SURFACE_IDS) {
        expect(HR_TAB_SURFACE_REGISTRY[id]).toBeDefined()
        expect(HR_TAB_SURFACE_REGISTRY[id].id).toBe(id)
      }
    })

    it('normalize(null) returns defaults whose ids are all in the catalog', () => {
      for (const id of HR_TAB_SURFACE_IDS) {
        const config = HR_TAB_SURFACE_REGISTRY[id]
        const layout = config.normalize(null)
        expect(layout.widgets.length).toBeGreaterThan(0)
        const catalogIds = new Set(config.catalog.map((entry) => entry.id))
        for (const widget of layout.widgets) {
          expect(catalogIds.has(widget.i)).toBe(true)
        }
      }
    })

    it('toBase round-trips through normalize without losing widgets', () => {
      for (const id of HR_TAB_SURFACE_IDS) {
        const config = HR_TAB_SURFACE_REGISTRY[id]
        const layout = config.normalize(null)
        const base = config.toBase(layout)
        const renormalized = config.normalize(base)
        expect(renormalized.widgets.map((w) => w.i).sort()).toEqual(
          layout.widgets.map((w) => w.i).sort()
        )
      }
    })
  })

  describe('resolveHrSurfaceId / getHrTabSurfaceConfig', () => {
    it('maps recruitment and development sub-views', () => {
      expect(resolveHrSurfaceId('recruitment', { recruitmentSection: 'pipeline' })).toBe(
        'recruitment_pipeline'
      )
      expect(resolveHrSurfaceId('recruitment', { recruitmentSection: 'applications' })).toBe(
        'recruitment_applications'
      )
      expect(resolveHrSurfaceId('recruitment', { recruitmentSection: 'talent-pool' })).toBe(
        'recruitment_talent_pool'
      )
      expect(resolveHrSurfaceId('development', { developmentSection: 'learning' })).toBe(
        'development_learning'
      )
      expect(resolveHrSurfaceId('time-off')).toBe('time_off')
      expect(resolveHrSurfaceId('job-listings')).toBe('job_listings')
    })

    it('falls back to dashboard for unknown tabs', () => {
      expect(isHrTabSurfaceId('not-a-tab')).toBe(false)
      expect(resolveHrSurfaceId('not-a-tab')).toBe('dashboard')
      expect(getHrTabSurfaceConfig('not-a-tab').id).toBe('dashboard')
    })
  })
})
