import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useNotifications } from '@/contexts/NotificationContext'
import { useEmployeePortalUnread } from '@/hooks/useEmployeePortalUnread'
import { EmployeePortalUnreadBadge } from '@/components/employee/EmployeePortalUnreadBadge'
import {
  formatNotificationTime,
  isNotificationUnread,
  notificationModuleLabel,
} from '@/lib/notifications-present'
import type { UserNotification } from '@/lib/notifications-api'

interface NotificationCenterProps {
  /** Compact styling for employee portal nav */
  variant?: 'header' | 'portal'
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: UserNotification
  onOpen: () => void
}) {
  const unread = isNotificationUnread(notification)
  const moduleLabel = notificationModuleLabel(notification.source_module)

  return (
    <DropdownMenuItem
      className="flex cursor-pointer flex-col items-start gap-1 py-3 focus:bg-muted"
      onSelect={(e) => {
        e.preventDefault()
        onOpen()
      }}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className={`text-sm leading-snug ${unread ? 'font-semibold' : 'font-medium'}`}>
          {notification.title}
        </span>
        {unread && (
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
        )}
      </div>
      {notification.body && (
        <span className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</span>
      )}
      <span className="text-[11px] text-muted-foreground">
        {moduleLabel} · {formatNotificationTime(notification.created_at)}
      </span>
    </DropdownMenuItem>
  )
}

export function NotificationCenter({ variant = 'header' }: NotificationCenterProps) {
  const navigate = useNavigate()
  const { notifications, loading, markAllRead, openNotification, refresh } = useNotifications()
  const { total: unreadAttentionCount } = useEmployeePortalUnread()

  const triggerClass =
    variant === 'portal'
      ? 'relative h-9 w-9 shrink-0'
      : 'relative h-8 w-8'

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void refresh()
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={triggerClass}
          title={
            unreadAttentionCount > 0
              ? `${unreadAttentionCount} items need your attention`
              : 'Notifications'
          }
          aria-label={
            unreadAttentionCount > 0
              ? `Notifications, ${unreadAttentionCount} need attention`
              : 'Notifications'
          }
        >
          <Bell className="h-4 w-4" />
          <EmployeePortalUnreadBadge
            count={unreadAttentionCount}
            className="absolute -right-0.5 -top-0.5"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-80 max-h-[min(24rem,70vh)] overflow-y-auto"
        align="end"
        forceMount
      >
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Notifications</span>
          {unreadAttentionCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                void markAllRead()
              }}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            You&apos;re all caught up. New messages, assignments, and updates will appear here.
          </p>
        ) : (
          notifications.slice(0, 25).map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onOpen={() => openNotification(n)}
            />
          ))
        )}
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer justify-center text-sm font-medium"
              onSelect={() => navigate('/employee')}
            >
              Open Employee Portal
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer justify-center text-sm text-muted-foreground"
              onSelect={() => navigate('/hub')}
            >
              Open Hub
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
