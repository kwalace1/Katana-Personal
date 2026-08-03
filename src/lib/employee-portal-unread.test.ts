import { describe, it, expect } from 'vitest'
import {
  computePortalUnread,
  countCountableSyntheticUnread,
  isNonCountableSyntheticUnread,
  formatPortalUnreadCount,
} from './employee-portal-unread'
import { FEED_PRIORITY, type EmployeePortalFeedItem } from './employee-portal-feed'

function mkItem(
  overrides: Partial<EmployeePortalFeedItem> & Pick<EmployeePortalFeedItem, 'id'>
): EmployeePortalFeedItem {
  return {
    scope: 'for_you',
    category: 'notification',
    sortAt: Date.now(),
    title: 'Item',
    iconKind: 'bell',
    quickView: { details: [] },
    ...overrides,
  }
}

describe('employee-portal-unread', () => {
  it('sums persisted and comms unread counts', () => {
    const snapshot = computePortalUnread({
      persistedUnreadCount: 3,
      commsUnreadCount: 2,
    })
    expect(snapshot.total).toBe(5)
    expect(snapshot.persistedNotifications).toBe(3)
    expect(snapshot.comms).toBe(2)
    expect(snapshot.synthetic).toBe(0)
  })

  it('includes countable synthetic time-off but not due-soon alerts', () => {
    const items = [
      mkItem({ id: 'user-notif-1', unread: true }),
      mkItem({ id: 'comms-1', unread: true, iconKind: 'message' }),
      mkItem({ id: 'notif-goal-g1', unread: true, urgencyLabel: 'Due soon' }),
      mkItem({ id: 'timeoff-1', unread: true, urgencyLabel: 'Awaiting approval' }),
      mkItem({ id: 'hr-notice-1', unread: true, urgencyLabel: 'High priority' }),
    ]

    expect(isNonCountableSyntheticUnread(items[2])).toBe(true)
    expect(isNonCountableSyntheticUnread(items[4])).toBe(true)
    expect(countCountableSyntheticUnread(items)).toBe(1)

    const snapshot = computePortalUnread({
      persistedUnreadCount: 1,
      commsUnreadCount: 1,
      allFeedItems: items,
    })
    expect(snapshot.total).toBe(3)
    expect(snapshot.synthetic).toBe(1)
  })

  it('formats badge counts with 9+ cap', () => {
    expect(formatPortalUnreadCount(3)).toBe('3')
    expect(formatPortalUnreadCount(12)).toBe('9+')
  })
})
