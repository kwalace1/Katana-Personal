import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Pause, Play, Square, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Segmented } from '@/components/ui/segmented'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { durationTotalSeconds, formatCardioDuration, healthApi } from '../api'
import {
  CARDIO_ACTIVITIES,
  cardioElapsedSeconds,
  discardCardioTrack,
  finishCardioTrack,
  getCardioTrack,
  pauseCardioTrack,
  resumeCardioTrack,
  setCardioTrackKind,
  startCardioTrack,
} from '../cardio-track'
import { useCardioTrack } from '../useCardioTrack'
import { formatLiftDate } from './lift/LiftLineChart'
import { CardioMap } from './CardioMap'
import { WeatherGlance } from '@/components/WeatherGlance'
import type { Workout } from '../types'

function cardioSeconds(entry: Workout): number {
  const fromParts = durationTotalSeconds({
    hours: entry.duration_hours,
    minutes: entry.duration_mins,
    seconds: entry.duration_secs,
  })
  if (fromParts > 0) return fromParts
  return Math.round((entry.duration_minutes || 0) * 60)
}

type Props = {
  userId: string
  logDate: string
  tick: number
  refresh: () => void
}

const ACTIVITIES = CARDIO_ACTIVITIES

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
  const [now, setNow] = useState(() => Date.now())
  const [view, setView] = useState<'home' | 'track' | 'log'>(() =>
    getCardioTrack().status === 'idle' ? 'home' : 'track',
  )

  const track = useCardioTrack()
  const status = track.status
  const trackKind = track.kind
  const path = track.path
  const elapsed = cardioElapsedSeconds(track, now)
  const distance = useMemo(() => pathDistanceMeters(path), [path])
  const gpsOk = typeof navigator !== 'undefined' && 'geolocation' in navigator

  useEffect(() => {
    if (status === 'idle') return
    const id = window.setInterval(() => setNow(Date.now()), 400)
    return () => window.clearInterval(id)
  }, [status])

  function startTrack() {
    try {
      startCardioTrack(trackKind)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t start tracking')
    }
  }

  function pauseTrack() {
    pauseCardioTrack()
  }

  function resumeTrack() {
    resumeCardioTrack()
  }

  function finishTrack() {
    const snapshot = finishCardioTrack()
    if (!snapshot) return
    const secs = snapshot.elapsed
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    const dist = pathDistanceMeters(snapshot.path)
    const row = healthApi.addCardio(userId, {
      activity: snapshot.kind,
      date: todayKey(),
      hours: h,
      minutes: m,
      seconds: s,
      notes: dist > 0 ? `${formatDistance(dist)} · ${formatPace(dist, secs)}` : '',
      path: snapshot.path,
      distance_m: dist,
    })
    if (!row) {
      toast.error('Need a few seconds of GPS to save a map')
      return
    }
    toast.success(`Saved ${snapshot.kind.toLowerCase()} · ${formatDistance(dist)}`)
    burstConfetti()
    setView('home')
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
    setView('home')
    refresh()
  }

  const tracking = status !== 'idle'

  return (
    <div className="space-y-3">
      {view === 'home' ? (
        <div className="space-y-5">
          <div>
            <h3 className="font-display text-lg tracking-tight">Track an activity</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {tracking
                ? `${trackKind} is ${status === 'paused' ? 'paused' : 'recording'} · ${formatClock(elapsed)}${distance > 0 ? ` · ${formatDistance(distance)}` : ''}`
                : 'Record a GPS route for a run, walk, ride, or row. The route stays on this device.'}
            </p>
            <Button type="button" size="sm" className="mt-3" onClick={() => setView('track')}>
              {tracking ? 'Return to session' : 'Start tracking'}
            </Button>
          </div>
          <div>
            <h3 className="font-display text-lg tracking-tight">Log an activity</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Add a workout you already finished, with duration and notes.
            </p>
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setView('log')}>
              Add activity
            </Button>
          </div>
        </div>
      ) : null}

      {view === 'track' ? (
      <div className="kp-surface space-y-3 overflow-hidden p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg tracking-tight">Record a route</h3>
          <Button type="button" size="sm" variant="ghost" className="shrink-0" onClick={() => setView('home')}>
            Back
          </Button>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          GPS stays on this device. Locking the phone is fine. Don’t swipe the app away.
        </p>
        <WeatherGlance variant="cardio" />
        <Segmented
          value={trackKind}
          disabled={status !== 'idle'}
          onChange={setCardioTrackKind}
          options={ACTIVITIES.map((kind) => ({ id: kind, label: kind }))}
        />
        {status !== 'idle' || path.length > 0 ? (
          <CardioMap path={path} follow={status === 'live'} className="h-56 w-full" />
        ) : null}
        <div className="grid grid-cols-3 divide-x border-y border-border text-center">
          <div className="px-2 py-3">
            <p className="kp-section-label">Time</p>
            <p className="font-display text-lg">{formatClock(elapsed)}</p>
          </div>
          <div className="px-2 py-3">
            <p className="kp-section-label">Distance</p>
            <p className="font-display text-lg">{formatDistance(distance)}</p>
          </div>
          <div className="px-2 py-3">
            <p className="kp-section-label">Pace</p>
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
            <>
              <Button type="button" variant="outline" className="gap-1.5" onClick={finishTrack}>
                <Square className="h-4 w-4" />
                Finish & save
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="gap-1.5 text-muted-foreground"
                onClick={() => {
                  discardCardioTrack()
                  toast.message('Route discarded')
                }}
              >
                Discard
              </Button>
            </>
          ) : null}
        </div>
        {!gpsOk ? (
          <p className="text-xs text-muted-foreground">Location isn’t available in this browser — log the activity instead.</p>
        ) : null}
      </div>
      ) : null}

      {view === 'log' ? (
      <form onSubmit={save} className="kp-surface min-w-0 space-y-3 overflow-hidden p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg tracking-tight">Log activity</h3>
          <Button type="button" size="sm" variant="ghost" onClick={() => setView('home')}>
            Back
          </Button>
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
      ) : null}

      {view === 'home' ? (
      <div>
        <h3 className="mb-3 font-display text-lg tracking-tight">Cardio history</h3>
        {entries.length === 0 ? (
          <EmptyState
            compact
            plain
            title="No cardio yet"
            description="Saved activities show up here."
          />
        ) : (
          <ul className="divide-y border-y border-border">
            {entries.map((entry) => {
              const open = openId === entry.id
              const seconds = cardioSeconds(entry)
              const distance = entry.distance_m && entry.distance_m > 0 ? entry.distance_m : 0
              const pace = distance > 0 ? formatPace(distance, seconds) : ''
              const hasPath = Boolean(entry.path && entry.path.length > 1)
              return (
              <li key={entry.id} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                    onClick={() => setOpenId((id) => (id === entry.id ? null : entry.id))}
                  >
                    <ChevronDown
                      className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{entry.activity}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {formatLiftDate(entry.date)} · {formatCardioDuration(entry)}
                        {distance ? ` · ${formatDistance(distance)}` : ''}
                      </span>
                    </span>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${entry.activity}`}
                    onClick={() => {
                      if (openId === entry.id) setOpenId(null)
                      healthApi.removeWorkout(userId, entry.id)
                      refresh()
                      toast.message('Cardio activity deleted')
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {open ? (
                  <div className="pl-6">
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Duration</dt>
                        <dd>{formatCardioDuration(entry)}</dd>
                      </div>
                      {distance ? (
                        <div>
                          <dt className="text-xs text-muted-foreground">Distance</dt>
                          <dd>{formatDistance(distance)}</dd>
                        </div>
                      ) : null}
                      {pace && pace !== '—' ? (
                        <div>
                          <dt className="text-xs text-muted-foreground">Pace</dt>
                          <dd>{pace}</dd>
                        </div>
                      ) : null}
                      {entry.calories != null && entry.calories > 0 ? (
                        <div>
                          <dt className="text-xs text-muted-foreground">Calories</dt>
                          <dd>{Math.round(entry.calories)} cal</dd>
                        </div>
                      ) : null}
                    </dl>
                    {entry.notes ? (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{entry.notes}</p>
                    ) : null}
                    {hasPath && entry.path ? (
                      <CardioMap path={entry.path} className="mt-3 h-44 w-full" />
                    ) : null}
                  </div>
                ) : null}
              </li>
              )
            })}
          </ul>
        )}
      </div>
      ) : null}
    </div>
  )
}
