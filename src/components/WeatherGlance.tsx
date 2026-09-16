import { useEffect, useState } from 'react'
import { CloudSun, MapPin, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fetchWeatherSnapshot, formatTemp, type WeatherSnapshot } from '@/lib/weather/open-meteo'

type Props = {
  /** Compact strip for Today; fuller card for cardio / outdoor. */
  variant?: 'today' | 'cardio'
  className?: string
}

export function WeatherGlance({ variant = 'today', className }: Props) {
  const [snap, setSnap] = useState<WeatherSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load(force = false) {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchWeatherSnapshot(force)
      setSnap(next)
    } catch (err) {
      setSnap(null)
      setError(err instanceof Error ? err.message : 'Couldn’t load weather')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(false)
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
          {loading && !snap ? (
            <p className="text-sm text-muted-foreground">Checking local weather…</p>
          ) : snap ? (
            <>
              <p className="text-sm font-medium">
                {formatTemp(snap)} · {snap.label}
              </p>
              <p className="truncate text-xs text-muted-foreground">{snap.outdoorHint}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {error?.includes('denied') || error?.toLowerCase().includes('permission')
                ? 'Allow location to see outdoor conditions.'
                : error || 'Weather unavailable.'}
            </p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="shrink-0 gap-1.5"
          disabled={loading}
          onClick={() => void load(true)}
          aria-label="Refresh weather"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
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
          {loading && !snap ? (
            <p className="mt-0.5 text-sm text-muted-foreground">Loading weather…</p>
          ) : snap ? (
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
              {error || 'Enable location for run / walk conditions.'}
            </p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={loading}
          onClick={() => void load(true)}
        >
          Refresh
        </Button>
      </div>
    </div>
  )
}
