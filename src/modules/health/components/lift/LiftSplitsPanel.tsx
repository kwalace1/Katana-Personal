import { FormEvent, useMemo, useState } from 'react'
import { LayoutList, Lock, Plus, Share2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
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
import { HealthInner, HealthPill, HealthSegmented } from '../health-ui'
import { WORKOUT_PROGRAMS, type WorkoutProgram } from '../../workout-programs'
import { ShareAudiencePicker, type ShareAudienceSelection } from '@/components/ShareAudiencePicker'
import { PlusPaywallSheet, usePlusStatus } from '@/components/PlusPaywall'
import { canUsePlusFeature } from '@/lib/plus'
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

const SUN_SAT = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function isRestDay(day: DraftDay): boolean {
  const name = day.name.trim()
  const focus = day.focus.trim()
  return /^(rest|recovery)$/i.test(name) || /^(rest|recovery)$/i.test(focus)
}

/** Workout label for a weekday row. Rest days stay blank so the field reads as rest. */
function weekdayWorkoutLabel(day: DraftDay): string {
  if (isRestDay(day)) return ''
  const name = day.name.trim()
  const focus = day.focus.trim()
  const generic = /^day \d+$/i.test(name) || SUN_SAT.includes(name)
  if (!name || generic) return focus
  if (!focus) return name
  return `${name} — ${focus}`
}

/**
 * Lay a repeating cycle across Sunday–Saturday.
 * Push/Pull/Legs/Rest stays in order: Push, Pull, Legs, Rest, Push, Pull, Legs.
 * Cycles that would put the same session on Saturday and Sunday (Upper/Lower/Rest)
 * start on their rest day, so the weekend is rest instead of Upper back to back.
 */
function cycleToWeekdays(previous: DraftDay[]): DraftDay[] {
  let source = previous.length ? [...previous] : []
  if (source.length > 1 && 6 % source.length === 0) {
    const restIndex = source.findIndex(isRestDay)
    if (restIndex > 0) source = [...source.slice(restIndex), ...source.slice(0, restIndex)]
  }
  const days = SUN_SAT.map((label, i) => {
    const from = source.length ? source[i % source.length] : undefined
    return {
      key: nextSplitKey('day'),
      name: label,
      focus: from ? weekdayWorkoutLabel(from) : '',
      exercises: from?.exercises.map((exercise) => ({ ...exercise, key: nextSplitKey('ex') })) || [],
    }
  })
  if (days[0]?.focus && days[0].focus === days[6]?.focus) {
    days[6] = { ...days[6], focus: '', exercises: [] }
  }
  return days
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
  const [view, setView] = useState<'list' | 'create' | 'programs'>('list')
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)

  function resetForm() {
    setEditingSplitId(null)
    setName('')
    setPattern('cycle')
    setDays(cycleDays(4))
  }

  function openCreate() {
    resetForm()
    setView('create')
  }

  function closeEditor() {
    resetForm()
    setView('list')
  }

  function switchPattern(next: SplitPattern) {
    setPattern(next)
    setDays((prev) => (next === 'weekdays' ? cycleToWeekdays(prev) : cycleDays(Math.max(4, prev.length), prev)))
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
    if (program.premium && !canUsePlusFeature('programs')) {
      setPlusOpen(true)
      return false
    }
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
    return true
  }

  function useProgram(program: WorkoutProgram) {
    if (!applyProgram(program)) return
    setSelectedProgramId(null)
    setView('create')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function startEditSplit(split: TrainingSplit) {
    setEditingSplitId(split.id)
    setName(split.name)
    setPattern(split.pattern)
    setDays(splitToDraft(split))
    setView('create')
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
    closeEditor()
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
    <div className="space-y-3">
      {view === 'list' && splits.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create split
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setView('programs')}>
            Browse programs
          </Button>
        </div>
      ) : null}

      {view === 'list' && splits.length === 0 ? (
        <EmptyState
          compact
          plain
          icon={LayoutList}
          title="Build a split"
          description="Create your own, or start from a program."
          action={
            <Button type="button" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Create split
            </Button>
          }
          secondaryAction={
            <Button type="button" variant="outline" onClick={() => setView('programs')}>
              Browse programs
            </Button>
          }
        />
      ) : null}

      {view === 'programs' ? (
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-display text-lg tracking-tight">Programs</h3>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedProgramId(null)
                setView('list')
              }}
            >
              Back
            </Button>
          </div>
          <ul className="divide-y border-y border-border">
            {WORKOUT_PROGRAMS.map((program) => {
              const open = selectedProgramId === program.id
              return (
                <li key={program.id}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setSelectedProgramId(open ? null : program.id)}
                    className="flex w-full items-start justify-between gap-3 py-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{program.name}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {program.level} · {program.daysPerWeek} days/week
                      </span>
                    </span>
                    {program.premium && !plus ? (
                      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : null}
                  </button>
                  {open ? (
                    <div className="pb-3">
                      <p className="text-sm leading-relaxed text-muted-foreground">{program.description}</p>
                      <ul className="mt-2 space-y-1.5">
                        {program.days.map((day, index) => (
                          <li key={`${program.id}-${index}`} className="text-sm">
                            <span className="font-medium">{day.name}</span>
                            {day.focus ? <span className="text-muted-foreground"> · {day.focus}</span> : null}
                            {day.exercises?.length ? (
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {day.exercises.map((exercise) => formatSplitExerciseLine(exercise)).join(' · ')}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      <Button type="button" size="sm" className="mt-3" onClick={() => useProgram(program)}>
                        Use this program
                      </Button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {view === 'create' ? (
      <form
        onSubmit={save}
        className={cn('kp-surface space-y-3 p-4', editingSplitId && 'ring-2 ring-primary/20')}
      >
        <datalist id={listId}>
          {exerciseNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg tracking-tight">
            {editingSplitId ? 'Update split' : 'Create split'}
          </h3>
          <Button type="button" size="sm" variant="ghost" onClick={closeEditor}>
            Cancel
          </Button>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Name the routine, then add exercises, sets, and rep ranges for each day.
        </p>

        <div className="flex flex-wrap gap-2">
          {SPLIT_PRESETS.map((preset) => (
            <Button key={preset.name} type="button" size="sm" variant="outline" className="rounded-full" onClick={() => applyPreset(preset)}>
              {preset.name}
            </Button>
          ))}
        </div>

        <Input placeholder="Split name" value={name} onChange={(e) => setName(e.target.value)} />

        <HealthSegmented
          value={pattern}
          onChange={switchPattern}
          options={[
            { id: 'cycle', label: 'Repeating cycle' },
            { id: 'weekdays', label: 'Weekday plan' },
          ]}
        />

        <div className="space-y-3">
          {days.map((day, index) => (
            <HealthInner key={day.key} className="space-y-3">
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
                  <div className="hidden grid-cols-[1fr_4.5rem_4.5rem_4.5rem_auto] gap-2 kp-section-label sm:grid">
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
            </HealthInner>
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
      ) : null}

      {view === 'list' && splits.length > 0 ? (
      <div>
        <h3 className="mb-3 font-display text-lg tracking-tight">Saved splits</h3>
          <ul className="space-y-3">
            {splits.map((split) => (
              <li
                key={split.id}
                className={cn(
                  'kp-surface p-4',
                  (split.active || editingSplitId === split.id) && 'ring-2 ring-primary/20',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{split.name}</p>
                      {split.active ? <HealthPill tone="primary">Active</HealthPill> : null}
                      {editingSplitId === split.id ? <HealthPill>Editing</HealthPill> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {split.pattern === 'cycle' ? 'Repeating cycle' : 'Weekday'} · {split.days.length} days
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={editingSplitId === split.id ? 'default' : 'outline'}
                      className="rounded-full"
                      onClick={() => startEditSplit(split)}
                    >
                      {editingSplitId === split.id ? 'Editing' : 'Edit'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
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
                        className="rounded-full"
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
                        if (editingSplitId === split.id) closeEditor()
                        liftApi.removeSplit(userId, split.id)
                        refresh()
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <ul className="mt-3 space-y-2">
                  {split.days.map((d, i) => (
                    <li key={`${split.id}-${i}`}>
                      <HealthInner className="py-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{d.name}</p>
                            <p className="text-xs text-muted-foreground">{d.focus || 'Rest'}</p>
                          </div>
                          <Button type="button" size="sm" variant="outline" className="h-8 rounded-full" onClick={() => logSplitDay(split, d)}>
                            Log
                          </Button>
                        </div>
                        {d.exercises?.length ? (
                          <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                            {d.exercises.map((exercise) => (
                              <p key={`${exercise.name}-${exercise.sets}-${exercise.reps}`}>
                                {formatSplitExerciseLine(exercise)}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </HealthInner>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
      </div>
      ) : null}
      <Dialog open={Boolean(shareSplit)} onOpenChange={(open) => !open && setShareSplit(null)}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share {shareSplit?.name}</DialogTitle>
          </DialogHeader>
          {cloudUser ? (
            <div className="space-y-3">
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
