import { useMemo, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { liftApi } from '../../lift-api'
import type { LiftProgressMetric } from '../../types'
import { formatLiftDate, LiftLineChart } from './LiftLineChart'
import { HealthCardHeader, HealthFieldLabel, HealthStat, healthTableCell, healthTableHead } from '../health-ui'

type Props = {
  userId: string
  tick: number
}

const METRICS: { value: LiftProgressMetric; label: string }[] = [
  { value: 'topWeight', label: 'Top weight' },
  { value: 'estimated1RM', label: 'Estimated 1RM' },
  { value: 'volume', label: 'Session volume' },
]

export function LiftProgressPanel({ userId, tick }: Props) {
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
  const first = data[0]
  const change = data.length > 1 ? latest.value - first.value : null
  const best = data.length ? Math.max(...data.map((d) => d.value)) : null
  const metricLabel = METRICS.find((m) => m.value === metric)?.label || metric

  return (
    <div className="space-y-5">
      <div className="kp-surface space-y-5 p-4 sm:p-5">
        <HealthCardHeader eyebrow="Performance" title={selected || 'No exercises yet'} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <HealthFieldLabel>Exercise</HealthFieldLabel>
            {names.length === 0 ? (
              <p className="rounded-md border border-border/50 px-3 py-2 text-sm text-muted-foreground">
                Log a workout first
              </p>
            ) : (
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
            )}
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

        <div className="grid gap-3 sm:grid-cols-4">
          <HealthStat label="Logged sessions" value={String(data.length)} hint="For this exercise" />
          <HealthStat
            label="Latest"
            value={latest ? `${Math.round(latest.value).toLocaleString()} lb` : '—'}
            hint={latest ? formatLiftDate(latest.date) : 'No data'}
          />
          <HealthStat
            label="Change"
            value={change != null ? `${change >= 0 ? '+' : ''}${Math.round(change)} lb` : '—'}
            hint={data.length > 1 ? 'First to latest' : 'Need 2 sessions'}
          />
          <HealthStat
            label="Best"
            value={best != null ? `${Math.round(best).toLocaleString()} lb` : '—'}
            hint={metricLabel}
          />
        </div>

        <LiftLineChart data={data.map((d) => ({ date: d.date, value: d.value }))} label={metricLabel} />
      </div>

      <div className="kp-surface p-4 sm:p-5">
        <HealthCardHeader eyebrow="Log" title="Exercise history" />
        {data.length === 0 ? (
          <EmptyState
            title="No progress yet"
            description="Log an exercise in a workout to generate a graph."
            className="mt-3"
          />
        ) : (
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
        )}
      </div>
    </div>
  )
}
