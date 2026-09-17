import { useEffect, useRef, useState } from 'react'
import { CloudSun, MapPin, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  fetchWeatherFromCoords,
  fetchWeatherSnapshot,
  formatTemp,
  queryGeolocationPermission,
  readWeatherCache,
  requestGeolocation,
  WeatherGeoError,
  type WeatherSnapshot,
} from '@/lib/weather/open-meteo'

type Props = {
  variant?: 'today' | 'cardio'
  className?: string
}

type Phase = 'loading' | 'ready' | 'needs_allow' | 'denied' | 'error'

/**
 * iOS PWAs only show the location prompt when getCurrentPosition starts
 * inside a real click handler (no await before it). Auto-prompt on mount
 * often fails / hangs and then looks “blocked” with nowhere to turn it on
 * (PWAs are not a “Katana” app in Settings).
 */
export function WeatherGlance({ variant = 'today', className }: Props) {
  const [snap, setSnap] = useState<WeatherSnapshot | null>(() => readWeatherCache())
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>(() => (readWeatherCache() ? 'ready' : 'needs_allow'))
  const inFlight = useRef(false)
  const hasSnap = useRef(Boolean(readWeatherCache()))

  async function finishWithPosition(geoPromise: Promise<GeolocationPosition>) {
    if (inFlight.current) return
    inFlight.current = true
    setPhase('loading')
    setError(null)
    try {
      const pos = await geoPromise
      const next = await fetchWeatherFromCoords(pos.coords.latitude, pos.coords.longitude)
      hasSnap.current = true
      setSnap(next)
      setPhase('ready')
    } catch (err) {
      const kind = err instanceof WeatherGeoError ? err.kind : 'unknown'
      const msg = err instanceof Error ? err.message : 'Couldn’t load weather'
      if (!hasSnap.current) {
        setError(msg)
        setPhase(kind === 'denied' ? 'denied' : kind === 'timeout' ? 'needs_allow' : 'error')
      }
    } finally {
      inFlight.current = false
    }
  }

  /** Must call requestGeolocation() synchronously in the click handler. */
  function onAllowLocation() {
    const geoPromise = requestGeolocation(true)
    void finishWithPosition(geoPromise)
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

      // Only auto-fetch when the OS already granted access — never prompt from mount on iOS.
      if (permission === 'granted') {
        setPhase('loading')
        try {
          const next = await fetchWeatherSnapshot(false)
          if (cancelled) return
          hasSnap.current = true
          setSnap(next)
          setPhase('ready')
        } catch {
          if (!cancelled) setPhase('needs_allow')
        }
        return
      }

      setPhase('needs_allow')
    }

    void boot()

    function onVisible() {
      if (cancelled || hasSnap.current || inFlight.current) return
      void queryGeolocationPermission().then((permission) => {
        if (permission === 'granted') {
          void finishWithPosition(requestGeolocation(false))
        }
      })
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') onVisible()
    }

    window.addEventListener('focus', onVisible)
    window.addEventListener('pageshow', onVisible)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('pageshow', onVisible)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

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
          ) : phase === 'denied' ? (
            <>
              <p className="text-sm font-medium">Location was denied</p>
              <p className="text-xs text-muted-foreground">
                On iPhone: Settings → Apps → Safari → Location → Ask or Allow. Then come back and tap
                Allow location again. (Home Screen apps use Safari’s location setting — there isn’t a
                separate Katana toggle.)
              </p>
            </>
          ) : phase === 'error' ? (
            <p className="text-sm text-muted-foreground">{error || 'Weather unavailable.'}</p>
          ) : (
            <>
              <p className="text-sm font-medium">Local weather</p>
              <p className="text-xs text-muted-foreground">
                Tap Allow location, then choose Allow on the phone prompt.
              </p>
            </>
          )}
        </div>
        {phase === 'ready' ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="shrink-0"
            aria-label="Refresh weather"
            onClick={onAllowLocation}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        ) : phase === 'loading' ? (
          <Button type="button" size="sm" variant="ghost" className="shrink-0" disabled aria-label="Loading">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
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
          ) : phase === 'denied' ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Location denied in Safari settings. Set Safari → Location to Ask/Allow, then tap Allow
              location.
            </p>
          ) : phase === 'error' ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{error || 'Weather unavailable.'}</p>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Tap Allow location, then choose Allow on the phone prompt.
            </p>
          )}
        </div>
        {phase === 'ready' ? (
          <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={onAllowLocation}>
            Refresh
          </Button>
        ) : phase === 'loading' ? (
          <Button type="button" size="sm" variant="outline" className="shrink-0" disabled>
            …
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
