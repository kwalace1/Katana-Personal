import { useEffect, useState } from 'react'
import { X, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isNativeShell } from '@/lib/native/platform'
import { isWebAppLocked } from '@/lib/web-app-lock'

const DISMISS_KEY = 'katana-personal:pwa-nudge-dismiss'
const OFFER_KEY = 'katana-personal:pwa-nudge-offer'

function isStandaloneApp() {
  if (typeof window === 'undefined') return false
  if (isNativeShell()) return true
  const mq = window.matchMedia('(display-mode: standalone)').matches
  const ios = 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return mq || ios
}

/** Offer after evening close — once — if not already installed as PWA. */
export function offerPwaNudge() {
  if (typeof window === 'undefined') return
  if (isWebAppLocked()) return
  if (isStandaloneApp()) return
  if (localStorage.getItem(DISMISS_KEY) === '1') return
  localStorage.setItem(OFFER_KEY, '1')
  window.dispatchEvent(new Event('katana:pwa-nudge'))
}

export function PwaInstallNudge() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    function sync() {
      if (isWebAppLocked() || isStandaloneApp()) {
        setShow(false)
        return
      }
      if (localStorage.getItem(DISMISS_KEY) === '1') {
        setShow(false)
        return
      }
      setShow(localStorage.getItem(OFFER_KEY) === '1')
    }
    sync()
    window.addEventListener('katana:pwa-nudge', sync)
    return () => window.removeEventListener('katana:pwa-nudge', sync)
  }, [])

  if (!show) return null

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)

  return (
    <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-3 right-3 z-40 mx-auto max-w-md md:bottom-6 md:left-auto md:right-6">
      <div className="kp-surface flex items-start gap-3 border border-primary/20 p-4 shadow-lg">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Add Katana to your Home Screen</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {isIos
              ? 'In Safari: Share → Add to Home Screen. Opens like an app, private on this phone.'
              : 'Use your browser menu → Install app / Add to Home Screen for a calmer, full-screen space.'}
          </p>
          <Button
            size="sm"
            className="mt-3 min-h-11"
            onClick={() => {
              localStorage.setItem(DISMISS_KEY, '1')
              localStorage.removeItem(OFFER_KEY)
              setShow(false)
            }}
          >
            Got it
          </Button>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-11 w-11 shrink-0"
          aria-label="Dismiss"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1')
            localStorage.removeItem(OFFER_KEY)
            setShow(false)
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
