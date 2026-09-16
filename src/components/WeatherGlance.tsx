import { useEffect, useState } from 'react'
import { CloudSun, MapPin, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  fetchWeatherSnapshot,
  formatTemp,
  queryGeolocationPermission,
  readWeatherCache,
  setWeatherLocationOptedIn,
  weatherLocationOptedIn,
  type WeatherSnapshot,
} from '@/lib/weather/open-meteo'

type Props = {
  /** Compact strip for Today; fuller card for cardio / outdoor. */
  variant?: 'today' | 'cardio'
  className?: string
}

type Phase = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Weather must not call geolocation on first paint.
 * iOS PWAs often leave getCurrentPosition hanging after Allow until refresh
 * when the prompt was triggered from mount (not a user gesture).
 */
export function WeatherGlance({ variant = 'today', className }: Props) {
  const [snap, setSnap] = useState<WeatherSnapshot | null>(() => readWeatherCache())
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>(() => (readWeatherCache() ? 'ready' : 'idle'))

  async function load(force = false) {
    setPhase('loading')
    setError(null)
    try {
      const next = await fetchWeatherSnapshot(force)
      setSnap(next)
      setPhase('ready')
    } catch (err) {
      setSnap(null)
      setError(err instanceof Error ? err.message : 'Couldn’t load weather')
      setPhase('error')
    }
  }

  useEffect(() => {
    let cancelled = false

    async function boot() {
      const cached = readWeatherCache()
      if (cached) {
        if (!cancelled) {
          setSnap(cached)
          setPhase('ready')
        }
        return
      }

      const permission = await queryGeolocationPermission()
      if (cancelled) return

      // Only auto-fetch when the OS already granted access (or user opted in before).
      // Never pop the system prompt from mount — that sticks on iPhone PWAs.
      if (permission === 'granted' || (permission === 'unknown' && weatherLocationOptedIn())) {
        await load(false)
        return
      }

      if (permission === 'denied') {
        setError('Location permission denied')
        setPhase('error')
        return
      }

      setPhase('idle')
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  async function onEnableWeather() {
    setWeatherLocationOptedIn(true)
    await load(true)
  }

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
          ) : phase === 'idle' ? (
            <>
              <p className="text-sm font-medium">Local weather</p>
              <p className="text-xs text-muted-foreground">Tap to use location for outdoor conditions.</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {denied ? 'Location blocked — enable it in system settings to see weather.' : error || 'Weather unavailable.'}
            </p>
          )}
        </div>
        {phase === 'idle' ? (
          <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => void onEnableWeather()}>
            Show
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="shrink-0 gap-1.5"
            disabled={phase === 'loading'}
            onClick={() => void load(true)}
            aria-label="Refresh weather"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', phase === 'loading' && 'animate-spin')} />
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
          ) : phase === 'idle' ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Tap enable to check conditions before a run or walk.
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {denied ? 'Location blocked in system settings.' : error || 'Weather unavailable.'}
            </p>
          )}
        </div>
        {phase === 'idle' ? (
          <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => void onEnableWeather()}>
            Enable
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={phase === 'loading'}
            onClick={() => void load(true)}
          >
            Refresh
          </Button>
        )}
      </div>
    </div>
  )
}
