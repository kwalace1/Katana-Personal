import { FormEvent, useMemo, useState } from 'react'
import { Lock, Plus, Share2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { liftApi, SPLIT_PRESETS } from '../../lift-api'
import type { SplitDay, SplitPattern } from '../../types'
import { cn } from '@/lib/utils'
import { PlusPaywallSheet, usePlusStatus } from '@/components/PlusPaywall'
import { WORKOUT_PROGRAMS, type WorkoutProgram } from '../../workout-programs'
import { ShareAudiencePicker, type ShareAudienceSelection } from '@/components/ShareAudiencePicker'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { shareSuccessMessage, shareWithAudience } from '@/lib/social/share-with-audience'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { TrainingSplit } from '../../types'

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
  const [plusOpen, setPlusOpen] = useState(false)
  const plus = usePlusStatus()
  const { cloudUser } = useCloudAuth()
  const [shareSplit, setShareSplit] = useState<TrainingSplit | null>(null)
  const [selectedFriends, setSelectedFriends] = useState<Record<string, boolean>>({})
  const [selectedCircles, setSelectedCircles] = useState<Record<string, boolean>>({})
  const [audience, setAudience] = useState<ShareAudienceSelection>({
    friendIds: [],
    circles: [],
    hasAny: false,
  })
  const [sharing, setSharing] = useState(false)

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

  function applyProgram(program: WorkoutProgram) {
    if (program.premium && !plus) {
      setPlusOpen(true)
      return
    }
    setName(program.name)
    setPattern(program.pattern)
    setDays(
      program.days.map((day) => ({
        ...day,
        exercises: day.exercises?.map((exercise) => ({ ...exercise })),
      })),
    )
    toast.message(`${program.name} loaded — review and save it`)
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
        exercises: d.exercises?.map((exercise) => ({ ...exercise })),
      })),
      active: true,
    })
    toast.success('Split saved')
    setName('')
    setPattern('cycle')
    setDays(cycleDays(4))
    refresh()
  }

  async function shareSelectedSplit() {
    if (!shareSplit || !cloudUser || !audience.hasAny || sharing) return
    setSharing(true)
    try {
      const result = await shareWithAudience({
        kind: 'training_split',
        title: shareSplit.name,
        body: `${shareSplit.days.length}-day ${shareSplit.pattern === 'cycle' ? 'repeating cycle' : 'weekday plan'}`,
        data: {
          split: {
            name: shareSplit.name,
            pattern: shareSplit.pattern,
            days: shareSplit.days.map((day) => ({
              name: day.name,
              focus: day.focus,
              exercises: day.exercises?.map((exercise) => ({ ...exercise })) || [],
            })),
          },
        },
        ownerId: cloudUser.uid,
        friendIds: audience.friendIds,
        circles: audience.circles,
        activityFeed: true,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(shareSuccessMessage(result))
      setShareSplit(null)
      setSelectedFriends({})
      setSelectedCircles({})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t share split')
    } finally {
      setSharing(false)
    }
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

        <div className="space-y-2">
          <div>
            <p className="text-xs text-muted-foreground">Pre-made programs</p>
            <h4 className="font-medium">Pick a proven starting point</h4>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {WORKOUT_PROGRAMS.map((program) => (
              <button
                key={program.id}
                type="button"
                onClick={() => applyProgram(program)}
                className="rounded-2xl border border-border/60 bg-card/50 p-3 text-left transition hover:border-primary/35 hover:bg-secondary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{program.name}</p>
                  {program.premium && !plus ? (
                    <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {program.level} · {program.daysPerWeek} days/week
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {program.description}
                </p>
              </button>
            ))}
          </div>
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
                        <li key={`${split.id}-${i}`} className="border-t border-border/30 py-1.5 first:border-0">
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">{d.name}</span>
                            <span>{d.focus || 'Rest'}</span>
                          </div>
                          {d.exercises?.length ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {d.exercises
                                .map((exercise) => `${exercise.name} ${exercise.sets}×${exercise.reps}`)
                                .join(' · ')}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!cloudUser) {
                          toast.message('Connect Social in Settings to share a split')
                          return
                        }
                        setShareSplit(split)
                      }}
                    >
                      <Share2 className="mr-1 h-3.5 w-3.5" />
                      Share
                    </Button>
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
      <Dialog open={Boolean(shareSplit)} onOpenChange={(open) => !open && setShareSplit(null)}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share {shareSplit?.name}</DialogTitle>
          </DialogHeader>
          {cloudUser ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Friends receive the complete plan and can import their own copy.
              </p>
              <ShareAudiencePicker
                uid={cloudUser.uid}
                selectedFriends={selectedFriends}
                selectedCircles={selectedCircles}
                onFriendsChange={setSelectedFriends}
                onCirclesChange={setSelectedCircles}
                onAudienceChange={setAudience}
                compact
              />
              <Button
                className="w-full"
                disabled={!audience.hasAny || sharing}
                onClick={() => void shareSelectedSplit()}
              >
                {sharing ? 'Sharing…' : 'Share complete split'}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <PlusPaywallSheet open={plusOpen} onOpenChange={setPlusOpen} feature="programs" />
    </div>
  )
}
