import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { buildOrchestrationNudge } from '@/lib/notifications/orchestration-nudge'
import {
  canNotifyNow,
  dayClosedToday,
  orchestrationPushEnabled,
} from '@/lib/notifications/preferences'
import { pushConfigured, schedulePushNudge } from '@/lib/notifications/push'
import { canUsePlusFeature } from '@/lib/plus'

const SYNC_MS = 5 * 60_000

/** Sync next orchestration nudge to server so cron can deliver when the PWA is closed. */
export function PushScheduleHost() {
  const { user, profile } = useAuth()
  const { cloudUser } = useCloudAuth()

  useEffect(() => {
    if (!user || !cloudUser || !pushConfigured()) return
    const prefs = profile?.preferences
    if (!orchestrationPushEnabled(prefs) || !canUsePlusFeature('orchestration_push')) return

    let cancelled = false

    const sync = async () => {
      if (cancelled || !canNotifyNow(prefs)) return
      const dayClosed = dayClosedToday(prefs)
      const nudge = buildOrchestrationNudge(user.id, {
        displayName: profile?.display_name,
        preferences: prefs,
        dayClosed,
      })
      if (!nudge) return

      const fireAt = new Date(Date.now() + 15 * 60_000).toISOString()
      await schedulePushNudge({
        fire_at: fireAt,
        kind: 'orchestration',
        title: nudge.title,
        body: nudge.body,
        href: nudge.href,
        tag: nudge.tag,
      })
    }

    void sync()
    const interval = window.setInterval(() => void sync(), SYNC_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [user, cloudUser, profile?.preferences, profile?.display_name])

  return null
}
