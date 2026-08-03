import { notificationIdFromFeedItem } from '@/lib/employee-portal-notifications'
import { isDismissibleSyntheticFeedItem } from '@/lib/employee-portal-dismissals'
import type { EmployeePortalFeedItem } from '@/lib/employee-portal-feed'

export interface FeedEngagementHandlers {
  markRead: (notificationId: string) => void | Promise<void>
  markCommsSeen: () => void
  dismissSynthetic?: (feedItemId: string) => void
  markSeen?: (feedItemId: string) => void
}

/** Mark a feed row as seen when the user opens quick view or follows its link. */
export function engageFeedItem(
  item: EmployeePortalFeedItem,
  handlers: FeedEngagementHandlers
): void {
  handlers.markSeen?.(item.id)

  if (item.id.startsWith('comms-')) {
    handlers.markCommsSeen()
    return
  }

  const notificationId = notificationIdFromFeedItem(item)
  if (notificationId) {
    void handlers.markRead(notificationId)
    return
  }

  if (isDismissibleSyntheticFeedItem(item) && handlers.dismissSynthetic) {
    handlers.dismissSynthetic(item.id)
  }
}
