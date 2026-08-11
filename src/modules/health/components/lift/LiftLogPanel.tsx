import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QuantityInput, QUANTITY } from '@/components/ui/quantity-input'
import { EmptyState } from '@/components/ui/empty-state'
import { todayKey } from '@/lib/dates'
import { burstConfetti } from '@/lib/celebrate'
import { offerBestLiftShare } from '@/lib/social/share-win'
import {
  clearLiftDraft,
  liftDraftHasContent,
  readLiftDraft,
  writeLiftDraft,
  type LiftDraftExercise,
  type LiftDraftSet,
} from '../../lift-draft'
import { liftApi } from '../../lift-api'
import { formatLiftDate } from './LiftLineChart'
import { cn } from '@/lib/utils'

type Props = {
  userId: string
  logDate: string
  tick: number
  refresh: () => void
}

type DraftSet = LiftDraftSet
type DraftExercise = LiftDraftExercise

let draftKey = 0
function nextKey(prefix: string) {
  draftKey += 1
  return `${prefix}-${draftKey}`
}

function bumpKeyCounter(exercises: DraftExercise[]) {
  for (const ex of exercises) {
    const em = /-(\d+)$/.exec(ex.key)
    if (em) draftKey = Math.max(draftKey, Number(em[1]))
    for (const s of ex.sets) {
      const sm = /-(\d+)$/.exec(s.key)
      if (sm) draftKey = Math.max(draftKey, Number(sm[1]))
    }
  }
}

function emptySet(): DraftSet {
  return { key: nextKey('set'), weight: '', reps: '' }
}

function emptyExercise(defaultName = ''): DraftExercise {
  return { key: nextKey('ex'), name: defaultName, sets: [emptySet()] }
}

function loadInitialDraft(userId: string, logDate: string) {
  const saved = readLiftDraft(userId)
  if (saved) {
    bumpKeyCounter(saved.exercises)
    return {
      name: saved.name,
      date: saved.date || logDate || todayKey(),
      exercises: saved.exercises,
      restored: true,
    }
  }
  return {
    name: '',
    date: logDate || todayKey(),
    exercises: [emptyExercise()],
    restored: false,
  }
}

export function LiftLogPanel({ userId, logDate, tick, refresh }: Props) {
  const names = useMemo(() => {
    void tick
    return liftApi.getLoggedExerciseNames(userId)
  }, [userId, tick])

  const sessions = useMemo(() => {
    void tick
    return liftApi.listSessions(userId)
  }, [userId, tick])

  const planned = useMemo(() => {
    void tick
    return liftApi.plannedDay(userId, logDate)
  }, [userId, logDate, tick])

  const [boot] = useState(() => loadInitialDraft(userId, logDate))

  const [name, setName] = useState(boot.name)
  const [date, setDate] = useState(boot.date)
  const [exercises, setExercises] = useState<DraftExercise[]>(boot.exercises)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [draftBanner, setDraftBanner] = useState(boot.restored)
  const skipPersist = useRef(false)
  const latestRef = useRef({ name, date, exercises })
  latestRef.current = { name, date, exercises }

  const hasDraft = liftDraftHasContent({ name, exercises })

  // Persist while typing; flush immediately when leaving the app
  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false
      return
    }
    const payload = { name, date, exercises }
    if (!liftDraftHasContent(payload)) {
      clearLiftDraft(userId)
      return
    }
    const t = window.setTimeout(() => writeLiftDraft(userId, payload), 200)
    return () => window.clearTimeout(t)
  }, [userId, name, date, exercises])

  useEffect(() => {
    const flush = () => {
      const payload = latestRef.current
      if (liftDraftHasContent(payload)) writeLiftDraft(userId, payload)
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVis)
      flush()
    }
  }, [userId])

  useEffect(() => {
    if (!boot.restored) return
    toast.message('Workout draft restored', {
      description: 'Your sets were kept while you were away.',
    })
  }, [boot.restored])

  const listId = `lift-exercise-list-${userId}`

  function updateExercise(key: string, patch: Partial<DraftExercise>) {
    setExercises((rows) => rows.map((ex) => (ex.key === key ? { ...ex, ...patch } : ex)))
  }

  function updateSet(exKey: string, setKey: string, patch: Partial<DraftSet>) {
    setExercises((rows) =>
      rows.map((ex) =>
        ex.key !== exKey
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s) => (s.key === setKey ? { ...s, ...patch } : s)),
            },
      ),
    )
  }

  function resetForm(clearStorage: boolean) {
    skipPersist.current = true
    if (clearStorage) clearLiftDraft(userId)
    setName('')
    setDate(logDate || todayKey())
    setExercises([emptyExercise()])
    setDraftBanner(false)
  }

  function saveWorkout(e: FormEvent) {
    e.preventDefault()
    const title = name.trim() || planned?.day.name || 'Lift'
    const session = liftApi.logWorkout(userId, {
      date,
      name: title,
      exercises: exercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets.map((s) => ({
          weight: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
        })),
      })),
    })
    if (!session) {
      toast.error('Add at least one set with reps')
      return
    }
    toast.success('Workout saved')
    burstConfetti()
    const setCount = exercises.reduce((n, ex) => n + ex.sets.filter((s) => Number(s.reps) > 0).length, 0)
    const exerciseCount = exercises.filter((ex) => ex.sets.some((s) => Number(s.reps) > 0)).length
    offerBestLiftShare({
      userId,
      sessionId: session.id,
      title,
      dateLabel: formatLiftDate(date),
      setCount,
      exerciseCount,
    })
    resetForm(true)
    refresh()
  }

  return (
    <div className="space-y-4">
      {planned ? (
        <div className="kp-surface border-primary/20 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground">Planned for {formatLiftDate(logDate)}</p>
          <p className="font-display text-xl tracking-tight">
            {planned.day.name}
            {planned.day.focus ? (
              <span className="ml-2 text-base font-sans font-normal text-muted-foreground">
                · {planned.day.focus}
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">{planned.split.name}</p>
        </div>
      ) : null}

      <form onSubmit={saveWorkout} className="kp-surface min-w-0 space-y-4 overflow-hidden p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Log workout</p>
            <h3 className="font-display text-xl tracking-tight">New session</h3>
            {hasDraft || draftBanner ? (
              <p className="mt-1 text-xs text-primary">
                Autosaved on this device — safe if you leave mid-workout.
              </p>
            ) : null}
          </div>
          {hasDraft ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => {
                resetForm(true)
                toast.message('Draft discarded')
              }}
            >
              Discard draft
            </Button>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 *:min-w-0">
          <Input
            placeholder="Workout name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Workout name"
          />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
        </div>

        <datalist id={listId}>
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>

        <div className="space-y-3">
          {exercises.map((ex, exIndex) => (
            <div key={ex.key} className="rounded-xl border border-border/60 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Input
                  list={listId}
                  value={ex.name}
                  onChange={(e) => updateExercise(ex.key, { name: e.target.value })}
                  placeholder="Exercise"
                  className="min-w-[12rem] flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={exercises.length <= 1}
                  onClick={() => setExercises((rows) => rows.filter((r) => r.key !== ex.key))}
                >
                  Remove
                </Button>
              </div>
              <div className="space-y-2">
                {ex.sets.map((set, setIndex) => (
                  <div key={set.key} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                    <QuantityInput
                      {...QUANTITY.liftWeightLb}
                      placeholder="lb"
                      value={set.weight}
                      onChange={(weight) => updateSet(ex.key, set.key, { weight })}
                      aria-label={`Exercise ${exIndex + 1} set ${setIndex + 1} weight`}
                    />
                    <QuantityInput
                      {...QUANTITY.reps}
                      placeholder="Reps"
                      value={set.reps}
                      onChange={(reps) => updateSet(ex.key, set.key, { reps })}
                      aria-label={`Exercise ${exIndex + 1} set ${setIndex + 1} reps`}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={ex.sets.length <= 1}
                      onClick={() =>
                        updateExercise(ex.key, {
                          sets: ex.sets.filter((s) => s.key !== set.key),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => updateExercise(ex.key, { sets: [...ex.sets, emptySet()] })}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add set
              </Button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setExercises((rows) => [...rows, emptyExercise()])}>
            <Plus className="mr-1 h-4 w-4" />
            Add exercise
          </Button>
          <Button type="submit">Save workout</Button>
        </div>
      </form>

      <div>
        <h3 className="mb-2 font-display text-lg tracking-tight">History</h3>
        {sessions.length === 0 ? (
          <EmptyState title="No workouts yet" description="Log a multi-exercise session above." />
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => {
              const open = expanded.has(session.id)
              const groups = liftApi.sessionExerciseGroups(userId, session.id)
              return (
                <li key={session.id} className="kp-surface overflow-hidden p-0">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 p-4 text-left"
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev)
                        if (next.has(session.id)) next.delete(session.id)
                        else next.add(session.id)
                        return next
                      })
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{session.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatLiftDate(session.date)} · {groups.length} exercise
                        {groups.length === 1 ? '' : 's'} ·{' '}
                        {groups.reduce((n, g) => n + g.sets.length, 0)} sets
                      </p>
                    </div>
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition', open && 'rotate-180')} />
                  </button>
                  {open ? (
                    <div className="space-y-3 border-t border-border/50 px-4 pb-4 pt-3">
                      {groups.map((g) => (
                        <div key={g.exercise_id}>
                          <p className="text-sm font-medium">{g.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {g.sets.map((s) => `${s.weight} × ${s.reps}`).join(' · ')}
                          </p>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          liftApi.removeSession(userId, session.id)
                          refresh()
                          toast.message('Workout deleted')
                        }}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Delete workout
                      </Button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
