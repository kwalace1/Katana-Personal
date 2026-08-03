import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Eye, ArrowRight, ChevronDown } from 'lucide-react'
import { useEmployeePortalComms } from '@/contexts/EmployeePortalCommsContext'
import { useNotifications } from '@/contexts/NotificationContext'
import { engageFeedItem } from '@/lib/employee-portal-feed-engagement'
import { splitFeedIntoNewAndEarlier } from '@/lib/employee-portal-feed-sections'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  EMPLOYEE_FEED_PAGE_SIZE,
  type EmployeeFeedDisplayMode,
  type EmployeePortalFeedItem,
} from '@/lib/employee-portal-feed'
import { FeedItemIcon } from '@/components/employee/FeedItemIcon'
import { EmployeePortalFeedQuickView } from '@/components/employee/EmployeePortalFeedQuickView'
import { EmployeePortalFeedCaughtUp } from '@/components/employee/EmployeePortalFeedCaughtUp'
import { EmployeePortalFeedHistoryEmpty } from '@/components/employee/EmployeePortalFeedHistoryEmpty'

interface EmployeePortalFeedListProps {
  items: EmployeePortalFeedItem[]
  displayMode: EmployeeFeedDisplayMode
  historyCount?: number
  onShowHistory?: () => void
  onShowActive?: () => void
  pageSize?: number
  onDismissSynthetic?: (feedItemId: string) => void
  onMarkSeen?: (feedItemId: string) => void
  seenRevision?: number
}

interface FeedListItemProps {
  item: EmployeePortalFeedItem
  isNewSection?: boolean
  onOpenQuickView: (item: EmployeePortalFeedItem) => void
  onEngageItem: (item: EmployeePortalFeedItem) => void
}

function FeedListItem({
  item,
  isNewSection = false,
  onOpenQuickView,
  onEngageItem,
}: FeedListItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`employee-portal-card flex gap-3 p-4 rounded-xl border shadow-sm hover:shadow transition-shadow cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isNewSection ? 'border-primary/40 bg-primary/10' : ''
      }`}
      onClick={() => onOpenQuickView(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenQuickView(item)
        }
      }}
    >
      <div className="shrink-0">
        <FeedItemIcon kind={item.iconKind} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-foreground">{item.title}</span>
          {item.urgencyLabel && (
            <Badge
              variant={
                item.urgencyLabel === 'High priority' ||
                item.urgencyLabel === 'Overdue' ||
                item.urgencyLabel === 'Due today'
                  ? 'destructive'
                  : item.urgencyLabel === 'Unread message' ||
                      item.urgencyLabel === 'Awaiting approval'
                    ? 'default'
                    : 'secondary'
              }
              className="text-xs shrink-0"
            >
              {item.urgencyLabel}
            </Badge>
          )}
          {isNewSection && !item.urgencyLabel && (
            <Badge variant="default" className="text-xs shrink-0">
              New
            </Badge>
          )}
          {item.meta && (
            <Badge variant="outline" className="text-xs">
              {item.meta}
            </Badge>
          )}
          <Badge
            variant={item.scope === 'for_you' ? 'secondary' : 'outline'}
            className="text-xs"
          >
            {item.scope === 'for_you' ? 'For you' : 'Company'}
          </Badge>
        </div>
        {item.subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{item.subtitle}</p>
        )}
        {item.time && <p className="text-xs text-muted-foreground mt-1">{item.time}</p>}
        <div className="flex flex-wrap gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8"
            onClick={() => onOpenQuickView(item)}
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Quick view
          </Button>
          {item.link && (
            <Button type="button" size="sm" variant="outline" className="h-8" asChild>
              <Link to={item.link} onClick={() => onEngageItem(item)}>
                {item.id.startsWith('comms-') ? 'Open in Comms' : 'Open module'}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function EmployeePortalFeedList({
  items,
  displayMode,
  historyCount = 0,
  onShowHistory,
  onShowActive,
  pageSize = EMPLOYEE_FEED_PAGE_SIZE,
  onDismissSynthetic,
  onMarkSeen,
  seenRevision = 0,
}: EmployeePortalFeedListProps) {
  const { markCommsSeen } = useEmployeePortalComms()
  const { markRead } = useNotifications()
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const [quickViewItem, setQuickViewItem] = useState<EmployeePortalFeedItem | null>(null)

  const { newItems, earlierItems } = useMemo(() => {
    void seenRevision
    return splitFeedIntoNewAndEarlier(items)
  }, [items, seenRevision])

  const visibleItems = displayMode === 'active' ? newItems : earlierItems
  const pagedItems = visibleItems.slice(0, visibleCount)
  const hasMore = visibleCount < visibleItems.length
  const remaining = visibleItems.length - visibleCount

  const engageItem = useCallback(
    (item: EmployeePortalFeedItem) => {
      engageFeedItem(item, {
        markRead,
        markCommsSeen,
        dismissSynthetic: onDismissSynthetic,
        markSeen: onMarkSeen,
      })
    },
    [markRead, markCommsSeen, onDismissSynthetic, onMarkSeen]
  )

  const openQuickView = useCallback(
    (item: EmployeePortalFeedItem) => {
      engageItem(item)
      setQuickViewItem(item)
    },
    [engageItem]
  )

  useEffect(() => {
    setVisibleCount(pageSize)
  }, [items, pageSize, seenRevision, displayMode])

  if (displayMode === 'active' && newItems.length === 0) {
    return (
      <EmployeePortalFeedCaughtUp
        historyCount={historyCount}
        onShowHistory={() => onShowHistory?.()}
      />
    )
  }

  if (displayMode === 'history' && earlierItems.length === 0) {
    return <EmployeePortalFeedHistoryEmpty onShowActive={() => onShowActive?.()} />
  }

  return (
    <>
      {displayMode === 'history' && onShowActive && (
        <div className="px-1">
          <Button type="button" variant="ghost" size="sm" className="h-8 -ml-2" onClick={onShowActive}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to inbox
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground px-1">
        {displayMode === 'active' ? (
          <>
            {newItems.length} new · showing {pagedItems.length} of {newItems.length}
          </>
        ) : (
          <>
            Showing {pagedItems.length} of {earlierItems.length} past items
          </>
        )}
      </p>

      <div className="space-y-3">
        {pagedItems.map((item) => (
          <FeedListItem
            key={item.id}
            item={item}
            isNewSection={displayMode === 'active'}
            onOpenQuickView={openQuickView}
            onEngageItem={engageItem}
          />
        ))}
      </div>

      {hasMore && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setVisibleCount((n) => Math.min(n + pageSize, visibleItems.length))}
          >
            <ChevronDown className="mr-2 h-4 w-4" />
            Show next {Math.min(pageSize, remaining)}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setVisibleCount(visibleItems.length)}
          >
            Show all {visibleItems.length} items
          </Button>
        </div>
      )}

      <EmployeePortalFeedQuickView
        item={quickViewItem}
        open={quickViewItem != null}
        onOpenChange={(open) => {
          if (!open) setQuickViewItem(null)
        }}
        onDismissSynthetic={onDismissSynthetic}
        onMarkSeen={onMarkSeen}
      />
    </>
  )
}
