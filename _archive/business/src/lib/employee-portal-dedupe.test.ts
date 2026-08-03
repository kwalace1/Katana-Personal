import { describe, it, expect } from 'vitest'
import {
  dedupeKeyFromUserNotification,
  dedupeKeyFromFeedItem,
  suppressSyntheticFeedItems,
  dedupeNotificationFeedItemsAgainstComms,
} from './employee-portal-dedupe'
import { userNotificationsToFeedItems } from './employee-portal-notifications'
import { FEED_PRIORITY, type EmployeePortalFeedItem } from './employee-portal-feed'
import type { UserNotification } from './notifications-api'

function mkNotification(
  overrides: Partial<UserNotification> & Pick<UserNotification, 'source_module' | 'notification_type' | 'title'>
): UserNotification {
  return {
    id: overrides.id ?? 'notif-1',
    organization_id: 'org-1',
    recipient_user_id: 'user-1',
    actor_user_id: 'user-2',
    body: overrides.body ?? 'Details',
    link_path: overrides.link_path ?? '/employee/goals',
    metadata: overrides.metadata ?? {},
    read_at: overrides.read_at ?? null,
    created_at: overrides.created_at ?? new Date().toISOString(),
    ...overrides,
  }
}

function mkSyntheticGoalAssigned(goalId: string): EmployeePortalFeedItem {
  return {
    id: `assigned-goal-${goalId}`,
    scope: 'for_you',
    category: 'assigned',
    sortAt: Date.now(),
    title: 'Goal assigned to you',
    iconKind: 'goal',
    quickView: { details: [] },
  }
}

describe('employee-portal-dedupe', () => {
  it('maps user notification metadata to dedupe keys', () => {
    expect(
      dedupeKeyFromUserNotification(
        mkNotification({
          source_module: 'hr',
          notification_type: 'goal_assigned',
          title: 'Goal',
          metadata: { goal_id: 'g-1' },
        })
      )
    ).toBe('hr:goal:g-1')

    expect(
      dedupeKeyFromUserNotification(
        mkNotification({
          source_module: 'hr',
          notification_type: 'training_assigned',
          title: 'Training',
          metadata: { learning_path_id: 'lp-1' },
        })
      )
    ).toBe('hr:training:lp-1')

    expect(
      dedupeKeyFromUserNotification(
        mkNotification({
          source_module: 'hr',
          notification_type: 'hr_recognition_received',
          title: 'Recognition',
          metadata: { recognition_id: 'r-1' },
        })
      )
    ).toBe('hr:recognition:r-1')
  })

  it('maps synthetic feed items to matching dedupe keys', () => {
    expect(dedupeKeyFromFeedItem(mkSyntheticGoalAssigned('g-1'))).toBe('hr:goal:g-1')
    expect(
      dedupeKeyFromFeedItem({
        id: 'event-training-lp-2',
        scope: 'for_you',
        category: 'event',
        sortAt: Date.now(),
        title: 'Training due',
        iconKind: 'training',
        quickView: { details: [] },
      })
    ).toBe('hr:training:lp-2')
  })

  it('suppresses synthetic goal assigned when notification exists', () => {
    const notifications = [
      mkNotification({
        source_module: 'hr',
        notification_type: 'goal_assigned',
        title: 'New goal assigned',
        metadata: { goal_id: 'g-1' },
      }),
    ]

    const synthetic = [
      mkSyntheticGoalAssigned('g-1'),
      mkSyntheticGoalAssigned('g-2'),
    ]

    const result = suppressSyntheticFeedItems(synthetic, notifications)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('assigned-goal-g-2')
  })

  it('suppresses event-review when review_scheduled notification exists', () => {
    const notifications = [
      mkNotification({
        source_module: 'hr',
        notification_type: 'review_scheduled',
        title: 'Review scheduled',
        metadata: { review_id: 'rev-1' },
      }),
    ]

    const synthetic: EmployeePortalFeedItem[] = [
      {
        id: 'event-review',
        scope: 'for_you',
        category: 'event',
        sortAt: Date.now(),
        title: 'Performance Review',
        iconKind: 'star',
        quickView: { details: [] },
      },
    ]

    expect(suppressSyntheticFeedItems(synthetic, notifications)).toHaveLength(0)
  })

  it('dedupes comms notifications against live comms feed items', () => {
    const messageId = 'msg-99'
    const notificationItems = userNotificationsToFeedItems([
      mkNotification({
        id: 'comms-notif',
        source_module: 'comms',
        notification_type: 'comms_message',
        title: 'New message',
        metadata: { message_id: messageId },
      }),
      mkNotification({
        id: 'hr-notif',
        source_module: 'hr',
        notification_type: 'goal_assigned',
        title: 'Goal',
        metadata: { goal_id: 'g-1' },
      }),
    ])

    const commsFeed: EmployeePortalFeedItem[] = [
      {
        id: `comms-${messageId}`,
        scope: 'for_you',
        category: 'notification',
        sortAt: Date.now(),
        priorityRank: FEED_PRIORITY.COMMS_UNREAD,
        title: 'Message',
        unread: true,
        iconKind: 'message',
        sourceModule: 'comms',
        quickView: { details: [] },
      },
    ]

    const deduped = dedupeNotificationFeedItemsAgainstComms(notificationItems, commsFeed)
    expect(deduped).toHaveLength(1)
    expect(deduped[0].sourceModule).toBe('hr')
  })
})
