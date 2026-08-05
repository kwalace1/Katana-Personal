import { FormEvent, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { liftApi, SPLIT_PRESETS } from '../../lift-api'
import type { SplitDay, SplitPattern } from '../../types'
import { cn } from '@/lib/utils'

type Props = {
  userId: string
  tick: number
  refresh: () => void
}

const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Tracker weekday mode is Mon–Sun; Katana weekdays pattern is Sun–Sat indexed by getDay(). */
function weekdayDaysFromTrackerLabels(workouts: string[]): SplitDay[] {
  // Map Mon..Sun labels → Sun..Sat day array for plannedDay()
  const byLabel: Record<string, string> = {}
  WEEKDAY_LABELS.forEach((label, i) => {
    byLabel[label] = workouts[i] || ''
  })
  const sunSat = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return sunSat.map((label) => ({
    name: label,
    focus: byLabel[label] || '',
  }))
}

function cycleDays(count: number): SplitDay[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `Day ${i + 1}`,
    focus: '',
  }))
}

export function LiftSplitsPanel({ userId, tick, refresh }: Props) {
  const splits = useMemo(() => {
    void tick
    return liftApi.listSplits(userId)
  }, [userId, tick])

  const [name, setName] = useState('')
  const [pattern, setPattern] = useState<SplitPattern>('cycle')
  const [days, setDays] = useState<SplitDay[]>(cycleDays(4))

  function switchPattern(next: SplitPattern) {
    setPattern(next)
    if (next === 'weekdays') {
      setDays(weekdayDaysFromTrackerLabels(Array(7).fill('')))
    } else {
      setDays(cycleDays(4))
    }
  }

  function applyPreset(preset: (typeof SPLIT_PRESETS)[number]) {
    setName(preset.name)
    setPattern(preset.pattern)
    setDays(preset.days.map((d) => ({ ...d })))
  }

  function save(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Name your split')
      return
    }
    if (days.length === 0) return
    liftApi.saveSplit(userId, {
      name: name.trim(),
      pattern,
      days: days.map((d) => ({
        name: d.name.trim() || 'Day',
        focus: d.focus.trim(),
      })),
      active: true,
    })
    toast.success('Split saved')
    setName('')
    setPattern('cycle')
    setDays(cycleDays(4))
    refresh()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="kp-surface space-y-4 p-4">
        <div>
          <p className="text-xs text-muted-foreground">Training split</p>
          <h3 className="font-display text-xl tracking-tight">Create split</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {SPLIT_PRESETS.map((preset) => (
            <Button key={preset.name} type="button" size="sm" variant="outline" className="rounded-full" onClick={() => applyPreset(preset)}>
              {preset.name}
            </Button>
          ))}
        </div>

        <Input placeholder="Split name" value={name} onChange={(e) => setName(e.target.value)} />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={pattern === 'cycle' ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => switchPattern('cycle')}
          >
            Repeating cycle
          </Button>
          <Button
            type="button"
            size="sm"
            variant={pattern === 'weekdays' ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => switchPattern('weekdays')}
          >
            Weekday plan
          </Button>
        </div>

        <div className="space-y-2">
          {days.map((day, index) => (
            <div key={`${day.name}-${index}`} className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
              {pattern === 'cycle' ? (
                <Input
                  value={day.name}
                  onChange={(e) =>
                    setDays((rows) => rows.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)))
                  }
                  aria-label={`Day ${index + 1} label`}
                />
              ) : (
                <div className="flex items-center text-sm font-medium text-muted-foreground">{day.name}</div>
              )}
              <Input
                placeholder={pattern === 'weekdays' ? 'Workout (blank = rest)' : 'Focus / workout'}
                value={day.focus}
                onChange={(e) =>
                  setDays((rows) => rows.map((r, i) => (i === index ? { ...r, focus: e.target.value } : r)))
                }
              />
              {pattern === 'cycle' ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={days.length <= 1}
                  onClick={() => setDays((rows) => rows.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>

        {pattern === 'cycle' ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setDays((rows) => [...rows, { name: `Day ${rows.length + 1}`, focus: '' }])}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add day
          </Button>
        ) : null}

        <Button type="submit">Save split</Button>
      </form>

      <div>
        <h3 className="mb-2 font-display text-lg tracking-tight">Saved splits</h3>
        {splits.length === 0 ? (
          <EmptyState title="No splits yet" description="Save a cycle or weekday plan above." />
        ) : (
          <ul className="space-y-2">
            {splits.map((split) => (
              <li
                key={split.id}
                className={cn(
                  'kp-surface p-4',
                  split.active && 'ring-2 ring-primary/30',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {split.name}
                      {split.active ? (
                        <span className="ml-2 text-xs font-semibold text-primary">Active</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {split.pattern === 'cycle' ? 'Repeating cycle' : 'Weekday'} · {split.days.length} days
                    </p>
                    <ul className="mt-2 space-y-0.5 text-sm">
                      {split.days.map((d, i) => (
                        <li key={`${split.id}-${i}`} className="flex justify-between gap-3">
                          <span className="text-muted-foreground">{d.name}</span>
                          <span>{d.focus || 'Rest'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex gap-2">
                    {!split.active ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          liftApi.setActiveSplit(userId, split.id)
                          refresh()
                          toast.success('Split activated')
                        }}
                      >
                        Set active
                      </Button>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        liftApi.removeSplit(userId, split.id)
                        refresh()
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
