import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_HUB_SECTION_ORDER,
  loadHubLayout,
  normalizeHubLayout,
  reorderHubSections,
  resolveHubSectionsForDisplay,
  resetHubLayout,
  saveHubLayout,
  toggleHubSectionHidden,
} from './hub-layout'

describe('hub-layout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('normalizes partial saved order and fills missing sections', () => {
    const normalized = normalizeHubLayout({
      sectionOrder: ['activity_feed', 'your_tools'],
      hiddenSections: ['launchpad'],
    })

    expect(normalized.sectionOrder[0]).toBe('activity_feed')
    expect(normalized.sectionOrder[1]).toBe('your_tools')
    expect(normalized.sectionOrder).toEqual([
      'activity_feed',
      'your_tools',
      ...DEFAULT_HUB_SECTION_ORDER.filter((id) => id !== 'activity_feed' && id !== 'your_tools'),
    ])
    expect(normalized.hiddenSections).toEqual(['launchpad'])
  })

  it('persists layout preferences to localStorage', () => {
    saveHubLayout({
      sectionOrder: ['your_tools', 'activity_feed', 'profile_setup', 'performance_overview', 'key_metrics', 'launchpad'],
      hiddenSections: ['profile_setup'],
    })

    expect(loadHubLayout().hiddenSections).toEqual(['profile_setup'])
  })

  it('hides sections unless customize mode is active', () => {
    const prefs = toggleHubSectionHidden(normalizeHubLayout(null), 'key_metrics')
    expect(resolveHubSectionsForDisplay(prefs, false).includes('key_metrics')).toBe(false)
    expect(resolveHubSectionsForDisplay(prefs, true).includes('key_metrics')).toBe(true)
  })

  it('reorders sections without dropping ids', () => {
    const order = [...DEFAULT_HUB_SECTION_ORDER]
    const next = reorderHubSections(order, 0, 3)
    expect(next[3]).toBe('profile_setup')
    expect(next.length).toBe(order.length)
  })

  it('reset restores default layout', () => {
    saveHubLayout({
      sectionOrder: ['activity_feed'],
      hiddenSections: ['your_tools'],
    })
    const reset = resetHubLayout()
    expect(reset.sectionOrder).toEqual(DEFAULT_HUB_SECTION_ORDER)
    expect(reset.hiddenSections).toEqual([])
  })
})
