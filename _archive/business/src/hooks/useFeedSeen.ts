import { useCallback, useState } from 'react'
import { markFeedItemSeen, markFeedItemsSeen } from '@/lib/employee-portal-feed-seen'

/** React state wrapper so the feed re-splits after items are marked seen. */
export function useFeedSeen() {
  const [revision, setRevision] = useState(0)

  const markSeen = useCallback((id: string) => {
    markFeedItemSeen(id)
    setRevision((value) => value + 1)
  }, [])

  const markManySeen = useCallback((ids: string[]) => {
    markFeedItemsSeen(ids)
    if (ids.length > 0) setRevision((value) => value + 1)
  }, [])

  return { markSeen, markManySeen, revision }
}
