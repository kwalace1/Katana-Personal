import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Message } from '@/lib/comms-api'
import * as CommsApi from '@/lib/comms-api'
import {
  areNotificationsAvailable,
  fetchUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToUserNotifications,
  type UserNotification,
} from '@/lib/notifications-api'
import {
  buildCommsToastPayload,
  commsNotificationDedupeKey,
  enrichCommsMessageForDisplay,
  isCurrentUserCommsRecipient,
  recordCommsNotificationForCurrentUser,
} from '@/lib/notification-comms'
import {
  countUnreadNotifications,
  notificationModuleLabel,
  sortNotificationsNewestFirst,
} from '@/lib/notifications-present'

interface NotificationContextType {
  notifications: UserNotification[]
  unreadCount: number
  loading: boolean
  refresh: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  openNotification: (notification: UserNotification) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

function isViewingCommsTarget(
  pathname: string,
  search: string,
  message: Pick<Message, 'channel_id' | 'conversation_id'>
): boolean {
  if (!pathname.startsWith('/comms')) return false
  const params = new URLSearchParams(search)
  if (message.channel_id && params.get('channel') === message.channel_id) return true
  if (message.conversation_id && params.get('conversation') === message.conversation_id) {
    return true
  }
  return false
}

function liveAlertKeyForNotification(notification: UserNotification): string {
  const meta = notification.metadata ?? {}
  const messageId = typeof meta.message_id === 'string' ? meta.message_id : null
  if (messageId) return commsNotificationDedupeKey(messageId)
  const dedupe = typeof meta.dedupe_key === 'string' ? meta.dedupe_key : null
  if (dedupe) return dedupe
  return notification.id
}

function showLiveToast(
  title: string,
  body: string | null | undefined,
  moduleLabel: string,
  onOpen: () => void
): void {
  toast(title, {
    description: body ? `${moduleLabel} · ${body}` : moduleLabel,
    duration: 8000,
    position: 'top-right',
    action: {
      label: 'View',
      onClick: onOpen,
    },
  })
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [loading, setLoading] = useState(false)
  const liveAlertDedupeRef = useRef<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setNotifications([])
      return
    }
    setLoading(true)
    try {
      const items = await fetchUserNotifications({ limit: 80 })
      setNotifications(sortNotificationsNewestFirst(items))
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id)
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n
      )
    )
  }, [])

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead()
    const now = new Date().toISOString()
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })))
  }, [])

  const openNotification = useCallback(
    (notification: UserNotification) => {
      void markRead(notification.id)
      if (notification.link_path) {
        navigate(notification.link_path)
      }
    },
    [markRead, navigate]
  )

  const showLiveAlertOnce = useCallback(
    (dedupeKey: string, title: string, body: string | null | undefined, moduleLabel: string, onOpen: () => void) => {
      if (liveAlertDedupeRef.current.has(dedupeKey)) return
      liveAlertDedupeRef.current.add(dedupeKey)
      showLiveToast(title, body, moduleLabel, onOpen)
    },
    []
  )

  const processIncomingCommsMessage = useCallback(
    async (rawMessage: Message) => {
      if (!user?.id || rawMessage.sender_id === user.id) return
      if (isViewingCommsTarget(location.pathname, location.search, rawMessage)) return

      const isRecipient = await isCurrentUserCommsRecipient(user.id, rawMessage)
      if (!isRecipient) return

      const message = await enrichCommsMessageForDisplay(rawMessage)
      const dedupeKey = commsNotificationDedupeKey(message.id)

      let channelName: string | null = null
      let contextLinkPath: string | null = null
      if (message.channel_id) {
        const { data } = await supabase
          .from('comms_channels')
          .select('name, description')
          .eq('id', message.channel_id)
          .single()
        channelName = data?.name ?? null
        const parsed = CommsApi.parseContextChannelMarker(data?.description ?? null)
        if (parsed) {
          contextLinkPath = CommsApi.contextRecordPath(parsed.contextType, parsed.contextId)
        }
      }

      const { title, body, linkPath } = buildCommsToastPayload(
        message,
        channelName,
        contextLinkPath
      )
      showLiveAlertOnce(dedupeKey, title, body, 'Katana Comms', () => navigate(linkPath))

      void recordCommsNotificationForCurrentUser(message)
    },
    [user?.id, location.pathname, location.search, navigate, showLiveAlertOnce]
  )

  const handleIncomingNotification = useCallback(
    (notification: UserNotification) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notification.id)) return prev
        return sortNotificationsNewestFirst([notification, ...prev])
      })

      const dedupeKey = liveAlertKeyForNotification(notification)
      const moduleLabel = notificationModuleLabel(notification.source_module)
      showLiveAlertOnce(dedupeKey, notification.title, notification.body, moduleLabel, () =>
        openNotification(notification)
      )
    },
    [openNotification, showLiveAlertOnce]
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onFocus = () => {
      void refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  // Persisted notifications (bell list + backup toast via dedupe)
  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) return
    return subscribeToUserNotifications(user.id, handleIncomingNotification)
  }, [user?.id, handleIncomingNotification])

  // Always listen for new comms messages — primary live toast path on every page (Hub, PM, etc.)
  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) return

    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const channel = supabase
      .channel(`global-comms-live-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comms_messages' },
        (payload) => {
          const msg = payload.new as Message
          if (msg.sender_id === user.id) return

          if (debounceTimer) clearTimeout(debounceTimer)
          debounceTimer = setTimeout(() => {
            void processIncomingCommsMessage(msg)
          }, 200)
        }
      )
      .subscribe((status) => {
        if (import.meta.env.DEV && status === 'CHANNEL_ERROR') {
          console.warn('[notifications] comms realtime subscription error')
        }
      })

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      void supabase.removeChannel(channel)
    }
  }, [user?.id, processIncomingCommsMessage])

  const unreadCount = useMemo(() => countUnreadNotifications(notifications), [notifications])

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      refresh,
      markRead,
      markAllRead,
      openNotification,
    }),
    [notifications, unreadCount, loading, refresh, markRead, markAllRead, openNotification]
  )

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  )
}

export function useNotifications(): NotificationContextType {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return ctx
}
