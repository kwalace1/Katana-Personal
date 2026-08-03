import { useCallback, useState } from 'react'
import {
  dismissFeedItem,
  dismissFeedItems,
  filterDismissedFeedItems,
} from '@/lib/employee-portal-dismissals'
import type { EmployeePortalFeedItem } from '@/lib/employee-portal-feed'

/**
 * React state wrapper around localStorage feed dismissals so lists re-render after dismiss.
 */
export function useFeedDismissals() {
  const [revision, setRevision] = useState(0)

  const dismiss = useCallback((id: string) => {
    dismissFeedItem(id)
    setRevision((value) => value + 1)
  }, [])

  const dismissMany = useCallback((ids: string[]) => {
    dismissFeedItems(ids)
    if (ids.length > 0) setRevision((value) => value + 1)
  }, [])

  const filterItems = useCallback(
    (items: EmployeePortalFeedItem[]) => {
      void revision
      return filterDismissedFeedItems(items)
    },
    [revision]
  )

  return { dismiss, dismissMany, filterItems, revision }
}
