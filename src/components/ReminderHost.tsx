import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { maybeSendDailyNudge, maybeSendOrchestrationNudge, tickTimedReminders } from '@/lib/reminders'

/** Habit + event reminders: catch up on open, then keep ticking while the PWA is alive. */
export function ReminderHost() {
  const { user, profile } = useAuth()

  useEffect(() => {
    if (!user) return
    const prefs = profile?.preferences
    let cancelled = false

    const run = () => {
      if (cancelled) return
      void maybeSendDailyNudge(user.id, prefs)
      void tickTimedReminders(user.id, prefs)
      void maybeSendOrchestrationNudge(
        user.id,
        prefs,
        profile?.display_name,
        prefs?.day_closed_on === new Date().toISOString().slice(0, 10),
      )
    }

    run()
    const interval = window.setInterval(run, 20_000)
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.ready.then(() => {
        if (!cancelled) run()
      })
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    const onShow = () => run()

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onShow)
    window.addEventListener('focus', onShow)
    window.addEventListener('online', onShow)
    document.addEventListener('resume', onShow)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onShow)
      window.removeEventListener('focus', onShow)
      window.removeEventListener('online', onShow)
      document.removeEventListener('resume', onShow)
    }
  }, [user, profile?.preferences, profile?.display_name])

  return <div className="sr-only" aria-live="polite" id="katana-reminders" />
}
