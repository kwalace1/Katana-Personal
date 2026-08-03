/**
 * Map persisted user_notifications into employee portal activity feed items.
 * All cross-module notifications funnel through the employee portal timeline.
 */

import type {
  NotificationSourceModule,
  UserNotification,
} from '@/lib/notifications-api'
import {
  formatNotificationTime,
  isNotificationUnread,
  notificationModuleLabel,
} from '@/lib/notifications-present'
import {
  FEED_PRIORITY,
  isCommsFeedItem,
  isUserNotificationFeedItem,
  type EmployeeFeedIconKind,
  type EmployeePortalFeedItem,
} from '@/lib/employee-portal-feed'

export { isUserNotificationFeedItem }

export function userNotificationFeedItemId(notificationId: string): string {
  return `user-notif-${notificationId}`
}

export function notificationIdFromFeedItem(item: EmployeePortalFeedItem): string | null {
  if (!isUserNotificationFeedItem(item)) return null
  return item.id.slice('user-notif-'.length) || null
}

function commsMessageIdFromNotification(notification: UserNotification): string | undefined {
  const messageId = notification.metadata?.message_id
  return typeof messageId === 'string' && messageId.length > 0 ? messageId : undefined
}

function iconKindForModule(module: NotificationSourceModule): EmployeeFeedIconKind {
  switch (module) {
    case 'projects':
      return 'project'
    case 'hr':
      return 'goal'
    case 'kyi':
      return 'activity'
    case 'customer_success':
    case 'kyc':
      return 'users'
    case 'comms':
      return 'message'
    case 'inventory':
      return 'activity'
    case 'workforce':
      return 'users'
    case 'support':
      return 'bell'
    case 'hub':
      return 'star'
    default:
      return 'bell'
  }
}

function priorityForNotification(notification: UserNotification): {
  rank: number
  urgencyLabel?: string
} {
  const unread = isNotificationUnread(notification)
  const overdueTypes = new Set(['task_overdue', 'goal_overdue', 'cs_task_overdue'])
  if (overdueTypes.has(notification.notification_type)) {
    return { rank: FEED_PRIORITY.OVERDUE, urgencyLabel: 'Overdue' }
  }
  const highPriorityTypes = new Set([
    'job_interview_scheduled',
    'job_offer_extended',
    'review_scheduled',
    'hr_time_off_approved',
    'hr_time_off_denied',
    'task_assigned',
    'task_reassigned',
  ])
  if (highPriorityTypes.has(notification.notification_type)) {
    return {
      rank: FEED_PRIORITY.UNREAD_ALERT,
      urgencyLabel: unread ? 'New update' : undefined,
    }
  }
  if (unread) {
    return { rank: FEED_PRIORITY.UNREAD_ALERT, urgencyLabel: 'New update' }
  }
  return { rank: FEED_PRIORITY.ACTIVITY }
}

function portalLinkPath(linkPath: string | null): string | undefined {
  if (!linkPath?.trim()) return undefined
  return linkPath
}

function quickViewLayoutForModule(
  module: NotificationSourceModule
): EmployeePortalFeedItem['quickView']['layout'] {
  if (module === 'projects') return 'project'
  if (module === 'comms') return 'message'
  return 'generic'
}

/** Map user_notifications rows to portal feed items (for_you scope). */
export function userNotificationsToFeedItems(
  notifications: UserNotification[]
): EmployeePortalFeedItem[] {
  return notifications.map((notification) => {
    const unread = isNotificationUnread(notification)
    const moduleLabel = notificationModuleLabel(notification.source_module)
    const { rank, urgencyLabel } = priorityForNotification(notification)
    const link = portalLinkPath(notification.link_path)
    const commsMessageId = commsMessageIdFromNotification(notification)

    return {
      id: userNotificationFeedItemId(notification.id),
      scope: 'for_you',
      category: 'notification',
      sortAt: new Date(notification.created_at).getTime(),
      priorityRank: rank,
      urgencyLabel,
      title: notification.title,
      subtitle: notification.body ?? undefined,
      time: formatNotificationTime(notification.created_at),
      link,
      meta: moduleLabel,
      unread,
      iconKind: iconKindForModule(notification.source_module),
      sourceModule: notification.source_module,
      notificationType: notification.notification_type,
      commsMessageId,
      quickView: {
        layout: quickViewLayoutForModule(notification.source_module),
        summary: notification.body ?? notification.title,
        body: notification.body ?? undefined,
        moduleLabel: link ? `Open in ${moduleLabel}` : undefined,
        details: [
          { label: 'Module', value: moduleLabel },
          { label: 'When', value: new Date(notification.created_at).toLocaleString() },
        ],
        timestamp: new Date(notification.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    }
  })
}

export {
  dedupeKeyFromUserNotification,
  dedupeKeyFromFeedItem,
  suppressSyntheticFeedItems,
  dedupeNotificationFeedItemsAgainstComms,
} from '@/lib/employee-portal-dedupe'

export function countUnreadUserNotificationFeedItems(items: EmployeePortalFeedItem[]): number {
  return items.filter((i) => isUserNotificationFeedItem(i) && i.unread).length
}
