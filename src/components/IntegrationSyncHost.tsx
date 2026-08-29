import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { syncIntegrationsIfStale } from '@/lib/integrations/sync-all'
import { broadcastLocalRefresh } from '@/hooks/useLocalRefresh'

/** Background sync for connected calendars — keeps Today/Ask schedule current. */
export function IntegrationSyncHost() {
  const { user } = useAuth()
  const ran = useRef(false)

  useEffect(() => {
    if (!user?.id || ran.current) return
    ran.current = true
    void syncIntegrationsIfStale(user.id).then(({ synced }) => {
      if (synced > 0) broadcastLocalRefresh()
    })
  }, [user?.id])

  return null
}
