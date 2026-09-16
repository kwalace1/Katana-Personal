import { useEffect, useRef, useState } from 'react'
import { CloudSun, MapPin, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  fetchWeatherSnapshot,
  formatTemp,
  queryGeolocationPermission,
  readWeatherCache,
  WeatherGeoError,
  type WeatherSnapshot,
} from '@/lib/weather/open-meteo'

type Props = {
  /** Compact strip for Today; fuller card for cardio / outdoor. */
  variant?: 'today' | 'cardio'
  className?: string
}

type Phase = 'loading' | 'ready' | 'needs_allow' | 'os_denied' | 'error'

/**
 * Auto-try location on first visit, but recover without a full app refresh:
 * - Mount request can hang on iOS after Allow → timeout → show Allow location CTA
 * - Tapping Allow location is a user gesture (reliable path for the system prompt)
 * - Only show “blocked in Settings” after a confirmed OS denial
 */
export function WeatherGlance({ variant = 'today', className }: Props) {
  const [snap, setSnap] = useState<WeatherSnapshot | null>(() => readWeatherCache())
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>(() => (readWeatherCache() ? 'ready' : 'loading'))
  const inFlight = useRef(false)
  const hasSnap = useRef(Boolean(readWeatherCache()))
  const osDenied = useRef(false)

  async function load(opts: { force?: boolean; fromUserGesture?: boolean } = {}) {
    const { force = false, fromUserGesture = false } = opts
    if (inFlight.current) return
    inFlight.current = true
    setPhase('loading')
    setError(null)
    try {
      const next = await fetchWeatherSnapshot(force)
      hasSnap.current = true
      osDenied.current = false
      setSnap(next)
      setPhase('ready')
    } catch (err) {
      const kind = err instanceof WeatherGeoError ? err.kind : 'unknown'
      const msg = err instanceof Error ? err.message : 'Couldn’t load weather'

      if (kind === 'denied') {
        // Confirm with Permissions API when possible — mount-time denials on iOS are often recoverable
        // via a real tap (user gesture). Only show Settings copy after a confirmed deny.
        const permission = await queryGeolocationPermission()
        if (!hasSnap.current) {
          if (permission === 'denied' || fromUserGesture) {
            osDenied.current = true
            setError(msg)
            setPhase('os_denied')
          } else {
            setError(msg)
            setPhase('needs_allow')
          }
        }
      } else if (!hasSnap.current) {
        setError(msg)
        setPhase(kind === 'timeout' || kind === 'unknown' ? 'needs_allow' : 'error')
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
        osDenied.current = true
        setPhase('os_denied')
        setError('Location permission denied')
        return
      }

      if (permission === 'granted') {
        await load({ force: false })
        return
      }

      // First visit: try automatically (may show the system prompt).
      // If iOS drops the callback after Allow, we time out into needs_allow — no app refresh required.
      await load({ force: false, fromUserGesture: false })
    }

    void boot()

    function retryAfterPrompt() {
      if (cancelled || hasSnap.current || inFlight.current || osDenied.current) return
      void load({ force: true, fromUserGesture: false })
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
          if (permissionStatus?.state === 'granted') {
            osDenied.current = false
            retryAfterPrompt()
          }
          if (permissionStatus?.state === 'denied' && !hasSnap.current) {
            osDenied.current = true
            setError('Location permission denied')
            setPhase('os_denied')
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

  function onAllowLocation() {
    osDenied.current = false
    void load({ force: true, fromUserGesture: true })
  }

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
          ) : phase === 'needs_allow' ? (
            <>
              <p className="text-sm font-medium">Local weather</p>
              <p className="text-xs text-muted-foreground">
                Tap Allow location, then approve the phone prompt — no app refresh needed.
              </p>
            </>
          ) : phase === 'os_denied' ? (
            <>
              <p className="text-sm font-medium">Location is off for Katana</p>
              <p className="text-xs text-muted-foreground">
                iPhone: Settings → Privacy & Security → Location Services → Katana (or Safari) → While
                Using. Then tap Try again.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{error || 'Weather unavailable.'}</p>
          )}
        </div>
        {phase === 'ready' ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="shrink-0 gap-1.5"
            disabled={phase === 'loading'}
            onClick={() => void load({ force: true, fromUserGesture: true })}
            aria-label="Refresh weather"
          >
            <RefreshCw className={cn('h-3.5 w-3.5')} />
          </Button>
        ) : phase === 'loading' ? (
          <Button type="button" size="sm" variant="ghost" className="shrink-0" disabled aria-label="Loading">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          </Button>
        ) : phase === 'os_denied' ? (
          <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={onAllowLocation}>
            Try again
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={onAllowLocation}>
            Allow location
          </Button>
        )}
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
          ) : phase === 'needs_allow' ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Tap Allow location, then approve the phone prompt.
            </p>
          ) : phase === 'os_denied' ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Location is off in system settings. Turn it on for Katana, then Try again.
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">{error || 'Weather unavailable.'}</p>
          )}
        </div>
        {phase === 'ready' ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => void load({ force: true, fromUserGesture: true })}
          >
            Refresh
          </Button>
        ) : phase === 'loading' ? (
          <Button type="button" size="sm" variant="outline" className="shrink-0" disabled>
            …
          </Button>
        ) : phase === 'os_denied' ? (
          <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={onAllowLocation}>
            Try again
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={onAllowLocation}>
            Allow location
          </Button>
        )}
      </div>
    </div>
  )
}
