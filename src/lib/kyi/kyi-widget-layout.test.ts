import { describe, it, expect } from 'vitest'
import { addWidgetToLayout, removeWidgetFromLayout } from '@/lib/module-widget-layout'
import {
  DEFAULT_KYI_OVERVIEW_WIDGETS,
  KYI_OVERVIEW_WIDGET_CATALOG,
  KYI_TAB_SURFACE_IDS,
  KYI_TAB_SURFACE_REGISTRY,
  getKyiCompanySurfaceConfig,
  isKyiTabSurfaceId,
  normalizeKyiOverviewWidgetLayout,
  resolveKyiCompanySurfaceId,
} from './kyi-widget-layout'

describe('kyi-widget-layout', () => {
  it('normalizes default overview widget order', () => {
    const layout = normalizeKyiOverviewWidgetLayout(null)
    expect(layout.version).toBe(2)
    expect(layout.widgets.map((w) => w.i)).toEqual(
      DEFAULT_KYI_OVERVIEW_WIDGETS.map((w) => w.i)
    )
  })

  it('drops unknown widget ids from overview layout', () => {
    const layout = normalizeKyiOverviewWidgetLayout({
      version: 2,
      widgets: [
        { i: 'cap_raise_snapshot', x: 0, y: 0, w: 12, h: 12 },
        { i: 'not_real', x: 0, y: 12, w: 6, h: 4 },
      ],
      extras: {},
    })
    expect(layout.widgets.every((w) => w.i !== 'not_real')).toBe(true)
    expect(layout.widgets.some((w) => w.i === 'cap_raise_snapshot')).toBe(true)
  })

  it('adds and removes a catalog widget from overview layout', () => {
    let layout = normalizeKyiOverviewWidgetLayout(null)
    layout = removeWidgetFromLayout(layout, 'notes_history') as typeof layout
    expect(layout.widgets.some((w) => w.i === 'notes_history')).toBe(false)

    const entry = KYI_OVERVIEW_WIDGET_CATALOG.find((e) => e.id === 'notes_history')!
    layout = addWidgetToLayout(layout, entry) as typeof layout
    expect(layout.widgets.some((w) => w.i === 'notes_history')).toBe(true)
  })

  it('does not expose empty_* placeholder catalog entries', () => {
    for (const id of KYI_TAB_SURFACE_IDS) {
      const catalogIds = KYI_TAB_SURFACE_REGISTRY[id].catalog.map((e) => e.id)
      expect(catalogIds.every((widgetId) => !widgetId.startsWith('empty_'))).toBe(true)
    }
  })

  describe('KYI_TAB_SURFACE_REGISTRY', () => {
    it('has an entry for every KYI_TAB_SURFACE_IDS value', () => {
      for (const id of KYI_TAB_SURFACE_IDS) {
        expect(KYI_TAB_SURFACE_REGISTRY[id]).toBeDefined()
        expect(KYI_TAB_SURFACE_REGISTRY[id].id).toBe(id)
      }
    })

    it('normalize(null) returns defaults whose ids are all in the catalog', () => {
      for (const id of KYI_TAB_SURFACE_IDS) {
        const config = KYI_TAB_SURFACE_REGISTRY[id]
        const layout = config.normalize(null)
        expect(layout.widgets.length).toBeGreaterThan(0)
        const catalogIds = new Set(config.catalog.map((entry) => entry.id))
        for (const widget of layout.widgets) {
          expect(catalogIds.has(widget.i)).toBe(true)
        }
      }
    })

    it('toBase round-trips through normalize without losing widgets', () => {
      for (const id of KYI_TAB_SURFACE_IDS) {
        const config = KYI_TAB_SURFACE_REGISTRY[id]
        const layout = config.normalize(null)
        const base = config.toBase(layout)
        const renormalized = config.normalize(base)
        expect(renormalized.widgets.map((w) => w.i).sort()).toEqual(
          layout.widgets.map((w) => w.i).sort()
        )
      }
    })
  })

  describe('resolveKyiCompanySurfaceId / getKyiCompanySurfaceConfig', () => {
    it('maps company tabs and skips access map', () => {
      expect(resolveKyiCompanySurfaceId('overview')).toBe('overview')
      expect(resolveKyiCompanySurfaceId('leads')).toBe('leads')
      expect(resolveKyiCompanySurfaceId('accessmap')).toBeNull()
      expect(getKyiCompanySurfaceConfig('accessmap')).toBeNull()
      expect(resolveKyiCompanySurfaceId('investors')).toBe('contacts')
    })

    it('falls back to overview for unknown tabs', () => {
      expect(isKyiTabSurfaceId('not-a-tab')).toBe(false)
      expect(resolveKyiCompanySurfaceId('not-a-tab')).toBe('overview')
      expect(getKyiCompanySurfaceConfig('not-a-tab')?.id).toBe('overview')
    })
  })
})
