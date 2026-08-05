import { FormEvent, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { todayKey } from '@/lib/dates'
import { liftApi } from '../../lift-api'
import type { WeightGoalMode } from '../../types'
import { formatLiftDate, LiftLineChart } from './LiftLineChart'

type Props = {
  userId: string
  logDate: string
  tick: number
  refresh: () => void
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

  const [date, setDate] = useState(logDate || todayKey())
  const [weight, setWeight] = useState('')
  const [mode, setMode] = useState<WeightGoalMode>(goal?.mode || 'maintain')
  const [targetWeight, setTargetWeight] = useState(goal?.target_weight ? String(goal.target_weight) : '')
  const [targetDate, setTargetDate] = useState(goal?.target_date || '')

  const latest = entries[entries.length - 1]
  const first = entries[0]

  function saveWeight(e: FormEvent) {
    e.preventDefault()
    const w = Number(weight)
    if (!w || w <= 0) {
      toast.error('Enter a weight')
      return
    }
    liftApi.logBodyWeight(userId, { weight: w, date })
    toast.success('Weight saved')
    setWeight('')
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
          </div>
          {progress.delta != null ? (
            <span className="rounded-full border border-border/60 px-3 py-1 text-sm">
              {progress.delta >= 0 ? '+' : ''}
              {progress.delta.toFixed(1)} lb total
            </span>
          ) : null}
        </div>

        <LiftLineChart
          data={entries.map((e) => ({ date: e.date, value: e.weight }))}
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

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={saveWeight} className="kp-surface space-y-3 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Check-in</p>
            <h3 className="font-display text-lg tracking-tight">Log weight</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input
              type="number"
              min={1}
              step={0.1}
              placeholder="187.2"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <Button type="submit">Save weight</Button>
        </form>

        <form onSubmit={saveGoal} className="kp-surface space-y-3 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Goal</p>
            <h3 className="font-display text-lg tracking-tight">Bulk, cut, or maintain</h3>
          </div>
          <Select value={mode} onValueChange={(v) => setMode(v as WeightGoalMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bulk">Bulk</SelectItem>
              <SelectItem value="cut">Cut</SelectItem>
              <SelectItem value="maintain">Maintain</SelectItem>
            </SelectContent>
          </Select>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="number"
              min={1}
              step={0.1}
              placeholder="Target lb"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
            />
            <Input type="date" value={targetDate || ''} onChange={(e) => setTargetDate(e.target.value)} />
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
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Date</th>
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
