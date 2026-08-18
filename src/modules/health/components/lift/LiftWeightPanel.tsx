import { FormEvent, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QuantityInput, QUANTITY } from '@/components/ui/quantity-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
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
    refresh()
  }

  return (
    <div className="space-y-5">
      <div className="kp-surface space-y-5 p-4 sm:p-5">
        <HealthCardHeader
          eyebrow="Bodyweight trend"
          title={latestOverall ? `${latestOverall.weight} lb` : 'No entries yet'}
          actions={<HealthSegmented options={TREND_RANGES} value={range} onChange={setRange} />}
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <HealthStat
            label="Average"
            value={average == null ? '—' : `${average.toFixed(1)} lb`}
            hint={filtered.length ? `${filtered.length} check-in${filtered.length === 1 ? '' : 's'}` : 'No data'}
          />
          <HealthStat
            label="Change"
            value={rangeChange == null ? '—' : `${rangeChange >= 0 ? '+' : ''}${rangeChange.toFixed(1)} lb`}
            hint={filtered.length > 1 ? 'First to latest' : 'Need 2 weigh-ins'}
          />
          <HealthStat
            label="High"
            value={rangeHigh == null ? '—' : `${rangeHigh} lb`}
            hint={filtered.length ? selectedRangeLabel : 'No data'}
          />
          <HealthStat
            label="Low"
            value={rangeLow == null ? '—' : `${rangeLow} lb`}
            hint={filtered.length ? selectedRangeLabel : 'No data'}
          />
        </div>

        <LiftLineChart
          data={filtered.map((e) => ({
            date: e.date,
            value: e.weight,
            target: plan ? weeklyTargetOnDate(plan, e.date) : undefined,
          }))}
          label="Body weight"
        />
        {plan && filtered.length ? (
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

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <form onSubmit={saveWeight} className="kp-surface min-w-0 space-y-4 overflow-hidden p-4 sm:p-5">
          <HealthCardHeader eyebrow="Check-in" title="Log weight" />
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

        <form onSubmit={saveGoal} className="kp-surface min-w-0 space-y-4 overflow-hidden p-4 sm:p-5">
          <HealthCardHeader eyebrow="Goal" title="Set direction" />
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
      </div>

      <WeeklyTargetsCard plan={plan} />

      <div className="kp-surface p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <HealthCardHeader eyebrow="Log" title="Weight history" />
          <span className="text-xs text-muted-foreground">{selectedRangeLabel}</span>
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            title={entries.length ? `No weigh-ins in the ${selectedRangeLabel.toLowerCase()}` : 'No weight logs'}
            description={
              entries.length
                ? 'Try a wider range or log a new check-in.'
                : 'Log a check-in to start the trend.'
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
    </div>
  )
}

function WeeklyTargetsCard({ plan }: { plan: WeightGoalPlan | null }) {
  if (!plan) {
    return (
      <div className="kp-surface p-4 sm:p-5">
        <HealthCardHeader eyebrow="Weekly targets" title="Goal pace" />
        <EmptyState
          title="Set a start, goal, and date"
          description="A 5 lb gain over 20 weeks becomes +0.25 lb each week."
          className="mt-3"
        />
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
    <div className="kp-surface space-y-5 p-4 sm:p-5">
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
