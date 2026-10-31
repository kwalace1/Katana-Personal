import { useMemo, useState } from 'react'
import { Dumbbell, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { liftApi } from '../../lift-api'
import type { LiftProgressMetric, LiftProgressPoint } from '../../types'
import { formatLiftDate, LiftLineChart } from './LiftLineChart'
import { HealthCardHeader, HealthFieldLabel, HealthStat, healthTableCell, healthTableHead } from '../health-ui'

type Props = {
  userId: string
  tick: number
  onGoLift?: () => void
}

function formatProgressValue(value: number) {
  return `${Math.round(value).toLocaleString()} lb`
}

function formatProgressChange(value: number) {
  return `${value >= 0 ? '+' : ''}${Math.round(value)} lb`
}

function comparableChange(data: LiftProgressPoint[]): number | null {
  if (data.length < 2) return null
  const first = data[0]
  const latest = data[data.length - 1]
  if (!first || !latest || !Number.isFinite(first.value) || !Number.isFinite(latest.value)) return null
  return latest.value - first.value
}

function statColumns(count: number) {
  if (count >= 4) return 'sm:grid-cols-4'
  if (count === 3) return 'sm:grid-cols-3'
  if (count === 2) return 'sm:grid-cols-2'
  return undefined
}

const METRICS: { value: LiftProgressMetric; label: string }[] = [
  { value: 'topWeight', label: 'Top weight' },
  { value: 'estimated1RM', label: 'Estimated 1RM' },
  { value: 'volume', label: 'Session volume' },
]

export function LiftProgressPanel({ userId, tick, onGoLift }: Props) {
  const names = useMemo(() => {
    void tick
    return liftApi.getLoggedExerciseNames(userId)
  }, [userId, tick])

  const [exercise, setExercise] = useState('')
  const [metric, setMetric] = useState<LiftProgressMetric>('topWeight')

  // Keep selection valid when names load/change
  const selected = names.includes(exercise) ? exercise : names[0] || ''

  const data = useMemo(() => {
    void tick
    if (!selected) return []
    return liftApi.getExerciseProgress(userId, selected, metric)
  }, [userId, selected, metric, tick])

  const latest = data[data.length - 1]
  const best = data.length ? Math.max(...data.map((d) => d.value)) : null
  const change = comparableChange(data)
  const metricLabel = METRICS.find((m) => m.value === metric)?.label || metric
  const stats = [
    data.length > 0
      ? { label: 'Logged sessions', value: String(data.length), hint: 'For this exercise' }
      : null,
    latest && Number.isFinite(latest.value)
      ? { label: 'Latest', value: formatProgressValue(latest.value), hint: formatLiftDate(latest.date) }
      : null,
    change != null
      ? { label: 'Change', value: formatProgressChange(change), hint: 'First to latest' }
      : null,
    best != null && Number.isFinite(best)
      ? { label: 'Best', value: formatProgressValue(best), hint: metricLabel }
      : null,
  ].filter((stat): stat is { label: string; value: string; hint: string } => stat != null)

  if (names.length === 0) {
    return (
      <EmptyState
        compact
        plain
        icon={Dumbbell}
        title="No workouts yet"
        description="Charts appear after you log a session."
        action={
          onGoLift ? (
            <Button type="button" className="gap-1.5" onClick={onGoLift}>
              <Plus className="h-4 w-4" />
              Log a session
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="kp-surface space-y-3 p-4">
        <HealthCardHeader eyebrow="Performance" title={selected} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <HealthFieldLabel>Exercise</HealthFieldLabel>
            <Select value={selected} onValueChange={setExercise}>
              <SelectTrigger>
                <SelectValue placeholder="Exercise" />
              </SelectTrigger>
              <SelectContent>
                {names.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <HealthFieldLabel>Metric</HealthFieldLabel>
            <Select value={metric} onValueChange={(v) => setMetric(v as LiftProgressMetric)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRICS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {stats.length > 0 ? (
          <div className={cn('grid gap-3', statColumns(stats.length))}>
            {stats.map((stat) => (
              <HealthStat key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} />
            ))}
          </div>
        ) : null}

        {data.length > 0 ? (
          <LiftLineChart data={data.map((d) => ({ date: d.date, value: d.value }))} label={metricLabel} />
        ) : null}
      </div>

      {data.length > 0 ? (
        <div className="kp-surface p-4">
          <HealthCardHeader eyebrow="Log" title="Exercise history" />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className={healthTableHead}>
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Workout</th>
                  <th className="pb-2 pr-3">{metricLabel}</th>
                  <th className="pb-2">Working sets</th>
                </tr>
              </thead>
              <tbody>
                {[...data].reverse().map((row) => (
                  <tr key={`${row.session_id}-${row.date}`} className="border-b border-border/40">
                    <td className={healthTableCell}>{formatLiftDate(row.date)}</td>
                    <td className={healthTableCell}>{row.workoutName}</td>
                    <td className={healthTableCell}>{Math.round(row.value).toLocaleString()} lb</td>
                    <td className={`${healthTableCell} text-muted-foreground`}>{row.setSummary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
