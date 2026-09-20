import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { useAuth } from '@/contexts/AuthContext'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
  unreadCount,
  type AppNotification,
} from '@/lib/social/notifications'
import { socialPushEnabled } from '@/lib/notifications/preferences'
import { formatShortDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { showLocalNotification } from '@/lib/web-notify'

const POLL_MS = 3000

function useLiveNotifications(uid: string | undefined) {
  const [items, setItems] = useState<AppNotification[]>([])

  useEffect(() => {
    if (!uid) {
      setItems([])
      return
    }
    const userId = uid

    void listNotifications(userId).then(setItems).catch(() => {})

    const unsub = subscribeNotifications(userId, setItems)

    const poll = window.setInterval(() => {
      void listNotifications(userId).then(setItems).catch(() => {})
    }, POLL_MS)

    function onVisible() {
      if (document.visibilityState === 'visible') {
        void listNotifications(userId).then(setItems).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      unsub()
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [uid])

  return [items, setItems] as const
}

export function NotificationBell() {
  const { cloudUser } = useCloudAuth()
  const navigate = useNavigate()
  const [items, setItems] = useLiveNotifications(cloudUser?.uid)
  const [open, setOpen] = useState(false)

  if (!cloudUser) return null

  const unread = unreadCount(items)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-xl" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.6rem] font-semibold text-primary-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unread > 0 ? (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={async () => {
                await markAllNotificationsRead(cloudUser.uid)
                setItems((prev) => prev.map((n) => ({ ...n, read: true })))
              }}
            >
              Mark all read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">You’re all caught up.</p>
        ) : (
          items.slice(0, 12).map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={cn('flex cursor-pointer flex-col items-start gap-0.5 py-2.5', !n.read && 'bg-accent/40')}
              onClick={async () => {
                await markNotificationRead(n.id)
                setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
                const href =
                  n.href ||
                  (n.kind === 'circle_invite' || n.kind === 'friend_request'
                    ? '/social?tab=friends#invites'
                    : n.kind === 'circle_joined' || n.kind === 'circle_post'
                      ? '/circles'
                      : n.kind === 'post_like' ||
                          n.kind === 'post_comment' ||
                          n.kind === 'post_repost' ||
                          n.kind === 'post_mention' ||
                          n.kind === 'post_new' ||
                          n.kind === 'comment_like' ||
                          n.kind === 'comment_reply'
                        ? '/social'
                        : '/social?tab=friends')
                navigate(href)
              }}
            >
              <span className="text-sm font-medium">{n.title}</span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
              <span className="text-[0.65rem] text-muted-foreground">{formatShortDate(n.createdAt)}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Toast + device banner when a new notification arrives via realtime / poll. */
export function useNotificationToasts() {
  const { cloudUser } = useCloudAuth()
  const { profile } = useAuth()
  const primed = useRef(false)
  const lastIds = useRef(new Set<string>())
  const socialOn = socialPushEnabled(profile?.preferences)

  useEffect(() => {
    if (!cloudUser) return
    primed.current = false
    lastIds.current = new Set()

    function consider(items: AppNotification[]) {
      if (primed.current) {
        for (const item of items) {
          if (!item.read && !lastIds.current.has(item.id)) {
            toast(item.title, { description: item.body })
            if (socialOn) {
              void showLocalNotification(
                item.title,
                item.body,
                `social-${item.id}`,
                item.href || '/social',
              )
            }
          }
        }
      }
      lastIds.current = new Set(items.map((i) => i.id))
      primed.current = true
    }

    const unsub = subscribeNotifications(cloudUser.uid, consider, 10)
    const poll = window.setInterval(() => {
      void listNotifications(cloudUser.uid, 10).then(consider).catch(() => {})
    }, POLL_MS)

    return () => {
      unsub()
      window.clearInterval(poll)
    }
  }, [cloudUser?.uid, socialOn])
}
