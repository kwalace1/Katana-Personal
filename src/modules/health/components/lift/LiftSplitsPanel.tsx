import { FormEvent, useMemo, useState } from 'react'
import { Plus, Share2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import {
  EXERCISE_LIBRARY_NAMES,
  formatRepRange,
  formatSplitExerciseLine,
  liftApi,
  parseRepRange,
  SPLIT_PRESETS,
} from '../../lift-api'
import type { SplitDay, SplitPattern } from '../../types'
import { cn } from '@/lib/utils'
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
import { todayKey } from '@/lib/dates'
import {
  bumpLiftDraftKeyCounter,
  emptyLiftDraftExercise,
  writeLiftDraft,
} from '../../lift-draft'

type Props = {
  userId: string
  tick: number
  refresh: () => void
  onGoLift?: () => void
}

type DraftExercise = { key: string; name: string; sets: string; repMin: string; repMax: string }
type DraftDay = { key: string; name: string; focus: string; exercises: DraftExercise[] }

const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

let splitDraftKey = 0
function nextSplitKey(prefix: string) {
  splitDraftKey += 1
  return `${prefix}-${splitDraftKey}`
}

function exercisesToDraft(
  exercises: SplitDay['exercises'] | undefined,
): DraftExercise[] {
  return (exercises || []).map((exercise) => {
    const range = parseRepRange(exercise.reps)
    return {
      key: nextSplitKey('ex'),
      name: exercise.name,
      sets: exercise.sets > 0 ? String(exercise.sets) : '',
      repMin: range.min,
      repMax: range.max,
    }
  })
}

function draftToExercises(exercises: DraftExercise[]): SplitDay['exercises'] {
  return exercises
    .map((exercise) => ({
      name: exercise.name.trim(),
      sets: Math.max(0, Math.round(Number(exercise.sets) || 0)),
      reps: formatRepRange(exercise.repMin, exercise.repMax),
    }))
    .filter((exercise) => exercise.name)
}

function weekdayDaysFromTrackerLabels(workouts: string[], previous?: DraftDay[]): DraftDay[] {
  const byLabel: Record<string, string> = {}
  WEEKDAY_LABELS.forEach((label, i) => {
    byLabel[label] = workouts[i] || previous?.[i]?.focus || ''
  })
  const sunSat = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return sunSat.map((label, i) => ({
    key: previous?.[i]?.key || nextSplitKey('day'),
    name: label,
    focus: byLabel[label] || previous?.[i]?.focus || '',
    exercises: previous?.[i]?.exercises?.map((exercise) => ({ ...exercise })) || [],
  }))
}

function cycleDays(count: number, previous?: DraftDay[]): DraftDay[] {
  return Array.from({ length: count }, (_, i) => ({
    key: previous?.[i]?.key || nextSplitKey('day'),
    name: previous?.[i]?.name || `Day ${i + 1}`,
    focus: previous?.[i]?.focus || '',
    exercises: previous?.[i]?.exercises?.map((exercise) => ({ ...exercise })) || [],
  }))
}

function splitToDraft(split: TrainingSplit): DraftDay[] {
  return split.days.map((day) => ({
    key: nextSplitKey('day'),
    name: day.name,
    focus: day.focus,
    exercises: exercisesToDraft(day.exercises),
  }))
}

function emptyExercise(): DraftExercise {
  return { key: nextSplitKey('ex'), name: '', sets: '', repMin: '', repMax: '' }
}

export function LiftSplitsPanel({ userId, tick, refresh, onGoLift }: Props) {
  const splits = useMemo(() => {
    void tick
    return liftApi.listSplits(userId)
  }, [userId, tick])

  const exerciseNames = useMemo(() => {
    void tick
    const logged = liftApi.getLoggedExerciseNames(userId)
    return [...new Set([...logged, ...EXERCISE_LIBRARY_NAMES])].sort((a, b) => a.localeCompare(b))
  }, [userId, tick])

  const [name, setName] = useState('')
  const [pattern, setPattern] = useState<SplitPattern>('cycle')
  const [days, setDays] = useState<DraftDay[]>(() => cycleDays(4))
  const [editingSplitId, setEditingSplitId] = useState<string | null>(null)
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

  function resetForm() {
    setEditingSplitId(null)
    setName('')
    setPattern('cycle')
    setDays(cycleDays(4))
  }

  function switchPattern(next: SplitPattern) {
    setPattern(next)
    setDays((prev) => (next === 'weekdays' ? weekdayDaysFromTrackerLabels(Array(7).fill(''), prev) : cycleDays(Math.max(4, prev.length), prev)))
  }

  function applyPreset(preset: (typeof SPLIT_PRESETS)[number]) {
    setName(preset.name)
    setPattern(preset.pattern)
    setDays(
      preset.days.map((d) => ({
        key: nextSplitKey('day'),
        name: d.name,
        focus: d.focus,
        exercises: exercisesToDraft(d.exercises),
      })),
    )
  }

  function applyProgram(program: WorkoutProgram) {
    setName(program.name)
    setPattern(program.pattern)
    setDays(
      program.days.map((day) => ({
        key: nextSplitKey('day'),
        name: day.name,
        focus: day.focus,
        exercises: exercisesToDraft(day.exercises),
      })),
    )
    toast.message(`${program.name} loaded — review and save it`)
  }

  function startEditSplit(split: TrainingSplit) {
    setEditingSplitId(split.id)
    setName(split.name)
    setPattern(split.pattern)
    setDays(splitToDraft(split))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function logSplitDay(split: TrainingSplit, day: SplitDay) {
    const prescription = (day.exercises || []).filter((exercise) => exercise.name.trim())
    const exercises = prescription.length
      ? prescription.map((exercise) => {
          const range = parseRepRange(exercise.reps)
          return emptyLiftDraftExercise(exercise.name, Math.max(1, exercise.sets || 1), range.min)
        })
      : [emptyLiftDraftExercise()]
    bumpLiftDraftKeyCounter(exercises)
    writeLiftDraft(userId, {
      name: day.focus || day.name,
      date: todayKey(),
      exercises,
      fromSplit: true,
      editingSessionId: null,
    })
    toast.success(`Loaded ${day.focus || day.name || 'session'} from your split.`)
    onGoLift?.()
  }

  function save(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Name your split')
      return
    }
    if (days.length === 0) return
    const existing = editingSplitId ? splits.find((split) => split.id === editingSplitId) : null
    liftApi.saveSplit(userId, {
      id: editingSplitId || undefined,
      name: name.trim(),
      pattern,
      days: days.map((d) => ({
        name: d.name.trim() || 'Day',
        focus: d.focus.trim(),
        exercises: draftToExercises(d.exercises),
      })),
      active: existing ? existing.active : true,
    })
    toast.success(editingSplitId ? 'Split updated' : 'Split saved')
    resetForm()
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

  const listId = `split-exercise-list-${userId}`

  return (
    <div className="space-y-4">
      <form
        onSubmit={save}
        className={cn('kp-surface space-y-4 p-4', editingSplitId && 'ring-2 ring-primary/25')}
      >
        <datalist id={listId}>
          {exerciseNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">{editingSplitId ? 'Editing split' : 'Training split'}</p>
            <h3 className="font-display text-xl tracking-tight">{editingSplitId ? 'Update split' : 'Create split'}</h3>
          </div>
          {editingSplitId ? (
            <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" onClick={resetForm}>
              Cancel
            </Button>
          ) : null}
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

        <div className="space-y-3">
          {days.map((day, index) => (
            <div key={day.key} className="space-y-2 rounded-xl border border-border/60 p-3">
              <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
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
              {day.exercises.length ? (
                <div className="space-y-2">
                  <div className="hidden grid-cols-[1fr_4.5rem_4.5rem_4.5rem_auto] gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
                    <span>Exercise</span>
                    <span>Sets</span>
                    <span>Rep min</span>
                    <span>Rep max</span>
                    <span />
                  </div>
                  {day.exercises.map((exercise) => (
                    <div key={exercise.key} className="grid gap-2 sm:grid-cols-[1fr_4.5rem_4.5rem_4.5rem_auto]">
                      <Input
                        list={listId}
                        value={exercise.name}
                        placeholder="Exercise"
                        onChange={(e) =>
                          setDays((rows) =>
                            rows.map((r, i) =>
                              i === index
                                ? {
                                    ...r,
                                    exercises: r.exercises.map((item) =>
                                      item.key === exercise.key ? { ...item, name: e.target.value } : item,
                                    ),
                                  }
                                : r,
                            ),
                          )
                        }
                      />
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="Sets"
                        value={exercise.sets}
                        aria-label="Sets"
                        onChange={(e) =>
                          setDays((rows) =>
                            rows.map((r, i) =>
                              i === index
                                ? {
                                    ...r,
                                    exercises: r.exercises.map((item) =>
                                      item.key === exercise.key ? { ...item, sets: e.target.value } : item,
                                    ),
                                  }
                                : r,
                            ),
                          )
                        }
                      />
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="Min"
                        value={exercise.repMin}
                        aria-label="Rep min"
                        onChange={(e) =>
                          setDays((rows) =>
                            rows.map((r, i) =>
                              i === index
                                ? {
                                    ...r,
                                    exercises: r.exercises.map((item) =>
                                      item.key === exercise.key ? { ...item, repMin: e.target.value } : item,
                                    ),
                                  }
                                : r,
                            ),
                          )
                        }
                      />
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="Max"
                        value={exercise.repMax}
                        aria-label="Rep max"
                        onChange={(e) =>
                          setDays((rows) =>
                            rows.map((r, i) =>
                              i === index
                                ? {
                                    ...r,
                                    exercises: r.exercises.map((item) =>
                                      item.key === exercise.key ? { ...item, repMax: e.target.value } : item,
                                    ),
                                  }
                                : r,
                            ),
                          )
                        }
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setDays((rows) =>
                            rows.map((r, i) =>
                              i === index
                                ? { ...r, exercises: r.exercises.filter((item) => item.key !== exercise.key) }
                                : r,
                            ),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No exercises yet. Add the lifts for this day, or leave empty for rest.</p>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setDays((rows) =>
                    rows.map((r, i) => (i === index ? { ...r, exercises: [...r.exercises, emptyExercise()] } : r)),
                  )
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add exercise
              </Button>
            </div>
          ))}
        </div>

        {pattern === 'cycle' ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDays((rows) => [...rows, { key: nextSplitKey('day'), name: `Day ${rows.length + 1}`, focus: '', exercises: [] }])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add day
          </Button>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit">{editingSplitId ? 'Save changes' : 'Save split'}</Button>
        </div>
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
                  editingSplitId === split.id && 'ring-2 ring-primary/40',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {split.name}
                      {split.active ? (
                        <span className="ml-2 text-xs font-semibold text-primary">Active</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {split.pattern === 'cycle' ? 'Repeating cycle' : 'Weekday'} · {split.days.length} days
                    </p>
                    <ul className="mt-2 space-y-2 text-sm">
                      {split.days.map((d, i) => (
                        <li key={`${split.id}-${i}`} className="border-t border-border/30 py-2 first:border-0">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">{d.name}</p>
                              <p className="text-xs text-muted-foreground">{d.focus || 'Rest'}</p>
                            </div>
                            <Button type="button" size="sm" variant="outline" onClick={() => logSplitDay(split, d)}>
                              Log
                            </Button>
                          </div>
                          {d.exercises?.length ? (
                            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                              {d.exercises.map((exercise) => (
                                <p key={`${exercise.name}-${exercise.sets}-${exercise.reps}`}>
                                  {formatSplitExerciseLine(exercise)}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">No exercises prescribed</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={editingSplitId === split.id ? 'default' : 'outline'}
                      onClick={() => startEditSplit(split)}
                    >
                      {editingSplitId === split.id ? 'Editing' : 'Edit'}
                    </Button>
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
                        if (editingSplitId === split.id) resetForm()
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
    </div>
  )
}
