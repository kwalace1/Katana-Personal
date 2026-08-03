import { describe, it, expect } from 'vitest'
import {
  addWidgetToLayout,
  applyGridLayoutChange,
  availableCatalogEntries,
  migrateSectionLayoutToWidgets,
  normalizeModuleWidgetLayout,
  removeWidgetFromLayout,
} from './module-widget-layout'
import {
  DEFAULT_PROJECTS_PORTFOLIO_WIDGETS,
  PROJECTS_PORTFOLIO_WIDGET_CATALOG,
  normalizeProjectsDetailWidgetLayout,
  normalizeProjectsPortfolioWidgetLayout,
} from './projects/projects-widget-layout'
import { DEFAULT_PROJECTS_PORTFOLIO_SECTION_ORDER } from './projects/projects-layout'

describe('module-widget-layout', () => {
  it('normalizes default portfolio widgets', () => {
    const layout = normalizeModuleWidgetLayout(
      null,
      PROJECTS_PORTFOLIO_WIDGET_CATALOG,
      DEFAULT_PROJECTS_PORTFOLIO_WIDGETS
    )
    expect(layout.version).toBe(2)
    expect(layout.widgets.map((w) => w.i)).toEqual(
      DEFAULT_PROJECTS_PORTFOLIO_WIDGETS.map((w) => w.i)
    )
  })

  it('drops unknown widget ids', () => {
    const layout = normalizeModuleWidgetLayout(
      {
        version: 2,
        widgets: [
          { i: 'stats', x: 0, y: 0, w: 12, h: 3 },
          { i: 'not_real', x: 0, y: 3, w: 6, h: 4 },
        ],
        extras: {},
      },
      PROJECTS_PORTFOLIO_WIDGET_CATALOG,
      DEFAULT_PROJECTS_PORTFOLIO_WIDGETS
    )
    expect(layout.widgets.every((w) => w.i !== 'not_real')).toBe(true)
    expect(layout.widgets.some((w) => w.i === 'stats')).toBe(true)
  })

  it('migrates v1 section order into stacked widgets', () => {
    const widgets = migrateSectionLayoutToWidgets(
      ['work_items', 'stats'],
      ['stats'],
      PROJECTS_PORTFOLIO_WIDGET_CATALOG,
      { work_items: 8, stats: 3 }
    )
    expect(widgets).toEqual([
      expect.objectContaining({ i: 'work_items', x: 0, y: 0, w: 12, h: 8 }),
    ])
  })

  it('adds and removes widgets from catalog', () => {
    let layout = normalizeProjectsPortfolioWidgetLayout(null)
    const metric = PROJECTS_PORTFOLIO_WIDGET_CATALOG.find(
      (e) => e.id === 'metric_active_projects'
    )!
    layout = addWidgetToLayout(layout, metric) as typeof layout
    expect(layout.widgets.some((w) => w.i === 'metric_active_projects')).toBe(true)
    layout = removeWidgetFromLayout(layout, 'metric_active_projects') as typeof layout
    expect(layout.widgets.some((w) => w.i === 'metric_active_projects')).toBe(false)
  })

  it('applies grid layout changes', () => {
    const layout = normalizeProjectsPortfolioWidgetLayout(null)
    const next = applyGridLayoutChange(layout, [
      { i: 'stats', x: 2, y: 1, w: 8, h: 4 },
      ...layout.widgets
        .filter((w) => w.i !== 'stats')
        .map((w) => ({ i: w.i, x: w.x, y: w.y, w: w.w, h: w.h })),
    ])
    const stats = next.widgets.find((w) => w.i === 'stats')
    expect(stats).toMatchObject({ x: 2, y: 1, w: 8, h: 4 })
  })

  it('lists available catalog entries excluding placed widgets', () => {
    const layout = normalizeProjectsPortfolioWidgetLayout(null)
    const available = availableCatalogEntries(layout, PROJECTS_PORTFOLIO_WIDGET_CATALOG)
    expect(available.every((e) => !layout.widgets.some((w) => w.i === e.id))).toBe(true)
    expect(available.some((e) => e.id === 'metric_total_projects')).toBe(true)
  })
})

describe('projects-widget-layout migration', () => {
  it('migrates portfolio v1 section layout to v2 widgets', () => {
    const layout = normalizeProjectsPortfolioWidgetLayout({
      sectionOrder: ['recent_activity', 'stats', ...DEFAULT_PROJECTS_PORTFOLIO_SECTION_ORDER],
      hiddenSections: ['work_items'],
      extras: { defaultPortfolioTab: 'list', hiddenPortfolioTabs: ['timeline'] },
    })
    expect(layout.version).toBe(2)
    expect(layout.widgets[0]?.i).toBe('recent_activity')
    expect(layout.widgets.some((w) => w.i === 'work_items')).toBe(false)
    expect(layout.extras.defaultPortfolioTab).toBe('list')
    expect(layout.extras.hiddenPortfolioTabs).toEqual(['timeline'])
  })

  it('migrates detail v1 section layout to v2 widgets', () => {
    const layout = normalizeProjectsDetailWidgetLayout({
      sectionOrder: ['main_view', 'discussion'],
      hiddenSections: ['linked_records'],
      extras: { defaultView: 'table', viewModeOrder: ['table', 'board'], hiddenViewModes: [] },
    })
    expect(layout.version).toBe(2)
    expect(layout.widgets[0]?.i).toBe('main_view')
    expect(layout.widgets.map((w) => w.i)).toContain('discussion')
    expect(layout.widgets.some((w) => w.i === 'linked_records')).toBe(false)
    expect(layout.extras.defaultView).toBe('table')
  })

  it('default detail layout matches catalog defaults', () => {
    const layout = normalizeProjectsDetailWidgetLayout(null)
    expect(layout.widgets.map((w) => w.i)).toEqual([
      'stats',
      'linked_records',
      'discussion',
      'main_view',
      'recent_activity',
    ])
  })
})
