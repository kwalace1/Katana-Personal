import { useEffect, useRef, useState } from 'react'
import { CloudSun, MapPin, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  fetchWeatherSnapshot,
  formatTemp,
  queryGeolocationPermission,
  readWeatherCache,
  type WeatherSnapshot,
} from '@/lib/weather/open-meteo'

type Props = {
  /** Compact strip for Today; fuller card for cardio / outdoor. */
  variant?: 'today' | 'cardio'
  className?: string
}

type Phase = 'loading' | 'ready' | 'error'

/**
 * Auto-pull location on first visit. iOS PWAs often drop the first
 * getCurrentPosition callback after Allow — we hard-timeout and retry when
 * the app becomes visible/focused again so testers don’t need a full refresh.
 */
export function WeatherGlance({ variant = 'today', className }: Props) {
  const [snap, setSnap] = useState<WeatherSnapshot | null>(() => readWeatherCache())
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>(() => (readWeatherCache() ? 'ready' : 'loading'))
  const inFlight = useRef(false)
  const deniedRef = useRef(false)
  const hasSnap = useRef(Boolean(readWeatherCache()))

  async function load(force = false) {
    if (inFlight.current) return
    if (deniedRef.current && !force) return
    inFlight.current = true
    setPhase('loading')
    setError(null)
    try {
      const next = await fetchWeatherSnapshot(force)
      hasSnap.current = true
      deniedRef.current = false
      setSnap(next)
      setPhase('ready')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Couldn’t load weather'
      const denied = /denied|permission/i.test(msg)
      deniedRef.current = denied
      if (!hasSnap.current) {
        setSnap(null)
        setError(msg)
        setPhase('error')
      }
    } finally {
      inFlight.current = false
    }
  }

  useEffect(() => {
    let cancelled = false

    async function boot() {
      const cached = readWeatherCache()
      if (cached) {
        if (!cancelled) {
          hasSnap.current = true
          setSnap(cached)
          setPhase('ready')
        }
        return
      }

      const permission = await queryGeolocationPermission()
      if (cancelled) return
      if (permission === 'denied') {
        deniedRef.current = true
        setError('Location permission denied')
        setPhase('error')
        return
      }

      // First open: request location immediately (shows system Allow dialog).
      await load(false)
    }

    void boot()

    function retryAfterPrompt() {
      if (cancelled || deniedRef.current || hasSnap.current || inFlight.current) return
      void load(true)
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') retryAfterPrompt()
    }

    window.addEventListener('focus', retryAfterPrompt)
    window.addEventListener('pageshow', retryAfterPrompt)
    document.addEventListener('visibilitychange', onVisibility)

    let permissionStatus: PermissionStatus | null = null
    void (async () => {
      try {
        if (!navigator.permissions?.query) return
        permissionStatus = await navigator.permissions.query({ name: 'geolocation' })
        permissionStatus.onchange = () => {
          if (permissionStatus?.state === 'granted') retryAfterPrompt()
          if (permissionStatus?.state === 'denied') {
            deniedRef.current = true
            if (!hasSnap.current) {
              setError('Location permission denied')
              setPhase('error')
            }
          }
        }
      } catch {
        // Safari may not support this.
      }
    })()

    return () => {
      cancelled = true
      window.removeEventListener('focus', retryAfterPrompt)
      window.removeEventListener('pageshow', retryAfterPrompt)
      document.removeEventListener('visibilitychange', onVisibility)
      if (permissionStatus) permissionStatus.onchange = null
    }
  }, [])

  const denied =
    Boolean(error?.toLowerCase().includes('denied')) ||
    Boolean(error?.toLowerCase().includes('permission'))

  if (variant === 'today') {
    return (
      <section
        className={cn(
          'mb-4 flex items-center gap-3 rounded-2xl border border-border/50 bg-secondary/25 px-4 py-3',
          className,
        )}
      >
        <CloudSun className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          {phase === 'loading' ? (
            <p className="text-sm text-muted-foreground">Checking local weather…</p>
          ) : phase === 'ready' && snap ? (
            <>
              <p className="text-sm font-medium">
                {formatTemp(snap)} · {snap.label}
              </p>
              <p className="truncate text-xs text-muted-foreground">{snap.outdoorHint}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {denied
                ? 'Location blocked — enable it in system settings to see weather.'
                : error || 'Weather unavailable.'}
            </p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="shrink-0 gap-1.5"
          disabled={phase === 'loading'}
          onClick={() => {
            deniedRef.current = false
            void load(true)
          }}
          aria-label="Refresh weather"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', phase === 'loading' && 'animate-spin')} />
        </Button>
      </section>
    )
  }

  return (
    <div className={cn('rounded-xl border border-border/50 bg-background/70 p-3', className)}>
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Outdoor conditions</p>
          {phase === 'loading' ? (
            <p className="mt-0.5 text-sm text-muted-foreground">Loading weather…</p>
          ) : phase === 'ready' && snap ? (
            <>
              <p className="mt-0.5 text-sm font-medium">
                {formatTemp(snap)} · {snap.label}
                <span className="font-normal text-muted-foreground">
                  {' '}
                  · wind {Math.round(snap.windMph)} mph
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{snap.outdoorHint}</p>
            </>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {denied ? 'Location blocked in system settings.' : error || 'Weather unavailable.'}
            </p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={phase === 'loading'}
          onClick={() => {
            deniedRef.current = false
            void load(true)
          }}
        >
          Refresh
        </Button>
      </div>
    </div>
  )
}
