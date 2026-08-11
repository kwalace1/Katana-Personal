import { FormEvent, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QuantityInput, QUANTITY } from '@/components/ui/quantity-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { addDays, todayKey } from '@/lib/dates'
import { burstConfetti } from '@/lib/celebrate'
import { cn } from '@/lib/utils'
import {
  buildWeightProgressShareCard,
  offerShareWin,
  resetWeightProgressMilestones,
  takeWeightProgressMilestone,
} from '@/lib/social/share-win'
import { formatMealTime } from '../../api'
import { liftApi } from '../../lift-api'
import type { WeightGoalMode } from '../../types'
import { formatLiftDate, LiftLineChart } from './LiftLineChart'

type Props = {
  userId: string
  logDate: string
  tick: number
  refresh: () => void
}

type TrendRange = 'week' | 'month' | 'year' | 'all'

const TREND_RANGES: { id: TrendRange; label: string; days: number | null }[] = [
  { id: 'week', label: 'Week', days: 7 },
  { id: 'month', label: 'Month', days: 30 },
  { id: 'year', label: 'Year', days: 365 },
  { id: 'all', label: 'All time', days: null },
]

function localTimeHHMM(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function cutoffKey(days: number) {
  return todayKey(addDays(new Date(), -(days - 1)))
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

  const progress = useMemo(() => {
    void tick
    return liftApi.weightGoalProgress(userId)
  }, [userId, tick])

  const [range, setRange] = useState<TrendRange>('month')
  const [date, setDate] = useState(logDate || todayKey())
  const [time, setTime] = useState(localTimeHHMM())
  const [weight, setWeight] = useState('')
  const [mode, setMode] = useState<WeightGoalMode>(goal?.mode || 'maintain')
  const [targetWeight, setTargetWeight] = useState(goal?.target_weight ? String(goal.target_weight) : '')
  const [targetDate, setTargetDate] = useState(goal?.target_date || '')

  const filtered = useMemo(() => {
    const meta = TREND_RANGES.find((r) => r.id === range) || TREND_RANGES[1]!
    if (meta.days == null) return entries
    const start = cutoffKey(meta.days)
    return entries.filter((e) => e.date >= start)
  }, [entries, range])

  const average =
    filtered.length > 0
      ? filtered.reduce((sum, e) => sum + e.weight, 0) / filtered.length
      : null
  const latest = filtered[filtered.length - 1] ?? entries[entries.length - 1]
  const first = entries[0]
  const rangeLabel = TREND_RANGES.find((r) => r.id === range)?.label || 'Month'

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
    const target = Number(targetWeight)
    if (!target || target <= 0) {
      toast.error('Enter a target weight')
      return
    }
    const start = first?.weight ?? latest?.weight ?? target
    liftApi.setWeightGoal(userId, {
      mode,
      start_weight: start,
      target_weight: target,
      start_date: first?.date || todayKey(),
      target_date: targetDate || null,
    })
    resetWeightProgressMilestones(userId)
    toast.success('Goal saved')
    refresh()
  }

  return (
    <div className="space-y-4">
      <div className="kp-surface space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Bodyweight trend</p>
            <h3 className="font-display text-2xl tracking-tight">
              {latest ? `${latest.weight} lb` : 'No entries yet'}
            </h3>
            {average != null ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Avg {rangeLabel.toLowerCase()} · {average.toFixed(1)} lb
                {filtered.length ? ` · ${filtered.length} check-in${filtered.length === 1 ? '' : 's'}` : ''}
              </p>
            ) : null}
          </div>
          {progress.delta != null ? (
            <span className="rounded-full border border-border/60 px-3 py-1 text-sm">
              {progress.delta >= 0 ? '+' : ''}
              {progress.delta.toFixed(1)} lb total
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TREND_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                range === r.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/80 text-muted-foreground hover:text-foreground',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        <LiftLineChart
          data={filtered.map((e) => ({ date: e.date, value: e.weight }))}
          label="Body weight"
        />

        {progress.goal != null ? (
          <div>
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-muted-foreground">Progress toward {progress.goal} lb</span>
              <strong>{Math.round(progress.percent)}%</strong>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            {goal?.target_date ? (
              <p className="mt-1 text-xs text-muted-foreground">Target date · {formatLiftDate(goal.target_date)}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <form onSubmit={saveWeight} className="kp-surface min-w-0 space-y-3 overflow-hidden p-4">
          <div>
            <p className="text-xs text-muted-foreground">Check-in</p>
            <h3 className="font-display text-lg tracking-tight">Log weight</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 *:min-w-0">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" />
          </div>
          <QuantityInput
            {...QUANTITY.bodyWeightLb}
            placeholder="187.2"
            value={weight}
            onChange={setWeight}
          />
          <Button type="submit">Save weight</Button>
        </form>

        <form onSubmit={saveGoal} className="kp-surface min-w-0 space-y-3 overflow-hidden p-4">
          <div>
            <p className="text-xs text-muted-foreground">Goal</p>
            <h3 className="font-display text-lg tracking-tight">Bulk, cut, or maintain</h3>
          </div>
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
          <div className="grid gap-3 sm:grid-cols-2 *:min-w-0">
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
        </form>
      </div>

      <div className="kp-surface p-4">
        <h3 className="mb-3 font-display text-lg tracking-tight">History</h3>
        {entries.length === 0 ? (
          <EmptyState title="No weight logs" description="Log a check-in to start the trend." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Date</th>
                  <th className="pb-2 pr-3 font-medium">Time</th>
                  <th className="pb-2 pr-3 font-medium">Weight</th>
                  <th className="pb-2 pr-3 font-medium">Change</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {[...entries].reverse().map((entry, idx, arr) => {
                  // arr is newest-first; previous chronological is the next item
                  const older = arr[idx + 1]
                  const delta = older ? entry.weight - older.weight : null
                  return (
                    <tr key={entry.id} className="border-b border-border/40">
                      <td className="py-2 pr-3">{formatLiftDate(entry.date)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {entry.time ? formatMealTime(entry.time) : '—'}
                      </td>
                      <td className="py-2 pr-3">{entry.weight} lb</td>
                      <td className="py-2 pr-3 text-muted-foreground">
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
