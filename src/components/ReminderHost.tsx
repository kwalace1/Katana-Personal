import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { maybeSendDailyNudge } from '@/lib/reminders'

/** Runs once when the workspace is open — soft daily nudge if enabled. */
export function ReminderHost() {
  const { user, profile } = useAuth()

  useEffect(() => {
    if (!user) return
    const t = window.setTimeout(() => {
      maybeSendDailyNudge(user.id, profile?.preferences)
    }, 1800)
    return () => window.clearTimeout(t)
  }, [user, profile?.preferences])

  return <div className="sr-only" aria-live="polite" id="katana-reminders" />
}
