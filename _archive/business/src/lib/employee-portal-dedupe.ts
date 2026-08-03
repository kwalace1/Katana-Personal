/**
 * Suppress duplicate employee portal feed items when persisted notifications
 * (or live Comms messages) already represent the same event.
 */

import type { UserNotification } from '@/lib/notifications-api'
import {
  isCommsFeedItem,
  isUserNotificationFeedItem,
  type EmployeePortalFeedItem,
} from '@/lib/employee-portal-feed'

/** Canonical key aligned with notification-modules dedupeKey values where possible. */
export type FeedDedupeKey = string

export function dedupeKeyFromUserNotification(notification: UserNotification): FeedDedupeKey | null {
  const meta = notification.metadata ?? {}

  if (notification.source_module === 'comms') {
    const messageId = meta.message_id
    if (typeof messageId === 'string' && messageId.length > 0) {
      return `comms:message:${messageId}`
    }
  }

  if (notification.source_module === 'hr') {
    if (typeof meta.goal_id === 'string' && meta.goal_id.length > 0) {
      return `hr:goal:${meta.goal_id}`
    }
    if (typeof meta.learning_path_id === 'string' && meta.learning_path_id.length > 0) {
      return `hr:training:${meta.learning_path_id}`
    }
    if (typeof meta.recognition_id === 'string' && meta.recognition_id.length > 0) {
      return `hr:recognition:${meta.recognition_id}`
    }
    if (typeof meta.review_id === 'string' && meta.review_id.length > 0) {
      return `hr:review:${meta.review_id}`
    }
    if (typeof meta.time_off_id === 'string' && meta.time_off_id.length > 0) {
      if (notification.notification_type === 'hr_time_off_approved') {
        return `hr:timeoff:${meta.time_off_id}:Approved`
      }
      if (notification.notification_type === 'hr_time_off_denied') {
        return `hr:timeoff:${meta.time_off_id}:Denied`
      }
    }
  }

  if (notification.source_module === 'projects') {
    const taskId = meta.task_id
    if (
      typeof taskId === 'string' &&
      taskId.length > 0 &&
      ['task_assigned', 'task_reassigned'].includes(notification.notification_type)
    ) {
      return `projects:task:${taskId}:assign`
    }
  }

  return null
}

export function dedupeKeyFromFeedItem(item: EmployeePortalFeedItem): FeedDedupeKey | null {
  if (isUserNotificationFeedItem(item) || isCommsFeedItem(item)) return null

  const { id } = item

  if (id.startsWith('assigned-goal-')) return `hr:goal:${id.slice('assigned-goal-'.length)}`
  if (id.startsWith('event-goal-')) return `hr:goal:${id.slice('event-goal-'.length)}`
  if (id.startsWith('notif-goal-')) return `hr:goal:${id.slice('notif-goal-'.length)}`

  if (id.startsWith('assigned-training-')) {
    return `hr:training:${id.slice('assigned-training-'.length)}`
  }
  if (id.startsWith('event-training-')) return `hr:training:${id.slice('event-training-'.length)}`
  if (id.startsWith('notif-training-')) return `hr:training:${id.slice('notif-training-'.length)}`

  if (id.startsWith('recognition-')) return `hr:recognition:${id.slice('recognition-'.length)}`

  if (id === 'event-review') return 'hr:review:any'

  if (id.startsWith('timeoff-')) {
    const requestId = id.slice('timeoff-'.length)
    if (item.urgencyLabel === 'Approved' || item.urgencyLabel === 'Denied') {
      return `hr:timeoff:${requestId}:${item.urgencyLabel}`
    }
  }

  return null
}

function collectNotificationDedupeKeys(notifications: UserNotification[]): Set<FeedDedupeKey> {
  const keys = new Set<FeedDedupeKey>()
  let hasReviewScheduled = false

  for (const notification of notifications) {
    const key = dedupeKeyFromUserNotification(notification)
    if (key) keys.add(key)
    if (notification.notification_type === 'review_scheduled') {
      hasReviewScheduled = true
    }
  }

  if (hasReviewScheduled) keys.add('hr:review:any')

  return keys
}

/**
 * Remove synthetic feed rows when a matching persisted notification already exists.
 */
export function suppressSyntheticFeedItems(
  syntheticItems: EmployeePortalFeedItem[],
  notifications: UserNotification[]
): EmployeePortalFeedItem[] {
  const keys = collectNotificationDedupeKeys(notifications)
  if (keys.size === 0) return syntheticItems

  return syntheticItems.filter((item) => {
    if (isUserNotificationFeedItem(item) || isCommsFeedItem(item)) return true
    const key = dedupeKeyFromFeedItem(item)
    if (!key) return true
    return !keys.has(key)
  })
}

/**
 * Drop persisted comms notifications when the live Comms feed item already exists
 * (same message id) to avoid duplicate timeline entries.
 */
export function dedupeNotificationFeedItemsAgainstComms(
  notificationItems: EmployeePortalFeedItem[],
  commsFeedItems: EmployeePortalFeedItem[]
): EmployeePortalFeedItem[] {
  const commsMessageIds = new Set(
    commsFeedItems
      .filter(isCommsFeedItem)
      .map((item) => item.id.slice('comms-'.length))
      .filter((id) => id.length > 0)
  )
  if (commsMessageIds.size === 0) return notificationItems

  return notificationItems.filter((item) => {
    if (!isUserNotificationFeedItem(item)) return true
    if (item.commsMessageId && commsMessageIds.has(item.commsMessageId)) return false
    return true
  })
}
