import { readSeenFeedItemIds } from '@/lib/employee-portal-feed-seen'
import type { EmployeePortalFeedItem } from '@/lib/employee-portal-feed'

export interface FeedNewAndEarlierSplit {
  newItems: EmployeePortalFeedItem[]
  earlierItems: EmployeePortalFeedItem[]
  showCaughtUpDivider: boolean
}

/** Items the user has not read or opened yet (social-style "new" row). */
export function isNewFeedItem(
  item: EmployeePortalFeedItem,
  seenIds: Set<string> = readSeenFeedItemIds()
): boolean {
  if (item.unread) return true
  if (item.scope !== 'for_you') return false
  return !seenIds.has(item.id)
}

export function splitFeedIntoNewAndEarlier(
  items: EmployeePortalFeedItem[],
  seenIds: Set<string> = readSeenFeedItemIds()
): FeedNewAndEarlierSplit {
  const newItems: EmployeePortalFeedItem[] = []
  const earlierItems: EmployeePortalFeedItem[] = []

  for (const item of items) {
    if (isNewFeedItem(item, seenIds)) {
      newItems.push(item)
    } else {
      earlierItems.push(item)
    }
  }

  return {
    newItems,
    earlierItems,
    showCaughtUpDivider: newItems.length > 0 && earlierItems.length > 0,
  }
}

export function listNewFeedItemIds(items: EmployeePortalFeedItem[]): string[] {
  const seenIds = readSeenFeedItemIds()
  return items.filter((item) => isNewFeedItem(item, seenIds)).map((item) => item.id)
}

export function countNewFeedItems(
  items: EmployeePortalFeedItem[],
  seenIds: Set<string> = readSeenFeedItemIds()
): number {
  return items.filter((item) => isNewFeedItem(item, seenIds)).length
}

export function countHistoryFeedItems(
  items: EmployeePortalFeedItem[],
  seenIds: Set<string> = readSeenFeedItemIds()
): number {
  return items.length - countNewFeedItems(items, seenIds)
}

/** Items visible in the active inbox or history view. */
export function filterFeedItemsByDisplayMode(
  items: EmployeePortalFeedItem[],
  mode: 'active' | 'history',
  seenIds: Set<string> = readSeenFeedItemIds()
): EmployeePortalFeedItem[] {
  if (mode === 'active') {
    return items.filter((item) => isNewFeedItem(item, seenIds))
  }
  return items.filter((item) => !isNewFeedItem(item, seenIds))
}
