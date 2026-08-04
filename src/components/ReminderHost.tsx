import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { maybeSendDailyNudge, tickTimedReminders } from '@/lib/reminders'

/** Soft daily nudge + timed habit/event reminders while the app is open. */
export function ReminderHost() {
  const { user, profile } = useAuth()

  useEffect(() => {
    if (!user) return
    const prefs = profile?.preferences
    const run = () => {
      maybeSendDailyNudge(user.id, prefs)
      tickTimedReminders(user.id, prefs)
    }
    const initial = window.setTimeout(run, 1800)
    const interval = window.setInterval(run, 30_000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(interval)
    }
  }, [user, profile?.preferences])

  return <div className="sr-only" aria-live="polite" id="katana-reminders" />
}
