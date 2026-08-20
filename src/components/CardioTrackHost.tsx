import { Link, useLocation } from 'react-router-dom'
import { Footprints } from 'lucide-react'
import { formatClock, formatDistance, pathDistanceMeters } from '@/lib/geo'
import { cardioElapsedSeconds } from '@/modules/health/cardio-track'
import { useCardioTrack } from '@/modules/health/useCardioTrack'
import { useEffect, useState } from 'react'

const CARDIO_HREF = '/health?tab=workouts&area=fitness'

function isCardioPage(pathname: string, search: string) {
  if (pathname !== '/health') return false
  return new URLSearchParams(search).get('tab') === 'workouts'
}

/** Keeps a live walk/run alive while you leave Cardio, and offers a way back. */
export function CardioTrackHost() {
  const location = useLocation()
  const track = useCardioTrack()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (track.status === 'idle') return
    const id = window.setInterval(() => setNow(Date.now()), 400)
    return () => window.clearInterval(id)
  }, [track.status])

  if (track.status === 'idle') return null
  if (isCardioPage(location.pathname, location.search)) return null

  const elapsed = cardioElapsedSeconds(track, now)
  const distance = pathDistanceMeters(track.path)
  const label = track.status === 'paused' ? 'Paused' : 'Live'

  return (
    <Link
      to={CARDIO_HREF}
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex items-center gap-3 rounded-2xl border border-border/60 bg-card/95 px-4 py-3 shadow-lg backdrop-blur md:inset-x-auto md:bottom-5 md:right-5 md:w-[22rem]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Footprints className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          {track.kind} · {label}
        </span>
        <span className="block text-xs text-muted-foreground">
          {formatClock(elapsed)}
          {distance > 0 ? ` · ${formatDistance(distance)}` : ''}
          {' · tap to return'}
        </span>
      </span>
    </Link>
  )
}
