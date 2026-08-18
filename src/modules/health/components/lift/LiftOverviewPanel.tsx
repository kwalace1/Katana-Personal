import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { todayKey } from '@/lib/dates'
import { formatMealTime } from '../../api'
import { formatLb, formatSplitExerciseLine, liftApi } from '../../lift-api'
import { formatLiftDate } from './LiftLineChart'
import { cn } from '@/lib/utils'

type Props = {
  userId: string
  tick: number
  refresh: () => void
  onGoLift?: () => void
  onGoSplits?: () => void
}

export function LiftOverviewPanel({ userId, tick, refresh, onGoLift, onGoSplits }: Props) {
  const sessions = useMemo(() => {
    void tick
    return liftApi.listSessions(userId)
  }, [userId, tick])

  const splits = useMemo(() => {
    void tick
    return liftApi.listSplits(userId)
  }, [userId, tick])

  const weights = useMemo(() => {
    void tick
    return liftApi.listBodyWeight(userId)
  }, [userId, tick])

  const activeSplit = splits.find((s) => s.active) ?? null
  const latestWeight = weights[weights.length - 1]
  const goal = useMemo(() => {
    void tick
    return liftApi.getActiveWeightGoal(userId)
  }, [userId, tick])

  const plan = useMemo(() => {
    void tick
    return liftApi.getWeightGoalPlan(userId)
  }, [userId, tick])
  const currentWeightWeek = plan?.weeks.find((week) => week.isCurrent)

  const now = new Date()
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth())
  const [calendarYear, setCalendarYear] = useState(now.getFullYear())
  const [selectedDate, setSelectedDate] = useState(todayKey())

  const dayDetail = useMemo(() => {
    void tick
    return liftApi.calendarDay(userId, selectedDate)
  }, [userId, selectedDate, tick])

  const monthLabel = new Date(calendarYear, calendarMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const cells = useMemo(() => buildCalendarCells(calendarYear, calendarMonth), [calendarYear, calendarMonth])

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const s of sessions) {
      const list = map.get(s.date) || []
      list.push(s.title)
      map.set(s.date, list)
    }
    return map
  }, [sessions])

  const weightByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const w of weights) map.set(w.date, w.weight)
    return map
  }, [weights])

  function shiftMonth(delta: number) {
    const d = new Date(calendarYear, calendarMonth + delta, 1)
    setCalendarMonth(d.getMonth())
    setCalendarYear(d.getFullYear())
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Strength snapshot — open Lift to log a session (autosaves if you leave mid-workout).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onGoLift}>
            Log lift
          </Button>
          <Button size="sm" variant="outline" onClick={onGoSplits}>
            Create split
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              if (!window.confirm('Clear all lift workouts, splits, and weight logs? Cardio, nutrition, and sleep stay.')) {
                return
              }
              liftApi.clearLiftData(userId)
              refresh()
              toast.message('Lift data cleared')
            }}
          >
            Clear lift data
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!window.confirm('Replace lift data with demo workouts and a cut goal?')) return
              liftApi.loadDemoLiftData(userId)
              refresh()
              toast.success('Demo lift data loaded')
            }}
          >
            Load demo
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Workouts logged" value={String(sessions.length)} hint="All time" />
        <MetricCard
          label="Bodyweight"
          value={latestWeight ? `${latestWeight.weight} lb` : '—'}
          hint={
            currentWeightWeek
              ? `This week avg: ${formatLb(currentWeightWeek.targetWeight)} lb`
              : goal
                ? `Goal ${goal.target_weight} lb · ${goal.mode}`
                : 'No goal set'
          }
        />
        <MetricCard
          label="Active split"
          value={activeSplit?.name || 'None'}
          hint={activeSplit ? `${activeSplit.days.length} days · ${activeSplit.pattern}` : 'Create a split'}
        />
      </div>

      <div className="kp-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg tracking-tight">{monthLabel}</h3>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const t = new Date()
                setCalendarMonth(t.getMonth())
                setCalendarYear(t.getFullYear())
                setSelectedDate(todayKey())
              }}
            >
              Today
            </Button>
            <Button size="icon" variant="outline" onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, cellIdx) => {
            if (!cell) return <div key={`pad-${cellIdx}`} className="min-h-[4.5rem]" />
            const titles = sessionsByDate.get(cell) || []
            const bw = weightByDate.get(cell)
            const selected = cell === selectedDate
            const isToday = cell === todayKey()
            return (
              <button
                key={cell}
                type="button"
                onClick={() => setSelectedDate(cell)}
                className={cn(
                  'min-h-[4.5rem] rounded-lg border p-1.5 text-left transition',
                  selected
                    ? 'border-primary bg-primary/10'
                    : 'border-border/50 bg-card/40 hover:border-primary/40',
                  isToday && !selected && 'ring-1 ring-primary/30',
                )}
              >
                <p className="text-xs font-semibold">{Number(cell.slice(-2))}</p>
                {titles.slice(0, 2).map((t) => (
                  <p key={t} className="truncate text-[0.65rem] text-primary">
                    {t}
                  </p>
                ))}
                {titles.length > 2 ? (
                  <p className="text-[0.65rem] text-muted-foreground">+{titles.length - 2}</p>
                ) : null}
                {bw != null ? <p className="text-[0.65rem] text-muted-foreground">{bw} lb</p> : null}
              </button>
            )
          })}
        </div>

        <div className="mt-4 rounded-xl border border-border/60 bg-secondary/20 p-3">
          <p className="text-sm font-medium">{formatLiftDate(selectedDate)}</p>
          {dayDetail.sessions.length === 0 && !dayDetail.weight ? (
            <p className="mt-1 text-sm text-muted-foreground">Nothing logged this day.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {dayDetail.sessions.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {liftApi.sessionExerciseGroups(userId, s.id).map((g) => g.name).join(' · ') || 'Lift'}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      liftApi.removeSession(userId, s.id)
                      refresh()
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
              {dayDetail.weight ? (
                <li className="text-sm text-muted-foreground">
                  Bodyweight · {dayDetail.weight.weight} lb
                  {dayDetail.weight.time ? ` · ${formatMealTime(dayDetail.weight.time)}` : ''}
                </li>
              ) : null}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="kp-surface p-4">
          <h3 className="font-display text-lg tracking-tight">Recent workouts</h3>
          {sessions.length === 0 ? (
            <EmptyState title="No lifts yet" description="Log your first session under Lift." className="mt-3" />
          ) : (
            <ul className="mt-3 space-y-2">
              {sessions.slice(0, 4).map((s) => {
                const groups = liftApi.sessionExerciseGroups(userId, s.id)
                return (
                  <li key={s.id} className="rounded-xl border border-border/50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{formatLiftDate(s.date)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {groups.map((g) => `${g.name} (${g.sets.length})`).join(' · ')}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="kp-surface p-4">
          <h3 className="font-display text-lg tracking-tight">Active split</h3>
          {!activeSplit ? (
            <EmptyState
              title="No active split"
              description="Build a cycle or weekday plan under Splits."
              className="mt-3"
            />
          ) : (
            <ul className="mt-3 space-y-2">
              {activeSplit.days.slice(0, 7).map((day, i) => (
                <li key={`${day.name}-${i}`} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{day.name}</span>
                    <span className="font-medium">{day.focus || 'Rest'}</span>
                  </div>
                  {day.exercises?.length ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {day.exercises.map((exercise) => formatSplitExerciseLine(exercise)).join(' · ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="kp-surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function buildCalendarCells(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(todayKey(new Date(year, month, d)))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
