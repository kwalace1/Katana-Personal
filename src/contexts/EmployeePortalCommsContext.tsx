import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useModuleAccess } from '@/contexts/ModuleAccessContext'
import { supabase } from '@/lib/supabase'
import {
  countUnreadCommsFeedItems,
  fetchCommsFeedItems,
} from '@/lib/employee-portal-comms'
import type { EmployeePortalFeedItem } from '@/lib/employee-portal-feed'

interface EmployeePortalCommsContextType {
  commsFeedItems: EmployeePortalFeedItem[]
  unreadCommsCount: number
  loading: boolean
  refreshComms: () => Promise<void>
  markCommsSeen: () => void
}

const EmployeePortalCommsContext = createContext<EmployeePortalCommsContextType | undefined>(
  undefined
)

export function EmployeePortalCommsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { hasModuleAccess } = useModuleAccess()
  const hasCommsAccess = hasModuleAccess('comms')
  const [commsFeedItems, setCommsFeedItems] = useState<EmployeePortalFeedItem[]>([])
  const [loading, setLoading] = useState(false)
  const refreshComms = useCallback(async () => {
    if (!user?.id || !hasCommsAccess) {
      setCommsFeedItems([])
      return
    }
    setLoading(true)
    try {
      setCommsFeedItems(await fetchCommsFeedItems())
    } catch (e) {
      console.error('Failed to load Comms for employee portal:', e)
      setCommsFeedItems([])
    } finally {
      setLoading(false)
    }
  }, [user?.id, hasCommsAccess])

  const markCommsSeen = useCallback(() => {
    // Prefer marking individual channels when opened; Keep a soft global clear for Launchpad.
    setCommsFeedItems((prev) => prev.map((item) => ({ ...item, unread: false })))
  }, [])

  useEffect(() => {
    void refreshComms()
  }, [refreshComms])

  useEffect(() => {
    const onFocus = () => {
      void refreshComms()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshComms])

  // Realtime: refresh when anyone posts a new Comms message
  useEffect(() => {
    if (!user?.id || !hasCommsAccess) return

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const channel = supabase
      .channel('employee-portal-comms')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comms_messages' },
        (payload) => {
          const msg = payload.new as { sender_id?: string }
          if (msg.sender_id === user.id) return
          if (debounceTimer) clearTimeout(debounceTimer)
          debounceTimer = setTimeout(() => {
            void refreshComms()
          }, 400)
        }
      )
      .subscribe()

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      void supabase.removeChannel(channel)
    }
  }, [user?.id, hasCommsAccess, refreshComms])

  const unreadCommsCount = useMemo(
    () => countUnreadCommsFeedItems(commsFeedItems),
    [commsFeedItems]
  )

  const value = useMemo(
    () => ({
      commsFeedItems,
      unreadCommsCount,
      loading,
      refreshComms,
      markCommsSeen,
    }),
    [commsFeedItems, unreadCommsCount, loading, refreshComms, markCommsSeen]
  )

  return (
    <EmployeePortalCommsContext.Provider value={value}>
      {children}
    </EmployeePortalCommsContext.Provider>
  )
}

export function useEmployeePortalComms(): EmployeePortalCommsContextType {
  const ctx = useContext(EmployeePortalCommsContext)
  if (!ctx) {
    return {
      commsFeedItems: [],
      unreadCommsCount: 0,
      loading: false,
      refreshComms: async () => {},
      markCommsSeen: () => {},
    }
  }
  return ctx
}
