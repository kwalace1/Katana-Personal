import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HardDriveDownload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { todayKey, addDays } from '@/lib/dates'

const DISMISS_KEY = 'katana-personal:backup-nudge-dismiss'
const FIRST_SEEN_KEY = 'katana-personal:first-open-day'
const CLOUD_TRANSFER_KEY = 'katana-personal:cloud-transfer-nudge'

/** Soft nudge: private-on-device needs a backup — sooner if cloud is signed in. */
export function BackupNudge() {
  const { user, profile } = useAuth()
  const { cloudUser } = useCloudAuth()
  const [show, setShow] = useState(false)
  const [how, setHow] = useState(false)

  useEffect(() => {
    if (!user) return
    if (!localStorage.getItem(FIRST_SEEN_KEY)) {
      localStorage.setItem(FIRST_SEEN_KEY, todayKey())
    }
    const first = localStorage.getItem(FIRST_SEEN_KEY) || todayKey()
    const dismiss = localStorage.getItem(DISMISS_KEY)
    if (dismiss === '1' || profile?.preferences?.backup_nudge_done) return

    // Cloud sign-in → show transfer tip immediately (once until dismissed)
    if (cloudUser && localStorage.getItem(CLOUD_TRANSFER_KEY) !== '1') {
      setShow(true)
      return
    }

    // Otherwise from day 3 onward
    const ready = todayKey() >= todayKey(addDays(new Date(first + 'T12:00:00'), 2))
    setShow(ready)
  }, [user, profile?.preferences, cloudUser])

  if (!show) return null

  const cloudMode = Boolean(cloudUser) && localStorage.getItem(CLOUD_TRANSFER_KEY) !== '1'

  return (
    <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-3 right-3 z-40 mx-auto max-w-md md:bottom-6 md:left-auto md:right-6">
      <div className="kp-surface flex items-start gap-3 border border-primary/20 p-4 shadow-lg">
        <HardDriveDownload className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {cloudMode ? 'Save a copy for another device' : 'Save a copy of your space'}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {cloudMode
              ? 'Signed into Cloud — personal data can sync across devices. Still save a file backup as a safety net (Settings → Save a copy).'
              : 'Your life stays on this device. Export a backup so a cleared browser — or your phone — can restore it.'}
          </p>
          {how ? (
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
              <li>Settings → Save a copy (share to Files / AirDrop on iPhone).</li>
              <li>Open Katana on the other device.</li>
              <li>Settings → Bring a copy back → pick the file.</li>
            </ol>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" className="min-h-11">
              <Link to="/settings/backup">Save a copy</Link>
            </Button>
            <Button size="sm" variant="outline" className="min-h-11" onClick={() => setHow((v) => !v)}>
              {how ? 'Hide steps' : 'How it works'}
            </Button>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-11 w-11 shrink-0"
          aria-label="Dismiss"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1')
            if (cloudUser) localStorage.setItem(CLOUD_TRANSFER_KEY, '1')
            setShow(false)
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
