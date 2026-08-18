import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { todayKey } from '@/lib/dates'
import { formatMealTime } from '../../api'
import { formatLb, formatSplitExerciseLine, liftApi } from '../../lift-api'
import { formatLiftDate } from './LiftLineChart'
import { HealthCardHeader, HealthInner, HealthPill, HealthStat } from '../health-ui'
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Strength snapshot — log a session anytime. Drafts stay on this device if you leave mid-workout.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onGoLift}>
            Log lift
          </Button>
          <Button size="sm" variant="outline" onClick={onGoSplits}>
            Create split
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <HealthStat label="Workouts logged" value={String(sessions.length)} hint="All time" />
        <HealthStat
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
        <HealthStat
          label="Active split"
          value={activeSplit?.name || 'None'}
          hint={activeSplit ? `${activeSplit.days.length} days · ${activeSplit.pattern}` : 'Create a split'}
        />
      </div>

      <div className="kp-surface p-4 sm:p-5">
        <HealthCardHeader
          eyebrow="Training log"
          title={monthLabel}
          actions={
            <div className="flex gap-1">
              <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full"
                onClick={() => {
                  const t = new Date()
                  setCalendarMonth(t.getMonth())
                  setCalendarYear(t.getFullYear())
                  setSelectedDate(todayKey())
                }}
              >
                Today
              </Button>
              <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => shiftMonth(1)} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          }
        />
        <div className="mb-1 mt-4 grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
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
                  'flex min-h-[4.5rem] flex-col rounded-xl p-1.5 text-left transition',
                  selected
                    ? 'bg-primary/12 ring-1 ring-primary/30'
                    : 'bg-secondary/30 hover:bg-secondary/55',
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                    selected && 'bg-primary text-primary-foreground',
                    isToday && !selected && 'text-primary',
                  )}
                >
                  {Number(cell.slice(-2))}
                </span>
                {titles.slice(0, 2).map((t) => (
                  <p key={t} className="mt-0.5 truncate text-[0.65rem] text-muted-foreground">
                    {t}
                  </p>
                ))}
                {titles.length > 2 ? (
                  <p className="text-[0.65rem] text-muted-foreground">+{titles.length - 2}</p>
                ) : null}
                {bw != null ? <p className="mt-auto text-[0.65rem] text-muted-foreground">{bw} lb</p> : null}
              </button>
            )
          })}
        </div>

        <HealthInner className="mt-4">
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
        </HealthInner>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="kp-surface p-4 sm:p-5">
          <HealthCardHeader eyebrow="Recent" title="Workouts" />
          {sessions.length === 0 ? (
            <EmptyState title="No lifts yet" description="Log your first session under Lift." className="mt-3" />
          ) : (
            <ul className="mt-4 space-y-2">
              {sessions.slice(0, 4).map((s) => {
                const groups = liftApi.sessionExerciseGroups(userId, s.id)
                return (
                  <li key={s.id} className="rounded-2xl bg-secondary/40 px-3.5 py-2.5">
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

        <div className="kp-surface p-4 sm:p-5">
          <HealthCardHeader
            eyebrow="Routine"
            title="Active split"
            actions={
              activeSplit ? <HealthPill tone="primary">Active</HealthPill> : null
            }
          />
          {!activeSplit ? (
            <EmptyState
              title="No active split"
              description="Build a cycle or weekday plan under Splits."
              className="mt-3"
            />
          ) : (
            <ul className="mt-4 space-y-2">
              {activeSplit.days.slice(0, 7).map((day, i) => (
                <li key={`${day.name}-${i}`} className="rounded-2xl bg-secondary/40 px-3.5 py-2.5 text-sm">
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

      {import.meta.env.DEV ? (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => {
            if (!window.confirm('Replace lift data with demo workouts and a cut goal?')) return
            liftApi.loadDemoLiftData(userId)
            refresh()
            toast.success('Demo lift data loaded')
          }}
        >
          Load demo
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
      </div>
      ) : null}
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
