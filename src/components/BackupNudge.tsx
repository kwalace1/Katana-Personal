import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HardDriveDownload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { todayKey, addDays } from '@/lib/dates'

const DISMISS_KEY = 'katana-personal:backup-nudge-dismiss'
const FIRST_SEEN_KEY = 'katana-personal:first-open-day'

/** Soft nudge after a few days: private-on-device needs a backup. */
export function BackupNudge() {
  const { user, profile } = useAuth()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!user) return
    if (!localStorage.getItem(FIRST_SEEN_KEY)) {
      localStorage.setItem(FIRST_SEEN_KEY, todayKey())
    }
    const first = localStorage.getItem(FIRST_SEEN_KEY) || todayKey()
    const dismiss = localStorage.getItem(DISMISS_KEY)
    if (dismiss === '1' || profile?.preferences?.backup_nudge_done) return
    // Show from day 3 onward
    const ready = todayKey() >= todayKey(addDays(new Date(first + 'T12:00:00'), 2))
    setShow(ready)
  }, [user, profile?.preferences])

  if (!show) return null

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 right-4 z-40 mx-auto max-w-md md:bottom-6 md:left-auto md:right-6">
      <div className="kp-surface flex items-start gap-3 border border-primary/20 p-4 shadow-lg">
        <HardDriveDownload className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Save a copy of your space</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Your life stays on this device. Export a backup so a cleared browser doesn’t lose it.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link to="/settings">Open Settings</Link>
          </Button>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0"
          aria-label="Dismiss"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1')
            setShow(false)
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
