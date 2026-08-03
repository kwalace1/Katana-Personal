import {
  isCommsFeedItem,
  isUserNotificationFeedItem,
  type EmployeePortalFeedItem,
} from '@/lib/employee-portal-feed'

export interface PortalUnreadSnapshot {
  /** Unread rows in user_notifications (from NotificationContext). */
  persistedNotifications: number
  /** Unread Comms messages in the portal feed. */
  comms: number
  /** Synthetic for_you items that count toward attention (e.g. pending time-off). */
  synthetic: number
  total: number
}

/** Synthetic items that show urgency but should not inflate the attention badge. */
export function isNonCountableSyntheticUnread(item: EmployeePortalFeedItem): boolean {
  if (item.id.startsWith('notif-goal-') || item.id.startsWith('notif-training-')) return true
  if (item.id.startsWith('hr-notice-')) return true
  return false
}

/** for_you feed rows that count toward the unified portal unread badge. */
export function isCountableFeedUnread(item: EmployeePortalFeedItem): boolean {
  if (item.scope !== 'for_you' || !item.unread) return false
  if (isUserNotificationFeedItem(item) || isCommsFeedItem(item)) return true
  if (isNonCountableSyntheticUnread(item)) return false
  if (item.id.startsWith('timeoff-')) return true
  return false
}

export function countCountableSyntheticUnread(items: EmployeePortalFeedItem[]): number {
  return items.filter((item) => {
    if (item.scope !== 'for_you' || !item.unread) return false
    if (isUserNotificationFeedItem(item) || isCommsFeedItem(item)) return false
    if (isNonCountableSyntheticUnread(item)) return false
    if (item.id.startsWith('timeoff-')) return true
    return false
  }).length
}

export function computePortalUnread(params: {
  persistedUnreadCount: number
  commsUnreadCount: number
  allFeedItems?: EmployeePortalFeedItem[]
}): PortalUnreadSnapshot {
  const synthetic = params.allFeedItems
    ? countCountableSyntheticUnread(params.allFeedItems)
    : 0

  const persistedNotifications = params.persistedUnreadCount
  const comms = params.commsUnreadCount
  const total = persistedNotifications + comms + synthetic

  return {
    persistedNotifications,
    comms,
    synthetic,
    total,
  }
}

export function formatPortalUnreadCount(count: number): string {
  return count > 9 ? '9+' : String(count)
}
