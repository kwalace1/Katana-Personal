import { describe, it, expect, beforeEach } from 'vitest'
import {
  dismissFeedItem,
  dismissFeedItems,
  filterDismissedFeedItems,
  isDismissibleSyntheticFeedItem,
  listDismissibleSyntheticIds,
} from './employee-portal-dismissals'
import type { EmployeePortalFeedItem } from './employee-portal-feed'

function mkItem(id: string, unread = true): EmployeePortalFeedItem {
  return {
    id,
    scope: 'for_you',
    category: 'notification',
    sortAt: Date.now(),
    title: 'Test',
    unread,
    iconKind: 'bell',
    quickView: { details: [] },
  }
}

describe('employee-portal-dismissals', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('filters dismissed items from the feed', () => {
    dismissFeedItem('timeoff-1')
    const items = [mkItem('timeoff-1'), mkItem('timeoff-2')]
    expect(filterDismissedFeedItems(items)).toHaveLength(1)
    expect(filterDismissedFeedItems(items)[0].id).toBe('timeoff-2')
  })

  it('identifies dismissible synthetic time-off items', () => {
    expect(isDismissibleSyntheticFeedItem(mkItem('timeoff-abc'))).toBe(true)
    expect(isDismissibleSyntheticFeedItem(mkItem('notif-goal-1'))).toBe(false)
    expect(isDismissibleSyntheticFeedItem({ ...mkItem('timeoff-1'), unread: false })).toBe(false)
  })

  it('batch dismisses multiple ids', () => {
    dismissFeedItems(['timeoff-1', 'timeoff-2'])
    expect(filterDismissedFeedItems([mkItem('timeoff-1'), mkItem('timeoff-2')])).toHaveLength(0)
  })

  it('lists dismissible synthetic ids for mark-all-read', () => {
    const ids = listDismissibleSyntheticIds([
      mkItem('timeoff-1'),
      mkItem('user-notif-1'),
      mkItem('notif-goal-1'),
    ])
    expect(ids).toEqual(['timeoff-1'])
  })
})
