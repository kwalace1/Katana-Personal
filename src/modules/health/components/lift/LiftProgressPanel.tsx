import { useMemo, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { liftApi } from '../../lift-api'
import type { LiftProgressMetric } from '../../types'
import { formatLiftDate, LiftLineChart } from './LiftLineChart'

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
    return liftApi.getExerciseNames(userId)
  }, [userId, tick])

  const [exercise, setExercise] = useState(names[0] || 'Bench Press')
  const [metric, setMetric] = useState<LiftProgressMetric>('topWeight')

  // Keep selection valid when names load/change
  const selected = names.includes(exercise) ? exercise : names[0] || exercise

  const data = useMemo(() => {
    void tick
    return liftApi.getExerciseProgress(userId, selected, metric)
  }, [userId, selected, metric, tick])

  const latest = data[data.length - 1]
  const first = data[0]
  const change = data.length > 1 ? latest.value - first.value : null
  const best = data.length ? Math.max(...data.map((d) => d.value)) : null
  const metricLabel = METRICS.find((m) => m.value === metric)?.label || metric

  return (
    <div className="space-y-4">
      <div className="kp-surface space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Exercise</p>
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
            <p className="mb-1 text-xs text-muted-foreground">Metric</p>
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
          <Stat label="Logged sessions" value={String(data.length)} hint="For this exercise" />
          <Stat
            label="Latest"
            value={latest ? `${Math.round(latest.value).toLocaleString()} lb` : '—'}
            hint={latest ? formatLiftDate(latest.date) : 'No data'}
          />
          <Stat
            label="Change"
            value={change != null ? `${change >= 0 ? '+' : ''}${Math.round(change)} lb` : '—'}
            hint={data.length > 1 ? 'First to latest' : 'Need 2 sessions'}
          />
          <Stat
            label="Best"
            value={best != null ? `${Math.round(best).toLocaleString()} lb` : '—'}
            hint={metricLabel}
          />
        </div>

        <LiftLineChart data={data.map((d) => ({ date: d.date, value: d.value }))} label={metricLabel} />
      </div>

      <div className="kp-surface p-4">
        <h3 className="mb-3 font-display text-lg tracking-tight">Exercise history</h3>
        {data.length === 0 ? (
          <EmptyState title="No progress yet" description="Log this exercise in a workout to generate a graph." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Date</th>
                  <th className="pb-2 pr-3 font-medium">Workout</th>
                  <th className="pb-2 pr-3 font-medium">{metricLabel}</th>
                  <th className="pb-2 font-medium">Working sets</th>
                </tr>
              </thead>
              <tbody>
                {[...data].reverse().map((row) => (
                  <tr key={`${row.session_id}-${row.date}`} className="border-b border-border/40">
                    <td className="py-2 pr-3">{formatLiftDate(row.date)}</td>
                    <td className="py-2 pr-3">{row.workoutName}</td>
                    <td className="py-2 pr-3">{Math.round(row.value).toLocaleString()} lb</td>
                    <td className="py-2 text-muted-foreground">{row.setSummary}</td>
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

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-secondary/15 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-xl tracking-tight">{value}</p>
      <p className="text-[0.7rem] text-muted-foreground">{hint}</p>
    </div>
  )
}
