import { describe, it, expect, vi } from 'vitest'
import { engageFeedItem } from './employee-portal-feed-engagement'
import { userNotificationFeedItemId } from './employee-portal-notifications'
import type { EmployeePortalFeedItem } from './employee-portal-feed'

function mkItem(overrides: Partial<EmployeePortalFeedItem> & Pick<EmployeePortalFeedItem, 'id'>): EmployeePortalFeedItem {
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

describe('engageFeedItem', () => {
  it('marks comms seen for comms feed items', () => {
    const markCommsSeen = vi.fn()
    engageFeedItem(mkItem({ id: 'comms-1', unread: true }), {
      markRead: vi.fn(),
      markCommsSeen,
    })
    expect(markCommsSeen).toHaveBeenCalledOnce()
  })

  it('marks persisted notifications read', () => {
    const markRead = vi.fn()
    engageFeedItem(
      mkItem({ id: userNotificationFeedItemId('n-1'), unread: true }),
      { markRead, markCommsSeen: vi.fn() }
    )
    expect(markRead).toHaveBeenCalledWith('n-1')
  })

  it('dismisses synthetic time-off items', () => {
    const dismissSynthetic = vi.fn()
    engageFeedItem(mkItem({ id: 'timeoff-1', unread: true }), {
      markRead: vi.fn(),
      markCommsSeen: vi.fn(),
      dismissSynthetic,
    })
    expect(dismissSynthetic).toHaveBeenCalledWith('timeoff-1')
  })

  it('marks feed items seen on engage', () => {
    const markSeen = vi.fn()
    engageFeedItem(mkItem({ id: 'assigned-goal-1' }), {
      markRead: vi.fn(),
      markCommsSeen: vi.fn(),
      markSeen,
    })
    expect(markSeen).toHaveBeenCalledWith('assigned-goal-1')
  })
})
