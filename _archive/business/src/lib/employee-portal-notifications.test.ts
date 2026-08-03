import { describe, it, expect } from 'vitest'
import {
  dedupeNotificationFeedItemsAgainstComms,
  userNotificationsToFeedItems,
  userNotificationFeedItemId,
} from './employee-portal-notifications'
import {
  mergeUserNotificationsIntoFeed,
  filterEmployeePortalFeed,
  isUpdateFeedItem,
  isDeadlineFeedItem,
  FEED_PRIORITY,
  type EmployeePortalFeedItem,
} from './employee-portal-feed'
import type { UserNotification } from './notifications-api'

function mkNotification(
  overrides: Partial<UserNotification> & Pick<UserNotification, 'source_module' | 'notification_type' | 'title'>
): UserNotification {
  return {
    id: overrides.id ?? 'notif-1',
    organization_id: 'org-1',
    recipient_user_id: 'user-1',
    actor_user_id: 'user-2',
    body: overrides.body ?? 'Details here',
    link_path: overrides.link_path ?? '/projects/proj-1',
    metadata: overrides.metadata ?? {},
    read_at: overrides.read_at ?? null,
    created_at: overrides.created_at ?? new Date().toISOString(),
    ...overrides,
  }
}

function mkCommsFeedItem(messageId: string): EmployeePortalFeedItem {
  return {
    id: `comms-${messageId}`,
    scope: 'for_you',
    category: 'notification',
    sortAt: Date.now(),
    priorityRank: FEED_PRIORITY.COMMS_UNREAD,
    title: 'Message from Jane',
    unread: true,
    iconKind: 'message',
    sourceModule: 'comms',
    commsMessageId: messageId,
    quickView: { details: [] },
  }
}

describe('employee-portal-notifications', () => {
  it('includes all notification source modules in the feed', () => {
    const notifications = [
      mkNotification({ id: '1', source_module: 'projects', notification_type: 'task_assigned', title: 'PM' }),
      mkNotification({ id: '2', source_module: 'hr', notification_type: 'goal_assigned', title: 'HR' }),
      mkNotification({ id: '3', source_module: 'kyi', notification_type: 'kyi_leads_added', title: 'KYI' }),
      mkNotification({
        id: '4',
        source_module: 'customer_success',
        notification_type: 'cs_task_created',
        title: 'CS',
      }),
      mkNotification({ id: '5', source_module: 'comms', notification_type: 'comms_message', title: 'Comms' }),
      mkNotification({ id: '6', source_module: 'inventory', notification_type: 'low_stock', title: 'Inv' }),
      mkNotification({ id: '7', source_module: 'workforce', notification_type: 'job_assigned', title: 'WFM' }),
      mkNotification({ id: '8', source_module: 'support', notification_type: 'support_assigned', title: 'Support' }),
    ]

    const items = userNotificationsToFeedItems(notifications)
    expect(items).toHaveLength(8)
    expect(items.map((i) => i.sourceModule)).toEqual([
      'projects',
      'hr',
      'kyi',
      'customer_success',
      'comms',
      'inventory',
      'workforce',
      'support',
    ])
  })

  it('maps notifications to for_you feed items with module meta', () => {
    const items = userNotificationsToFeedItems([
      mkNotification({
        id: 'abc',
        source_module: 'projects',
        notification_type: 'task_assigned',
        title: 'Task assigned to you',
        body: 'Ship feature',
      }),
    ])

    expect(items).toHaveLength(1)
    expect(items[0].id).toBe(userNotificationFeedItemId('abc'))
    expect(items[0].scope).toBe('for_you')
    expect(items[0].meta).toBe('Katana PM')
    expect(items[0].unread).toBe(true)
    expect(items[0].link).toBe('/projects/proj-1')
    expect(items[0].iconKind).toBe('project')
    expect(items[0].notificationType).toBe('task_assigned')
  })

  it('prioritizes job interview notifications', () => {
    const items = userNotificationsToFeedItems([
      mkNotification({
        source_module: 'hr',
        notification_type: 'job_interview_scheduled',
        title: 'Interview scheduled',
        link_path: '/employee/jobs',
      }),
    ])

    expect(items[0].priorityRank).toBe(FEED_PRIORITY.UNREAD_ALERT)
    expect(items[0].link).toBe('/employee/jobs')
  })

  it('prioritizes overdue notifications', () => {
    const items = userNotificationsToFeedItems([
      mkNotification({
        source_module: 'hr',
        notification_type: 'goal_overdue',
        title: 'Goal behind',
        read_at: new Date().toISOString(),
      }),
    ])

    expect(items[0].priorityRank).toBe(FEED_PRIORITY.OVERDUE)
    expect(items[0].urgencyLabel).toBe('Overdue')
  })

  it('merges into feed and appears under updates filter', () => {
    const notificationItems = userNotificationsToFeedItems([
      mkNotification({
        source_module: 'customer_success',
        notification_type: 'cs_task_created',
        title: 'New customer task',
      }),
    ])

    const merged = mergeUserNotificationsIntoFeed([], notificationItems)
    const updates = filterEmployeePortalFeed(merged, 'for_you', 'updates', 'all')

    expect(updates.some((i) => i.id.startsWith('user-notif-'))).toBe(true)
    expect(isUpdateFeedItem(updates[0])).toBe(true)
    expect(isDeadlineFeedItem(updates[0])).toBe(false)
  })

  it('filters by notification module', () => {
    const notificationItems = userNotificationsToFeedItems([
      mkNotification({ id: '1', source_module: 'projects', notification_type: 'task_assigned', title: 'PM' }),
      mkNotification({ id: '2', source_module: 'inventory', notification_type: 'low_stock', title: 'Stock' }),
    ])

    const merged = mergeUserNotificationsIntoFeed([], notificationItems)
    const inventoryOnly = filterEmployeePortalFeed(merged, 'all', 'all', 'inventory')

    expect(inventoryOnly).toHaveLength(1)
    expect(inventoryOnly[0].sourceModule).toBe('inventory')
  })

  it('filters all notifications across modules', () => {
    const notificationItems = userNotificationsToFeedItems([
      mkNotification({ id: '1', source_module: 'projects', notification_type: 'task_assigned', title: 'PM' }),
      mkNotification({ id: '2', source_module: 'hr', notification_type: 'goal_assigned', title: 'HR' }),
    ])
    const merged = mergeUserNotificationsIntoFeed(
      [
        {
          id: 'assigned-goal-g1',
          scope: 'for_you',
          category: 'assigned',
          sortAt: Date.now(),
          title: 'Goal assigned',
          iconKind: 'goal',
          quickView: { details: [] },
        },
      ],
      notificationItems
    )

    const notificationsOnly = filterEmployeePortalFeed(merged, 'all', 'all', 'notifications')
    expect(notificationsOnly).toHaveLength(2)
    expect(notificationsOnly.every((i) => i.id.startsWith('user-notif-'))).toBe(true)
  })

  it('treats overdue user notifications as deadlines', () => {
    const items = userNotificationsToFeedItems([
      mkNotification({
        source_module: 'projects',
        notification_type: 'task_overdue',
        title: 'Project task overdue',
      }),
    ])

    expect(isDeadlineFeedItem(items[0])).toBe(true)
  })

  it('dedupes comms notifications when live comms feed item exists', () => {
    const messageId = 'msg-abc'
    const notificationItems = userNotificationsToFeedItems([
      mkNotification({
        id: 'comms-notif',
        source_module: 'comms',
        notification_type: 'comms_message',
        title: 'New message',
        metadata: { message_id: messageId },
      }),
      mkNotification({
        id: 'pm-notif',
        source_module: 'projects',
        notification_type: 'task_assigned',
        title: 'Task assigned',
      }),
    ])

    const deduped = dedupeNotificationFeedItemsAgainstComms(
      notificationItems,
      [mkCommsFeedItem(messageId)]
    )

    expect(deduped).toHaveLength(1)
    expect(deduped[0].sourceModule).toBe('projects')
  })
})
