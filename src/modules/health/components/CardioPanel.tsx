import { FormEvent, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { todayKey } from '@/lib/dates'
import { burstConfetti } from '@/lib/celebrate'
import { computeLocalStreaks } from '@/lib/social/streaks'
import {
  buildCardioShareCard,
  buildHealthStreakShareCard,
  isCardioPersonalBest,
  isStreakMilestone,
  offerShareWin,
} from '@/lib/social/share-win'
import { formatCardioDuration, healthApi } from '../api'
import { formatLiftDate } from './lift/LiftLineChart'

type Props = {
  userId: string
  logDate: string
  tick: number
  refresh: () => void
}

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
  const [notes, setNotes] = useState('')

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
    const row = healthApi.addCardio(userId, {
      activity,
      date,
      hours: Number(hours) || 0,
      minutes: Number(minutes) || 0,
      seconds: Number(seconds) || 0,
      notes,
    })
    if (!row) {
      toast.error('Enter a duration greater than zero')
      return
    }
    toast.success('Cardio activity saved')
    burstConfetti()
    const minutes = Number(row.duration_minutes) || 0
    const priorSameDay = entries.filter((e) => e.date === date && e.id !== row.id).length
    const { workoutStreak } = computeLocalStreaks(userId)
    const personalBest = isCardioPersonalBest(userId, activity.trim(), minutes, row.id)
    if (priorSameDay === 0 && isStreakMilestone(workoutStreak)) {
      offerShareWin(
        buildHealthStreakShareCard({
          kind: 'cardio',
          streak: workoutStreak,
          detail: activity.trim(),
        }),
      )
    } else if (personalBest || minutes >= 60) {
      offerShareWin(
        buildCardioShareCard({
          activity: activity.trim(),
          minutes,
          dateLabel: formatLiftDate(date),
          personalBest,
        }),
      )
    }
    setActivity('')
    setHours('')
    setMinutes('')
    setSeconds('')
    setNotes('')
    refresh()
  }

  return (
    <div className="space-y-4">
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
        <Textarea
          rows={4}
          placeholder="Pace, distance, how it felt…"
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
          <EmptyState title="No cardio yet" description="Log a session to start building your activity history." />
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-border/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{entry.activity}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatLiftDate(entry.date)} · {formatCardioDuration(entry)}
                    </p>
                    {entry.notes ? <p className="mt-1 text-sm text-muted-foreground">{entry.notes}</p> : null}
                  </div>
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
