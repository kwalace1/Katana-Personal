import { useEffect, useState } from 'react'
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
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadCount,
  type AppNotification,
} from '@/lib/social/notifications'
import { formatShortDate } from '@/lib/dates'
import { cn } from '@/lib/utils'

export function NotificationBell() {
  const { cloudUser } = useCloudAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<AppNotification[]>([])
  const [open, setOpen] = useState(false)

  async function refresh() {
    if (!cloudUser) return
    try {
      setItems(await listNotifications(cloudUser.uid))
    } catch {
      // index may still be building
    }
  }

  useEffect(() => {
    if (!cloudUser) {
      setItems([])
      return
    }
    void refresh()
    const t = window.setInterval(() => void refresh(), 45_000)
    return () => window.clearInterval(t)
  }, [cloudUser?.uid])

  if (!cloudUser) return null

  const unread = unreadCount(items)

  return (
    <DropdownMenu open={open} onOpenChange={(v) => { setOpen(v); if (v) void refresh() }}>
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
                void refresh()
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
                if (n.href) navigate(n.href)
                else void refresh()
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

/** Show a browser toast when tab is open and a new friend/share lands — best-effort. */
export function useNotificationToasts() {
  const { cloudUser } = useCloudAuth()
  useEffect(() => {
    if (!cloudUser) return
    let lastIds = new Set<string>()
    let primed = false
    const tick = async () => {
      try {
        const items = await listNotifications(cloudUser.uid, 10)
        const ids = new Set(items.map((i) => i.id))
        if (primed) {
          for (const item of items) {
            if (!item.read && !lastIds.has(item.id)) {
              toast(item.title, { description: item.body })
            }
          }
        }
        lastIds = ids
        primed = true
      } catch {
        // ignore
      }
    }
    void tick()
    const t = window.setInterval(() => void tick(), 30_000)
    return () => window.clearInterval(t)
  }, [cloudUser?.uid])
}
