import { describe, it, expect, beforeEach } from 'vitest'
import {
  normalizeModuleLayoutBase,
  reorderSections,
  resolveSectionsForDisplay,
  toggleOrderedItemHidden,
  toggleSectionHidden,
  writeLayoutCache,
  readLayoutCache,
  cacheKeyForModuleLayout,
} from './module-layout'
import {
  DEFAULT_DETAIL_VIEW_ORDER,
  DEFAULT_PORTFOLIO_TAB_ORDER,
  DEFAULT_PROJECTS_DETAIL_SECTION_ORDER,
  DEFAULT_PROJECTS_PORTFOLIO_SECTION_ORDER,
  normalizeProjectsDetailLayout,
  normalizeProjectsPortfolioLayout,
  reorderDetailViews,
  toggleDetailViewHidden,
  togglePortfolioTabHidden,
} from './projects/projects-layout'

describe('module-layout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('normalizes partial order and fills missing sections', () => {
    const normalized = normalizeModuleLayoutBase(
      DEFAULT_PROJECTS_PORTFOLIO_SECTION_ORDER,
      { defaultPortfolioTab: 'grid', hiddenPortfolioTabs: [] },
      {
        sectionOrder: ['recent_activity', 'work_items'],
        hiddenSections: ['stats'],
      }
    )

    expect(normalized.sectionOrder[0]).toBe('recent_activity')
    expect(normalized.sectionOrder[1]).toBe('work_items')
    expect(normalized.sectionOrder).toEqual([
      'recent_activity',
      'work_items',
      ...DEFAULT_PROJECTS_PORTFOLIO_SECTION_ORDER.filter(
        (id) => id !== 'recent_activity' && id !== 'work_items'
      ),
    ])
    expect(normalized.hiddenSections).toEqual(['stats'])
  })

  it('drops unknown section ids from older clients', () => {
    const normalized = normalizeModuleLayoutBase(
      DEFAULT_PROJECTS_PORTFOLIO_SECTION_ORDER,
      {},
      {
        sectionOrder: ['unknown_section', 'stats'] as never[],
        hiddenSections: ['also_unknown'] as never[],
      }
    )
    expect(normalized.sectionOrder.includes('stats')).toBe(true)
    expect((normalized.sectionOrder as string[]).includes('unknown_section')).toBe(false)
    expect(normalized.hiddenSections).toEqual([])
  })

  it('hides sections unless customize mode is active', () => {
    const prefs = toggleSectionHidden(
      normalizeModuleLayoutBase(DEFAULT_PROJECTS_PORTFOLIO_SECTION_ORDER, {}, null),
      'stats'
    )
    expect(resolveSectionsForDisplay(prefs, false).includes('stats')).toBe(false)
    expect(resolveSectionsForDisplay(prefs, true).includes('stats')).toBe(true)
  })

  it('reorders sections without dropping ids', () => {
    const order = [...DEFAULT_PROJECTS_PORTFOLIO_SECTION_ORDER]
    const next = reorderSections(order, 0, 3)
    expect(next[3]).toBe('stats')
    expect(next.length).toBe(order.length)
  })

  it('refuses to hide the last ordered item', () => {
    const allButOne = DEFAULT_PORTFOLIO_TAB_ORDER.slice(1)
    const result = toggleOrderedItemHidden(
      DEFAULT_PORTFOLIO_TAB_ORDER,
      allButOne,
      'grid',
      1
    )
    expect(result).toBeNull()
  })

  it('caches layouts under the module surface key', () => {
    const key = cacheKeyForModuleLayout('projects', 'portfolio')
    expect(key).toBe('katana_module_layout:projects:portfolio')
    writeLayoutCache('projects', 'portfolio', {
      sectionOrder: ['stats'],
      hiddenSections: [],
      extras: {},
    })
    const cached = readLayoutCache('projects', 'portfolio') as { sectionOrder: string[] }
    expect(cached.sectionOrder).toEqual(['stats'])
  })
})

describe('projects-layout portfolio', () => {
  it('default layout matches planned visual order', () => {
    const layout = normalizeProjectsPortfolioLayout(null)
    expect(layout.sectionOrder).toEqual(DEFAULT_PROJECTS_PORTFOLIO_SECTION_ORDER)
    expect(layout.extras.defaultPortfolioTab).toBe('grid')
    expect(layout.extras.hiddenPortfolioTabs).toEqual([])
  })

  it('cannot hide all portfolio tabs', () => {
    let layout = normalizeProjectsPortfolioLayout(null)
    layout = togglePortfolioTabHidden(layout, 'list')
    layout = togglePortfolioTabHidden(layout, 'timeline')
    const blocked = togglePortfolioTabHidden(layout, 'grid')
    expect(blocked.extras.hiddenPortfolioTabs).toEqual(['list', 'timeline'])
    expect(blocked.extras.hiddenPortfolioTabs.includes('grid')).toBe(false)
  })

  it('moves default tab when the current default is hidden', () => {
    let layout = normalizeProjectsPortfolioLayout({
      extras: { defaultPortfolioTab: 'list', hiddenPortfolioTabs: [] },
    })
    layout = togglePortfolioTabHidden(layout, 'list')
    expect(layout.extras.defaultPortfolioTab).not.toBe('list')
    expect(layout.extras.hiddenPortfolioTabs.includes('list')).toBe(true)
  })
})

describe('projects-layout detail', () => {
  it('default layout matches planned visual order', () => {
    const layout = normalizeProjectsDetailLayout(null)
    expect(layout.sectionOrder).toEqual(DEFAULT_PROJECTS_DETAIL_SECTION_ORDER)
    expect(layout.extras.viewModeOrder).toEqual(DEFAULT_DETAIL_VIEW_ORDER)
    expect(layout.extras.defaultView).toBe('board')
  })

  it('cannot hide all view modes', () => {
    let layout = normalizeProjectsDetailLayout(null)
    for (const id of DEFAULT_DETAIL_VIEW_ORDER.slice(1)) {
      layout = toggleDetailViewHidden(layout, id)
    }
    const blocked = toggleDetailViewHidden(layout, 'board')
    expect(blocked.extras.hiddenViewModes.includes('board')).toBe(false)
    expect(blocked.extras.hiddenViewModes.length).toBe(DEFAULT_DETAIL_VIEW_ORDER.length - 1)
  })

  it('reorders view modes', () => {
    const layout = normalizeProjectsDetailLayout(null)
    const next = reorderDetailViews(layout, 0, 2)
    expect(next.extras.viewModeOrder[0]).toBe('table')
    expect(next.extras.viewModeOrder[2]).toBe('board')
    expect(next.extras.viewModeOrder.length).toBe(DEFAULT_DETAIL_VIEW_ORDER.length)
  })

  it('normalizes corrupt saved view order', () => {
    const layout = normalizeProjectsDetailLayout({
      extras: {
        viewModeOrder: ['board', 'not-a-view', 'files'],
        hiddenViewModes: ['not-a-view', 'files'],
        defaultView: 'files',
      },
    } as never)
    expect(layout.extras.viewModeOrder[0]).toBe('board')
    expect(layout.extras.viewModeOrder.includes('files')).toBe(true)
    expect((layout.extras.viewModeOrder as string[]).includes('not-a-view')).toBe(false)
    expect(layout.extras.defaultView).toBe('board')
  })
})
