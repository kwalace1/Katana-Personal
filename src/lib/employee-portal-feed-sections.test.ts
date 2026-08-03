import { describe, it, expect, beforeEach } from 'vitest'
import {
  isNewFeedItem,
  splitFeedIntoNewAndEarlier,
  countNewFeedItems,
  countHistoryFeedItems,
  filterFeedItemsByDisplayMode,
} from './employee-portal-feed-sections'
import { markFeedItemSeen } from './employee-portal-feed-seen'
import type { EmployeePortalFeedItem } from './employee-portal-feed'

function mkItem(
  overrides: Partial<EmployeePortalFeedItem> & Pick<EmployeePortalFeedItem, 'id'>
): EmployeePortalFeedItem {
  return {
    scope: 'for_you',
    category: 'notification',
    sortAt: Date.now(),
    title: 'Test',
    iconKind: 'bell',
    quickView: { details: [] },
    ...overrides,
  }
}

describe('employee-portal-feed-sections', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('treats unread items as new', () => {
    expect(isNewFeedItem(mkItem({ id: 'n-1', unread: true }))).toBe(true)
  })

  it('treats unseen for_you items as new', () => {
    expect(isNewFeedItem(mkItem({ id: 'assigned-goal-1', scope: 'for_you' }))).toBe(true)
  })

  it('treats seen for_you items without unread as earlier', () => {
    markFeedItemSeen('assigned-goal-1')
    expect(isNewFeedItem(mkItem({ id: 'assigned-goal-1', scope: 'for_you' }))).toBe(false)
  })

  it('does not treat company items as new when unread is false', () => {
    expect(
      isNewFeedItem(mkItem({ id: 'hr-activity-1', scope: 'company', unread: false }))
    ).toBe(false)
  })

  it('splits feed into new and earlier with divider flag', () => {
    markFeedItemSeen('old-1')
    const split = splitFeedIntoNewAndEarlier([
      mkItem({ id: 'new-1', unread: true }),
      mkItem({ id: 'new-2', scope: 'for_you' }),
      mkItem({ id: 'old-1', scope: 'for_you' }),
      mkItem({ id: 'company-1', scope: 'company' }),
    ])

    expect(split.newItems.map((i) => i.id)).toEqual(['new-1', 'new-2'])
    expect(split.earlierItems.map((i) => i.id)).toEqual(['old-1', 'company-1'])
    expect(split.showCaughtUpDivider).toBe(true)
  })

  it('counts and filters items by display mode', () => {
    markFeedItemSeen('old-1')
    const items = [
      mkItem({ id: 'new-1', unread: true }),
      mkItem({ id: 'old-1', scope: 'for_you' }),
      mkItem({ id: 'company-1', scope: 'company' }),
    ]

    expect(countNewFeedItems(items)).toBe(1)
    expect(countHistoryFeedItems(items)).toBe(2)
    expect(filterFeedItemsByDisplayMode(items, 'active').map((i) => i.id)).toEqual(['new-1'])
    expect(filterFeedItemsByDisplayMode(items, 'history').map((i) => i.id)).toEqual([
      'old-1',
      'company-1',
    ])
  })
})
