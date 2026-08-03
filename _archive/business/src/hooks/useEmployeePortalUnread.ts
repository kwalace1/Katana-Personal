import { useMemo } from 'react'
import { useNotifications } from '@/contexts/NotificationContext'
import { useEmployeePortalComms } from '@/contexts/EmployeePortalCommsContext'
import {
  computePortalUnread,
  type PortalUnreadSnapshot,
} from '@/lib/employee-portal-unread'
import type { EmployeePortalFeedItem } from '@/lib/employee-portal-feed'

/**
 * Unified unread count for launchpad links, portal nav, and notification badges.
 * Sums persisted notifications + Comms (deduped at feed merge). Optionally includes
 * countable synthetic feed items when `allFeedItems` is provided (portal feed page).
 */
export function useEmployeePortalUnread(
  allFeedItems?: EmployeePortalFeedItem[]
): PortalUnreadSnapshot & { hasUnread: boolean } {
  const { unreadCount: persistedUnreadCount } = useNotifications()
  const { unreadCommsCount } = useEmployeePortalComms()

  return useMemo(() => {
    const snapshot = computePortalUnread({
      persistedUnreadCount,
      commsUnreadCount: unreadCommsCount,
      allFeedItems,
    })
    return {
      ...snapshot,
      hasUnread: snapshot.total > 0,
    }
  }, [persistedUnreadCount, unreadCommsCount, allFeedItems])
}
