import { FormEvent, useMemo, useState } from 'react'
import { Plus, Scale, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { QuantityInput, QUANTITY } from '@/components/ui/quantity-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { todayKey } from '@/lib/dates'
import { burstConfetti } from '@/lib/celebrate'
import { cn } from '@/lib/utils'
import {
  buildWeightProgressShareCard,
  offerShareWin,
  resetWeightProgressMilestones,
  takeWeightProgressMilestone,
} from '@/lib/social/share-win'
import { formatMealTime } from '../../api'
import {
  formatLb,
  formatSignedLb,
  getWeightGoalPaceStatus,
  latestWeekWithAverage,
  liftApi,
  weeklyTargetOnDate,
  type WeightGoalPlan,
} from '../../lift-api'
import type { WeightGoalMode } from '../../types'
import { formatLiftDate, LiftLineChart } from './LiftLineChart'
import {
  HealthCardHeader,
  HealthFieldLabel,
  HealthSegmented,
  HealthStat,
  healthTableCell,
  healthTableHead,
} from '../health-ui'

type Props = {
  userId: string
  logDate: string
  tick: number
  refresh: () => void
}

type TrendRange = 'week' | 'month' | 'year' | 'all'

const TREND_RANGES: { id: TrendRange; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'all', label: 'All time' },
]

function localTimeHHMM(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function rangeCutoff(range: TrendRange): string | null {
  if (range === 'all') return null
  const end = new Date(`${todayKey()}T12:00:00`)
  if (range === 'week') end.setDate(end.getDate() - 6)
  else if (range === 'month') end.setDate(end.getDate() - 29)
  else if (range === 'year') end.setFullYear(end.getFullYear() - 1)
  else return null
  return todayKey(end)
}

function rangeLabel(range: TrendRange) {
  return (
    {
      week: 'Past week',
      month: 'Past month',
      year: 'Past year',
      all: 'All time',
    }[range] || 'All time'
  )
}

export function LiftWeightPanel({ userId, logDate, tick, refresh }: Props) {
  const entries = useMemo(() => {
    void tick
    return liftApi.listBodyWeight(userId)
  }, [userId, tick])

  const goal = useMemo(() => {
    void tick
    return liftApi.getActiveWeightGoal(userId)
  }, [userId, tick])

  const plan = useMemo(() => {
    void tick
    return liftApi.getWeightGoalPlan(userId)
  }, [userId, tick])

  const progress = useMemo(() => {
    void tick
    return liftApi.weightGoalProgress(userId)
  }, [userId, tick])

  const firstOverall = entries[0]
  const latestOverall = entries[entries.length - 1]
  const hasSavedGoal = Boolean(goal?.target_weight && goal?.target_date)

  const [range, setRange] = useState<TrendRange>('month')
  const [date, setDate] = useState(logDate || todayKey())
  const [time, setTime] = useState(localTimeHHMM())
  const [weight, setWeight] = useState('')
  const [mode, setMode] = useState<WeightGoalMode>(goal?.mode || 'maintain')
  const [startWeight, setStartWeight] = useState(
    goal?.start_weight
      ? String(goal.start_weight)
      : String(hasSavedGoal ? firstOverall?.weight ?? latestOverall?.weight ?? '' : latestOverall?.weight ?? ''),
  )
  const [startDate, setStartDate] = useState(goal?.start_date || (hasSavedGoal ? firstOverall?.date : todayKey()) || todayKey())
  const [targetWeight, setTargetWeight] = useState(goal?.target_weight ? String(goal.target_weight) : '')
  const [targetDate, setTargetDate] = useState(goal?.target_date || '')
  const [view, setView] = useState<'summary' | 'log' | 'goal'>('summary')

  const filtered = useMemo(() => {
    const start = rangeCutoff(range)
    if (!start) return entries
    return entries.filter((e) => e.date >= start)
  }, [entries, range])

  const average =
    filtered.length > 0 ? filtered.reduce((sum, e) => sum + e.weight, 0) / filtered.length : null
  const latest = filtered[filtered.length - 1]
  const first = filtered[0]
  const rangeChange = filtered.length > 1 && latest && first ? latest.weight - first.weight : null
  const rangeHigh = filtered.length ? Math.max(...filtered.map((e) => e.weight)) : null
  const rangeLow = filtered.length ? Math.min(...filtered.map((e) => e.weight)) : null
  const selectedRangeLabel = rangeLabel(range)

  function saveWeight(e: FormEvent) {
    e.preventDefault()
    const w = Number(weight)
    if (!w || w <= 0) {
      toast.error('Enter a weight')
      return
    }
    liftApi.logBodyWeight(userId, { weight: w, date, time })
    toast.success('Weight saved')
    const nextProgress = liftApi.weightGoalProgress(userId)
    const active = liftApi.getActiveWeightGoal(userId)
    if (active && nextProgress.goal != null && nextProgress.current != null) {
      const band = takeWeightProgressMilestone(userId, nextProgress.percent)
      if (band != null) {
        burstConfetti()
        offerShareWin(
          buildWeightProgressShareCard({
            mode: active.mode,
            current: nextProgress.current,
            target: nextProgress.goal,
            percent: nextProgress.percent,
          }),
        )
      }
    }
    setWeight('')
    setTime(localTimeHHMM())
    setView('summary')
    refresh()
  }

  function saveGoal(e: FormEvent) {
    e.preventDefault()
    const start = Number(startWeight)
    const target = Number(targetWeight)
    if (!start || start <= 0 || !target || target <= 0) {
      toast.error('Enter a starting weight and goal weight')
      return
    }
    if (!startDate || !targetDate) {
      toast.error('Enter a start date and target date')
      return
    }
    if (targetDate <= startDate) {
      toast.error('Target date needs to be after the start date')
      return
    }
    liftApi.setWeightGoal(userId, {
      mode,
      start_weight: start,
      target_weight: target,
      start_date: startDate,
      target_date: targetDate,
    })
    resetWeightProgressMilestones(userId)
    toast.success('Goal saved')
    setView('summary')
    refresh()
  }

  const stats = [
    filtered.length > 1 && average != null
      ? {
          label: 'Average',
          value: `${average.toFixed(1)} lb`,
          hint: `${filtered.length} check-in${filtered.length === 1 ? '' : 's'}`,
        }
      : null,
    rangeChange != null && Number.isFinite(rangeChange)
      ? {
          label: 'Change',
          value: `${rangeChange >= 0 ? '+' : ''}${rangeChange.toFixed(1)} lb`,
          hint: 'First to latest',
        }
      : null,
    filtered.length > 1 && rangeHigh != null
      ? { label: 'High', value: `${rangeHigh} lb`, hint: selectedRangeLabel }
      : null,
    filtered.length > 1 && rangeLow != null
      ? { label: 'Low', value: `${rangeLow} lb`, hint: selectedRangeLabel }
      : null,
  ].filter((stat): stat is { label: string; value: string; hint: string } => stat != null)

  return (
    <div className="space-y-3">
      {view === 'summary' && entries.length === 0 ? (
        <EmptyState
          compact
          plain
          icon={Scale}
          title="Log a weigh-in"
          description="A starting number is enough. Trends show up after a few entries."
          action={
            <Button type="button" className="gap-1.5" onClick={() => setView('log')}>
              <Plus className="h-4 w-4" />
              Log weight
            </Button>
          }
          secondaryAction={
            <Button type="button" variant="outline" onClick={() => setView('goal')}>
              {hasSavedGoal ? 'Edit goal' : 'Set goal'}
            </Button>
          }
        />
      ) : null}

      {view === 'summary' && entries.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="gap-1.5" onClick={() => setView('log')}>
              <Plus className="h-4 w-4" />
              Log weight
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setView('goal')}>
              {hasSavedGoal ? 'Edit goal' : 'Set goal'}
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg tracking-tight">
                  {latestOverall ? `${latestOverall.weight} lb` : ''}
                </h3>
                {latestOverall ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{formatLiftDate(latestOverall.date)}</p>
                ) : null}
              </div>
              <HealthSegmented options={TREND_RANGES} value={range} onChange={setRange} />
            </div>

            {stats.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                  <HealthStat key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} />
                ))}
              </div>
            ) : null}

            {filtered.length > 0 ? (
              <LiftLineChart
                data={filtered.map((e) => ({
                  date: e.date,
                  value: e.weight,
                  target: plan ? weeklyTargetOnDate(plan, e.date) : undefined,
                }))}
                label="Body weight"
              />
            ) : null}
            {plan && filtered.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Dashed line is the weekly-average goal pace. Daily weigh-ins will fluctuate around it.
              </p>
            ) : null}

            {progress.goal != null ? (
              <div>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Progress toward {formatLb(progress.goal)} lb
                    {plan ? ` · ${formatSignedLb(plan.weeklyChange)} / week` : ''}
                  </span>
                  <strong>{Math.round(progress.percent)}%</strong>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {plan ? <WeeklyTargetsCard plan={plan} /> : null}

          <div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h3 className="font-display text-lg tracking-tight">Weight history</h3>
              <span className="text-xs text-muted-foreground">{selectedRangeLabel}</span>
            </div>
            {filtered.length === 0 ? (
              <EmptyState
                compact
                plain
                title={`No weigh-ins in the ${selectedRangeLabel.toLowerCase()}`}
                description="Try a wider range."
                action={
                  range !== 'all' ? (
                    <Button type="button" variant="outline" onClick={() => setRange('all')}>
                      Show all time
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[22rem] text-sm">
                  <thead>
                    <tr className={healthTableHead}>
                      <th className="pb-2 pr-3">Date</th>
                      <th className="pb-2 pr-3">Time</th>
                      <th className="pb-2 pr-3">Weight</th>
                      <th className="pb-2 pr-3">Change</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {[...filtered].reverse().map((entry, idx, arr) => {
                      const older = arr[idx + 1]
                      const delta = older ? entry.weight - older.weight : null
                      return (
                        <tr key={entry.id} className="border-b border-border/40">
                          <td className={healthTableCell}>{formatLiftDate(entry.date)}</td>
                          <td className={`${healthTableCell} text-muted-foreground`}>
                            {entry.time ? formatMealTime(entry.time) : '—'}
                          </td>
                          <td className={healthTableCell}>{entry.weight} lb</td>
                          <td className={`${healthTableCell} text-muted-foreground`}>
                            {delta == null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`}
                          </td>
                          <td className="py-2 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Delete ${entry.weight} lb on ${formatLiftDate(entry.date)}`}
                              onClick={() => {
                                liftApi.removeBodyWeight(userId, entry.id)
                                refresh()
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

      {view === 'log' ? (
        <form onSubmit={saveWeight} className="kp-surface min-w-0 space-y-3 overflow-hidden p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg tracking-tight">Log weight</h3>
            <Button type="button" size="sm" variant="ghost" onClick={() => setView('summary')}>
              Cancel
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 *:min-w-0">
            <div>
              <HealthFieldLabel>Date</HealthFieldLabel>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
            </div>
            <div>
              <HealthFieldLabel>Time</HealthFieldLabel>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" />
            </div>
          </div>
          <QuantityInput
            {...QUANTITY.bodyWeightLb}
            placeholder="187.2"
            value={weight}
            onChange={setWeight}
          />
          <Button type="submit">Save weight</Button>
        </form>
      ) : null}

      {view === 'goal' ? (
        <form onSubmit={saveGoal} className="kp-surface min-w-0 space-y-3 overflow-hidden p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg tracking-tight">{hasSavedGoal ? 'Edit goal' : 'Set goal'}</h3>
            <Button type="button" size="sm" variant="ghost" onClick={() => setView('summary')}>
              Cancel
            </Button>
          </div>
          <div>
            <HealthFieldLabel>Goal type</HealthFieldLabel>
            <Select value={mode} onValueChange={(v) => setMode(v as WeightGoalMode)}>
              <SelectTrigger className="min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bulk">Bulk</SelectItem>
                <SelectItem value="cut">Cut</SelectItem>
                <SelectItem value="maintain">Maintain</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 *:min-w-0">
            <QuantityInput
              {...QUANTITY.bodyWeightLb}
              label="Starting weight"
              placeholder="Start lb"
              value={startWeight}
              onChange={setStartWeight}
            />
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="Start date" />
            <QuantityInput
              {...QUANTITY.bodyWeightLb}
              label="Target weight"
              placeholder="Target lb"
              value={targetWeight}
              onChange={setTargetWeight}
            />
            <Input
              type="date"
              value={targetDate || ''}
              onChange={(e) => setTargetDate(e.target.value)}
              aria-label="Target date"
            />
          </div>
          <Button type="submit">Save goal</Button>
          <p className="text-xs text-muted-foreground">
            {plan
              ? `${formatSignedLb(plan.weeklyChange)} each week, measured by weekly average, for ${plan.weeks.length} week${plan.weeks.length === 1 ? '' : 's'}`
              : 'Targets are weekly averages, paced evenly from your start weight to the goal date.'}
          </p>
        </form>
      ) : null}
    </div>
  )
}

function WeeklyTargetsCard({ plan }: { plan: WeightGoalPlan | null }) {
  if (!plan) {
    return (
      <div className="kp-surface p-4">
        <HealthCardHeader eyebrow="Weekly targets" title="Goal pace" />
        <p className="mt-2 text-sm text-muted-foreground">Set a start weight, a goal, and a date above.</p>
      </div>
    )
  }

  const currentWeek = plan.weeks.find((week) => week.isCurrent)
  const paceWeek =
    currentWeek && Number.isFinite(currentWeek.actual) ? currentWeek : latestWeekWithAverage(plan)
  const pace = getWeightGoalPaceStatus(
    paceWeek?.actual,
    paceWeek?.targetWeight,
    plan.weeklyChange,
    paceWeek?.checkInCount ?? 0,
  )
  const remaining = plan.weeks.filter((week) => !week.isPast).length
  const pastGoal = todayKey() > plan.targetDate
  const thisWeekNote = currentWeek
    ? `${formatLiftDate(currentWeek.weekStart)} – ${formatLiftDate(currentWeek.weekEnd)}`
    : pastGoal
      ? 'Goal date reached'
      : `Starts ${formatLiftDate(plan.startDate)}`

  return (
    <div className="kp-surface space-y-3 p-4">
      <HealthCardHeader
        eyebrow="Weekly targets"
        title={`${formatSignedLb(plan.weeklyChange)} / week`}
        description={`${formatLb(plan.startWeight)} lb → ${formatLb(plan.targetWeight)} lb · ${formatLiftDate(plan.startDate)} to ${formatLiftDate(plan.targetDate)}`}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <HealthStat
          label="This week avg"
          value={`${formatLb(currentWeek ? currentWeek.targetWeight : plan.targetWeight)} lb`}
          hint={thisWeekNote}
        />
        <HealthStat
          label="Remaining"
          value={pastGoal ? '0' : String(remaining)}
          hint={`${plan.weeks.length} week${plan.weeks.length === 1 ? '' : 's'} total · ${formatSignedLb(plan.totalChange)} overall`}
        />
        <HealthStat
          label="Pace"
          value={pace.label}
          hint={pace.note}
          valueClassName={
            pace.tone === 'ahead'
              ? 'text-emerald-600'
              : pace.tone === 'behind'
                ? 'text-destructive'
                : undefined
          }
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className={healthTableHead}>
              <th className="pb-2 pr-3">Week</th>
              <th className="pb-2 pr-3">Start</th>
              <th className="pb-2 pr-3">End</th>
              <th className="pb-2 pr-3">Avg target</th>
              <th className="pb-2 pr-3">Change</th>
              <th className="pb-2 pr-3">Weekly avg</th>
              <th className="pb-2">Vs target</th>
            </tr>
          </thead>
          <tbody>
            {plan.weeks.map((week) => {
              const vsTarget = Number.isFinite(week.actual) ? Number(week.actual) - week.targetWeight : null
              return (
                <tr
                  key={week.week}
                  className={cn('border-b border-border/40', week.isCurrent && 'bg-primary/5')}
                >
                  <td className="py-2 pr-3">
                    Week {week.week}
                    {week.isCurrent ? (
                      <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
                        Now
                      </span>
                    ) : week.isFinal ? (
                      <span className="ml-2 rounded-full border border-border/60 px-2 py-0.5 text-[0.65rem] font-semibold">
                        Goal
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3">{formatLiftDate(week.weekStart)}</td>
                  <td className="py-2 pr-3">{formatLiftDate(week.weekEnd)}</td>
                  <td className="py-2 pr-3">{formatLb(week.targetWeight)} lb</td>
                  <td className="py-2 pr-3">{formatSignedLb(week.change)}</td>
                  <td className="py-2 pr-3">
                    {Number.isFinite(week.actual) ? (
                      <>
                        {formatLb(week.actual)} lb{' '}
                        <span className="text-muted-foreground">({week.checkInCount})</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2">{vsTarget == null ? '—' : formatSignedLb(vsTarget)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
