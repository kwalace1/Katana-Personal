import { describe, it, expect } from 'vitest'
import { addWidgetToLayout, removeWidgetFromLayout } from '@/lib/module-widget-layout'
import {
  DEFAULT_EMPLOYEE_FEED_WIDGETS,
  EMPLOYEE_FEED_WIDGET_CATALOG,
  EMPLOYEE_TAB_SURFACE_IDS,
  EMPLOYEE_TAB_SURFACE_REGISTRY,
  getEmployeeSurfaceConfig,
  isEmployeeTabSurfaceId,
  normalizeEmployeeFeedWidgetLayout,
  resolveEmployeeSurfaceId,
} from './employee-widget-layout'

describe('employee-widget-layout', () => {
  it('normalizes default feed widget order', () => {
    const layout = normalizeEmployeeFeedWidgetLayout(null)
    expect(layout.version).toBe(2)
    expect(layout.widgets.map((w) => w.i)).toEqual(DEFAULT_EMPLOYEE_FEED_WIDGETS.map((w) => w.i))
  })

  it('drops unknown widget ids from feed layout', () => {
    const layout = normalizeEmployeeFeedWidgetLayout({
      version: 2,
      widgets: [
        { i: 'profile_card', x: 0, y: 0, w: 3, h: 8 },
        { i: 'not_real', x: 0, y: 8, w: 6, h: 4 },
      ],
      extras: {},
    })
    expect(layout.widgets.every((w) => w.i !== 'not_real')).toBe(true)
    expect(layout.widgets.some((w) => w.i === 'profile_card')).toBe(true)
  })

  it('adds and removes a catalog widget from feed layout', () => {
    let layout = normalizeEmployeeFeedWidgetLayout(null)
    layout = removeWidgetFromLayout(layout, 'resources') as typeof layout
    expect(layout.widgets.some((w) => w.i === 'resources')).toBe(false)

    const entry = EMPLOYEE_FEED_WIDGET_CATALOG.find((e) => e.id === 'resources')!
    layout = addWidgetToLayout(layout, entry) as typeof layout
    expect(layout.widgets.some((w) => w.i === 'resources')).toBe(true)
  })

  it('does not expose empty_* placeholder catalog entries', () => {
    for (const id of EMPLOYEE_TAB_SURFACE_IDS) {
      const catalogIds = EMPLOYEE_TAB_SURFACE_REGISTRY[id].catalog.map((e) => e.id)
      expect(catalogIds.every((widgetId) => !widgetId.startsWith('empty_'))).toBe(true)
    }
  })

  describe('EMPLOYEE_TAB_SURFACE_REGISTRY', () => {
    it('has an entry for every EMPLOYEE_TAB_SURFACE_IDS value', () => {
      for (const id of EMPLOYEE_TAB_SURFACE_IDS) {
        expect(EMPLOYEE_TAB_SURFACE_REGISTRY[id]).toBeDefined()
        expect(EMPLOYEE_TAB_SURFACE_REGISTRY[id].id).toBe(id)
      }
    })

    it('normalize(null) returns defaults whose ids are all in the catalog', () => {
      for (const id of EMPLOYEE_TAB_SURFACE_IDS) {
        const config = EMPLOYEE_TAB_SURFACE_REGISTRY[id]
        const layout = config.normalize(null)
        expect(layout.widgets.length).toBeGreaterThan(0)
        const catalogIds = new Set(config.catalog.map((entry) => entry.id))
        for (const widget of layout.widgets) {
          expect(catalogIds.has(widget.i)).toBe(true)
        }
      }
    })

    it('toBase round-trips through normalize without losing widgets', () => {
      for (const id of EMPLOYEE_TAB_SURFACE_IDS) {
        const config = EMPLOYEE_TAB_SURFACE_REGISTRY[id]
        const layout = config.normalize(null)
        const base = config.toBase(layout)
        const renormalized = config.normalize(base)
        expect(renormalized.widgets.map((w) => w.i).sort()).toEqual(
          layout.widgets.map((w) => w.i).sort()
        )
      }
    })
  })

  describe('resolveEmployeeSurfaceId / getEmployeeSurfaceConfig', () => {
    it('maps portal paths to surfaces', () => {
      expect(resolveEmployeeSurfaceId('/employee')).toBe('feed')
      expect(resolveEmployeeSurfaceId('/employee/work')).toBe('my_work')
      expect(resolveEmployeeSurfaceId('/employee/directory')).toBe('directory')
      expect(resolveEmployeeSurfaceId('/employee/performance')).toBe('performance')
      expect(resolveEmployeeSurfaceId('/employee/goals')).toBe('goals')
      expect(resolveEmployeeSurfaceId('/employee/development')).toBe('development')
      expect(resolveEmployeeSurfaceId('/employee/profile')).toBe('profile')
      expect(resolveEmployeeSurfaceId('/employee/jobs')).toBe('jobs')
      expect(getEmployeeSurfaceConfig('/employee/goals').id).toBe('goals')
    })

    it('falls back to feed for unknown paths', () => {
      expect(isEmployeeTabSurfaceId('not-a-tab')).toBe(false)
      expect(resolveEmployeeSurfaceId('/employee/unknown')).toBe('feed')
    })
  })
})
