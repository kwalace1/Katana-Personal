import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Pause, Play, Square, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { todayKey } from '@/lib/dates'
import { burstConfetti } from '@/lib/celebrate'
import { formatClock, formatDistance, formatPace, pathDistanceMeters } from '@/lib/geo'
import { computeLocalStreaks } from '@/lib/social/streaks'
import {
  buildCardioShareCard,
  buildHealthStreakShareCard,
  isCardioPersonalBest,
  isStreakMilestone,
  offerShareWin,
} from '@/lib/social/share-win'
import { formatCardioDuration, healthApi } from '../api'
import type { GeoPoint } from '../types'
import { formatLiftDate } from './lift/LiftLineChart'
import { CardioMap } from './CardioMap'

type Props = {
  userId: string
  logDate: string
  tick: number
  refresh: () => void
}

const ACTIVITIES = ['Run', 'Walk', 'Ride', 'Row'] as const

type TrackStatus = 'idle' | 'live' | 'paused'

export function CardioPanel({ userId, logDate, tick, refresh }: Props) {
  const entries = useMemo(() => {
    void tick
    return healthApi.listCardio(userId)
  }, [userId, tick])

  const [activity, setActivity] = useState('')
  const [date, setDate] = useState(logDate || todayKey())
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [seconds, setSeconds] = useState('')
  const [calories, setCalories] = useState('')
  const [notes, setNotes] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const [trackKind, setTrackKind] = useState<(typeof ACTIVITIES)[number]>('Run')
  const [status, setStatus] = useState<TrackStatus>('idle')
  const [path, setPath] = useState<GeoPoint[]>([])
  const [elapsed, setElapsed] = useState(0)
  const watchRef = useRef<number | null>(null)
  const startedAt = useRef<number>(0)
  const pausedMs = useRef(0)
  const pauseStarted = useRef<number | null>(null)

  const distance = useMemo(() => pathDistanceMeters(path), [path])
  const gpsOk = typeof navigator !== 'undefined' && 'geolocation' in navigator

  useEffect(() => {
    if (status !== 'live') return
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current - pausedMs.current) / 1000))
    }, 400)
    return () => window.clearInterval(id)
  }, [status])

  useEffect(() => {
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
    }
  }, [])

  function startWatch() {
    if (!gpsOk) {
      toast.error('This device doesn’t share location')
      return
    }
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.accuracy > 80) return
        const point: GeoPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          t: Date.now(),
        }
        setPath((prev) => {
          const last = prev[prev.length - 1]
          if (last && Math.abs(last.lat - point.lat) < 1e-6 && Math.abs(last.lng - point.lng) < 1e-6) {
            return prev
          }
          return [...prev, point]
        })
      },
      (err) => {
        toast.error(err.message || 'Couldn’t get GPS')
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20_000 },
    )
  }

  function startTrack() {
    startedAt.current = Date.now()
    pausedMs.current = 0
    pauseStarted.current = null
    setPath([])
    setElapsed(0)
    setStatus('live')
    startWatch()
  }

  function pauseTrack() {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = null
    pauseStarted.current = Date.now()
    setStatus('paused')
  }

  function resumeTrack() {
    if (pauseStarted.current) pausedMs.current += Date.now() - pauseStarted.current
    pauseStarted.current = null
    setStatus('live')
    startWatch()
  }

  function finishTrack() {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = null
    const secs = Math.max(
      1,
      Math.floor((Date.now() - startedAt.current - pausedMs.current) / 1000),
    )
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    const dist = pathDistanceMeters(path)
    const row = healthApi.addCardio(userId, {
      activity: trackKind,
      date: todayKey(),
      hours: h,
      minutes: m,
      seconds: s,
      notes: dist > 0 ? `${formatDistance(dist)} · ${formatPace(dist, secs)}` : '',
      path,
      distance_m: dist,
    })
    setStatus('idle')
    setPath([])
    setElapsed(0)
    if (!row) {
      toast.error('Need a few seconds of GPS to save a map')
      return
    }
    toast.success(`Saved ${trackKind.toLowerCase()} · ${formatDistance(dist)}`)
    burstConfetti()
    refresh()
  }

  function save(e: FormEvent) {
    e.preventDefault()
    if (!activity.trim()) {
      toast.error('Add an activity name')
      return
    }
    if (!date) {
      toast.error('Add a date')
      return
    }
    const caloriesNum = calories.trim() === '' ? undefined : Number(calories)
    if (caloriesNum != null && (!Number.isFinite(caloriesNum) || caloriesNum < 0)) {
      toast.error('Enter a valid calories number')
      return
    }
    const row = healthApi.addCardio(userId, {
      activity,
      date,
      hours: Number(hours) || 0,
      minutes: Number(minutes) || 0,
      seconds: Number(seconds) || 0,
      notes,
      calories: caloriesNum,
    })
    if (!row) {
      toast.error('Enter a duration greater than zero')
      return
    }
    toast.success('Cardio activity saved')
    burstConfetti()
    const durationMinutes = Number(row.duration_minutes) || 0
    const priorSameDay = entries.filter((e) => e.date === date && e.id !== row.id).length
    const { workoutStreak } = computeLocalStreaks(userId)
    const personalBest = isCardioPersonalBest(userId, activity.trim(), durationMinutes, row.id)
    if (priorSameDay === 0 && isStreakMilestone(workoutStreak)) {
      offerShareWin(
        buildHealthStreakShareCard({
          kind: 'cardio',
          streak: workoutStreak,
          detail: activity.trim(),
        }),
      )
    } else if (personalBest || durationMinutes >= 60) {
      offerShareWin(
        buildCardioShareCard({
          activity: activity.trim(),
          minutes: durationMinutes,
          dateLabel: formatLiftDate(date),
          personalBest,
        }),
      )
    }
    setActivity('')
    setHours('')
    setMinutes('')
    setSeconds('')
    setCalories('')
    setNotes('')
    refresh()
  }

  return (
    <div className="space-y-4">
      <div className="kp-surface space-y-4 overflow-hidden p-4">
        <div>
          <p className="text-xs text-muted-foreground">Live map</p>
          <h3 className="font-display text-xl tracking-tight">Record a route</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            GPS stays on this device — path, distance, and pace like a run club map.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ACTIVITIES.map((kind) => (
            <Button
              key={kind}
              type="button"
              size="sm"
              variant={trackKind === kind ? 'default' : 'outline'}
              className="rounded-full"
              disabled={status !== 'idle'}
              onClick={() => setTrackKind(kind)}
            >
              {kind}
            </Button>
          ))}
        </div>
        {status !== 'idle' || path.length > 0 ? (
          <CardioMap path={path} follow={status === 'live'} className="h-56 w-full" />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-2xl bg-secondary/50 text-sm text-muted-foreground">
            <MapPin className="mr-2 h-4 w-4" />
            Start to drop a live map
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-secondary/50 px-2 py-3">
            <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Time</p>
            <p className="font-display text-lg">{formatClock(elapsed)}</p>
          </div>
          <div className="rounded-xl bg-secondary/50 px-2 py-3">
            <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Distance</p>
            <p className="font-display text-lg">{formatDistance(distance)}</p>
          </div>
          <div className="rounded-xl bg-secondary/50 px-2 py-3">
            <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Pace</p>
            <p className="font-display text-lg">{formatPace(distance, elapsed)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === 'idle' ? (
            <Button type="button" className="gap-1.5" onClick={startTrack} disabled={!gpsOk}>
              <Play className="h-4 w-4" />
              Start {trackKind.toLowerCase()}
            </Button>
          ) : null}
          {status === 'live' ? (
            <Button type="button" variant="outline" className="gap-1.5" onClick={pauseTrack}>
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          ) : null}
          {status === 'paused' ? (
            <Button type="button" className="gap-1.5" onClick={resumeTrack}>
              <Play className="h-4 w-4" />
              Resume
            </Button>
          ) : null}
          {status !== 'idle' ? (
            <Button type="button" variant="outline" className="gap-1.5" onClick={finishTrack}>
              <Square className="h-4 w-4" />
              Finish & save
            </Button>
          ) : null}
        </div>
        {!gpsOk ? (
          <p className="text-xs text-muted-foreground">Location isn’t available in this browser — log manually below.</p>
        ) : null}
      </div>

      <form onSubmit={save} className="kp-surface min-w-0 space-y-4 overflow-hidden p-4">
        <div>
          <p className="text-xs text-muted-foreground">Cardio</p>
          <h3 className="font-display text-xl tracking-tight">Log activity</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 *:min-w-0">
          <Input
            placeholder="Run, bike, row, walk…"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            aria-label="Activity"
          />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Duration</p>
          <div className="grid grid-cols-3 gap-3 *:min-w-0">
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="Hours"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              aria-label="Hours"
            />
            <Input
              type="number"
              min={0}
              max={59}
              step={1}
              placeholder="Minutes"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              aria-label="Minutes"
            />
            <Input
              type="number"
              min={0}
              max={59}
              step={1}
              placeholder="Seconds"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              aria-label="Seconds"
            />
          </div>
        </div>
        <Input
          type="number"
          min={0}
          step={1}
          placeholder="Calories burned (optional)"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          aria-label="Calories burned"
        />
        <Textarea
          rows={4}
          placeholder="How it felt…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          aria-label="Notes"
        />
        <Button type="submit">Save activity</Button>
      </form>

      <div className="kp-surface p-4">
        <p className="text-xs text-muted-foreground">History</p>
        <h3 className="mb-3 font-display text-lg tracking-tight">Cardio log</h3>
        {entries.length === 0 ? (
          <EmptyState title="No cardio yet" description="Record a route or log a session." />
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-border/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setOpenId((id) => (id === entry.id ? null : entry.id))}
                  >
                    <p className="font-medium">{entry.activity}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatLiftDate(entry.date)} · {formatCardioDuration(entry)}
                      {entry.distance_m ? ` · ${formatDistance(entry.distance_m)}` : ''}
                      {entry.calories != null && entry.calories > 0
                        ? ` · ${Math.round(entry.calories)} cal`
                        : ''}
                    </p>
                    {entry.notes ? <p className="mt-1 text-sm text-muted-foreground">{entry.notes}</p> : null}
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      healthApi.removeWorkout(userId, entry.id)
                      refresh()
                      toast.message('Cardio activity deleted')
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {openId === entry.id && entry.path && entry.path.length > 1 ? (
                  <CardioMap path={entry.path} className="mt-3 h-44 w-full" />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
