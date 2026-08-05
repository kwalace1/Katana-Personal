import { FormEvent, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { LineSparkline } from '@/components/MiniBars'
import { liftApi, SPLIT_PRESETS } from '../lift-api'
import type { SplitDay, SplitPattern, WeightGoalMode } from '../types'

type Props = {
  userId: string
  logDate: string
  tick: number
  refresh: () => void
  panel: 'lift' | 'splits' | 'progress' | 'weight'
}

type DraftSet = { exercise_id: string; custom_name: string; reps: string; weight: string }

const CUSTOM_EXERCISE = '__custom__'

export function LiftTrackingPanel({ userId, logDate, tick, refresh, panel }: Props) {
  if (panel === 'lift') return <LiftWorkouts userId={userId} logDate={logDate} tick={tick} refresh={refresh} />
  if (panel === 'splits') return <LiftSplits userId={userId} tick={tick} refresh={refresh} />
  if (panel === 'progress') return <LiftProgress userId={userId} tick={tick} />
  return <BodyWeightPanel userId={userId} logDate={logDate} tick={tick} refresh={refresh} />
}

function LiftWorkouts({
  userId,
  logDate,
  tick,
  refresh,
}: {
  userId: string
  logDate: string
  tick: number
  refresh: () => void
}) {
  const exercises = useMemo(() => {
    void tick
    return liftApi.listExercises(userId)
  }, [userId, tick])

  const sessions = useMemo(() => {
    void tick
    return liftApi.listSessions(userId)
  }, [userId, tick])

  const planned = useMemo(() => {
    void tick
    return liftApi.plannedDay(userId, logDate)
  }, [userId, logDate, tick])

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [draftSets, setDraftSets] = useState<DraftSet[]>([
    { exercise_id: '', custom_name: '', reps: '8', weight: '0' },
  ])
  const [newExName, setNewExName] = useState('')
  const [newExMuscle, setNewExMuscle] = useState('')

  // Seed default exercise once list loads
  const defaultExerciseId = exercises[0]?.id ?? CUSTOM_EXERCISE

  function addDraftRow() {
    setDraftSets((rows) => [
      ...rows,
      { exercise_id: defaultExerciseId, custom_name: '', reps: '8', weight: '0' },
    ])
  }

  function resolveExerciseId(row: DraftSet): string | null {
    if (row.exercise_id === CUSTOM_EXERCISE || (!row.exercise_id && row.custom_name.trim())) {
      const name = row.custom_name.trim()
      if (!name) return null
      return liftApi.findOrCreateExercise(userId, name).id
    }
    return row.exercise_id || defaultExerciseId
  }

  function logSession(e: FormEvent) {
    e.preventDefault()
    const sets = draftSets
      .map((s) => {
        const exercise_id = resolveExerciseId(s)
        if (!exercise_id) return null
        return {
          exercise_id,
          reps: Number(s.reps) || 0,
          weight: Number(s.weight) || 0,
        }
      })
      .filter((s): s is { exercise_id: string; reps: number; weight: number } =>
        Boolean(s && s.exercise_id && (s.reps > 0 || s.weight > 0)),
      )
    if (sets.length === 0) return
    const sessionTitle = title.trim() || planned?.day.name || 'Lift'
    liftApi.logSession(userId, {
      date: logDate,
      title: sessionTitle,
      notes,
      sets,
    })
    setTitle('')
    setNotes('')
    setDraftSets([{ exercise_id: defaultExerciseId, custom_name: '', reps: '8', weight: '0' }])
    refresh()
  }

  function addExercise(e: FormEvent) {
    e.preventDefault()
    if (!newExName.trim()) return
    liftApi.addExercise(userId, { name: newExName, muscle: newExMuscle })
    setNewExName('')
    setNewExMuscle('')
    refresh()
  }

  return (
    <div className="space-y-4">
      {planned ? (
        <div className="kp-surface border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Planned · {planned.split.name}
          </p>
          <p className="font-display text-xl tracking-tight">{planned.day.name}</p>
          {planned.day.focus ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{planned.day.focus}</p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={logSession} className="kp-surface space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder={planned ? `Title (default: ${planned.day.name})` : 'Session title'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Sets</p>
          {draftSets.map((row, i) => {
            const isCustom = row.exercise_id === CUSTOM_EXERCISE
            return (
              <div key={i} className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-[1fr_5rem_5rem_auto]">
                  <Select
                    value={isCustom ? CUSTOM_EXERCISE : row.exercise_id || defaultExerciseId}
                    onValueChange={(v) =>
                      setDraftSets((rows) =>
                        rows.map((r, j) =>
                          j === i
                            ? {
                                ...r,
                                exercise_id: v,
                                custom_name: v === CUSTOM_EXERCISE ? r.custom_name : '',
                              }
                            : r,
                        ),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Exercise" />
                    </SelectTrigger>
                    <SelectContent>
                      {exercises.map((ex) => (
                        <SelectItem key={ex.id} value={ex.id}>
                          {ex.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={CUSTOM_EXERCISE}>Custom…</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Reps"
                    value={row.reps}
                    onChange={(e) =>
                      setDraftSets((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, reps: e.target.value } : r)),
                      )
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    placeholder="Weight"
                    value={row.weight}
                    onChange={(e) =>
                      setDraftSets((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, weight: e.target.value } : r)),
                      )
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={draftSets.length <= 1}
                    onClick={() => setDraftSets((rows) => rows.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {isCustom ? (
                  <Input
                    placeholder="Type exercise name"
                    value={row.custom_name}
                    onChange={(e) =>
                      setDraftSets((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, custom_name: e.target.value } : r)),
                      )
                    }
                    autoFocus
                  />
                ) : null}
              </div>
            )
          })}
          <Button type="button" size="sm" variant="outline" onClick={addDraftRow}>
            Add set
          </Button>
        </div>

        <Button type="submit">Log lift</Button>
      </form>

      <form onSubmit={addExercise} className="kp-surface flex flex-wrap gap-2 p-4">
        <Input
          className="min-w-[10rem] flex-1"
          placeholder="Save exercise to library"
          value={newExName}
          onChange={(e) => setNewExName(e.target.value)}
        />
        <Input
          className="w-32"
          placeholder="Muscle"
          value={newExMuscle}
          onChange={(e) => setNewExMuscle(e.target.value)}
        />
        <Button type="submit" variant="outline">
          Add to library
        </Button>
      </form>

      {sessions.length === 0 ? (
        <EmptyState title="No lifts yet" description="Log sets and reps for a session." />
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => {
            const sets = liftApi.listSetsForSession(userId, session.id)
            const byEx = new Map<string, typeof sets>()
            for (const s of sets) {
              const list = byEx.get(s.exercise_id) ?? []
              list.push(s)
              byEx.set(s.exercise_id, list)
            }
            return (
              <li key={session.id} className="kp-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{session.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.date}
                      {session.notes ? ` · ${session.notes}` : ''}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      liftApi.removeSession(userId, session.id)
                      refresh()
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {[...byEx.entries()].map(([exId, exSets]) => {
                    const name = exercises.find((e) => e.id === exId)?.name ?? 'Exercise'
                    return (
                      <li key={exId} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{name}</span>
                        {' · '}
                        {exSets.map((s) => `${s.weight}×${s.reps}`).join(', ')}
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function LiftSplits({ userId, tick, refresh }: { userId: string; tick: number; refresh: () => void }) {
  const splits = useMemo(() => {
    void tick
    return liftApi.listSplits(userId)
  }, [userId, tick])

  const [name, setName] = useState('')
  const [pattern, setPattern] = useState<SplitPattern>('cycle')
  const [days, setDays] = useState<SplitDay[]>([
    { name: 'Push', focus: 'Chest, shoulders, triceps' },
    { name: 'Pull', focus: 'Back, biceps' },
    { name: 'Legs', focus: 'Quads, hamstrings, glutes' },
    { name: 'Rest', focus: 'Recovery' },
  ])

  function applyPreset(presetName: string) {
    const preset = SPLIT_PRESETS.find((p) => p.name === presetName)
    if (!preset) return
    setName(preset.name)
    setPattern(preset.pattern)
    setDays(preset.days.map((d) => ({ ...d })))
  }

  function save(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || days.length === 0) return
    liftApi.saveSplit(userId, { name, pattern, days, active: true })
    setName('')
    refresh()
  }

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="kp-surface space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          {SPLIT_PRESETS.map((p) => (
            <Button key={p.name} type="button" size="sm" variant="outline" className="rounded-full" onClick={() => applyPreset(p.name)}>
              {p.name}
            </Button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Split name" value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={pattern} onValueChange={(v) => setPattern(v as SplitPattern)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cycle">Cycle (repeat in order)</SelectItem>
              <SelectItem value="weekdays">Match weekdays</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {days.map((day, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[6rem_1fr_1fr_auto]">
              {pattern === 'weekdays' ? (
                <p className="flex items-center text-xs font-medium text-muted-foreground">{weekdayLabels[i] ?? `Day ${i + 1}`}</p>
              ) : (
                <p className="flex items-center text-xs font-medium text-muted-foreground">Day {i + 1}</p>
              )}
              <Input
                placeholder="Name"
                value={day.name}
                onChange={(e) =>
                  setDays((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                }
              />
              <Input
                placeholder="Focus"
                value={day.focus}
                onChange={(e) =>
                  setDays((rows) => rows.map((r, j) => (j === i ? { ...r, focus: e.target.value } : r)))
                }
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={days.length <= 1 || (pattern === 'weekdays' && days.length <= 7)}
                onClick={() => setDays((rows) => rows.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {pattern === 'cycle' || days.length < 7 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDays((rows) => [...rows, { name: 'Day', focus: '' }])}
            >
              Add day
            </Button>
          ) : null}
        </div>

        <Button type="submit">Save split</Button>
      </form>

      {splits.length === 0 ? (
        <EmptyState title="No splits saved" description="Save a Push/Pull/Legs cycle or weekday map." />
      ) : (
        <ul className="space-y-2">
          {splits.map((split) => (
            <li key={split.id} className="kp-surface flex items-start justify-between gap-3 p-4">
              <div>
                <p className="font-medium">
                  {split.name}
                  {split.active ? (
                    <span className="ml-2 text-xs font-normal text-primary">Active</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {split.pattern === 'weekdays' ? 'Weekdays' : 'Cycle'} ·{' '}
                  {split.days.map((d) => d.name).join(' → ')}
                </p>
              </div>
              <div className="flex gap-1">
                {!split.active ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      liftApi.setActiveSplit(userId, split.id)
                      refresh()
                    }}
                  >
                    Activate
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
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LiftProgress({ userId, tick }: { userId: string; tick: number }) {
  const exercises = useMemo(() => {
    void tick
    return liftApi.listExercises(userId)
  }, [userId, tick])

  const [exerciseId, setExerciseId] = useState('')
  const selected = exerciseId || exercises[0]?.id || ''

  const series = useMemo(() => {
    void tick
    if (!selected) return []
    return liftApi.exerciseProgressSeries(userId, selected)
  }, [userId, selected, tick])

  const weights = series.map((s) => s.weight)
  const latest = series[series.length - 1]
  const first = series[0]
  const delta = latest && first ? latest.weight - first.weight : null

  return (
    <div className="space-y-4">
      <div className="kp-surface space-y-4 p-4">
        <Select value={selected} onValueChange={setExerciseId}>
          <SelectTrigger className="max-w-sm">
            <SelectValue placeholder="Choose exercise" />
          </SelectTrigger>
          <SelectContent>
            {exercises.map((ex) => (
              <SelectItem key={ex.id} value={ex.id}>
                {ex.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {series.length === 0 ? (
          <EmptyState title="No progress yet" description="Log this exercise in a lift session first." />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Best weight by day</p>
                <p className="font-display text-3xl tracking-tight">
                  {latest?.weight}
                  <span className="ml-1 text-lg font-sans text-muted-foreground">
                    × {latest?.reps}
                  </span>
                </p>
                {delta != null ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {delta >= 0 ? '+' : ''}
                    {delta} from first logged day · {series.length} sessions
                  </p>
                ) : null}
              </div>
              <LineSparkline values={weights} width={320} height={80} />
            </div>
            <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
              {[...series].reverse().map((row) => (
                <li key={row.date} className="flex justify-between border-b border-border/40 py-1.5 last:border-0">
                  <span className="text-muted-foreground">{row.date}</span>
                  <span>
                    {row.weight} × {row.reps}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function BodyWeightPanel({
  userId,
  logDate,
  tick,
  refresh,
}: {
  userId: string
  logDate: string
  tick: number
  refresh: () => void
}) {
  const logs = useMemo(() => {
    void tick
    return liftApi.listBodyWeight(userId)
  }, [userId, tick])

  const goal = useMemo(() => {
    void tick
    return liftApi.getActiveWeightGoal(userId)
  }, [userId, tick])

  const [weight, setWeight] = useState('')
  const [mode, setMode] = useState<WeightGoalMode>('cut')
  const [startWeight, setStartWeight] = useState('')
  const [targetWeight, setTargetWeight] = useState('')

  const series = logs.map((l) => l.weight)
  const latest = logs[logs.length - 1]

  function logWeight(e: FormEvent) {
    e.preventDefault()
    const w = Number(weight)
    if (!w) return
    liftApi.logBodyWeight(userId, { weight: w, date: logDate })
    setWeight('')
    refresh()
  }

  function saveGoal(e: FormEvent) {
    e.preventDefault()
    const start = Number(startWeight) || latest?.weight || 0
    const target = Number(targetWeight)
    if (!start || !target) return
    liftApi.setWeightGoal(userId, { mode, start_weight: start, target_weight: target })
    setStartWeight('')
    setTargetWeight('')
    refresh()
  }

  const progressPct =
    goal && latest
      ? Math.min(
          100,
          Math.max(
            0,
            goal.mode === 'bulk'
              ? ((latest.weight - goal.start_weight) / Math.max(goal.target_weight - goal.start_weight, 0.1)) * 100
              : goal.mode === 'cut'
                ? ((goal.start_weight - latest.weight) / Math.max(goal.start_weight - goal.target_weight, 0.1)) * 100
                : 50,
          ),
        )
      : null

  return (
    <div className="space-y-4">
      <form onSubmit={logWeight} className="kp-surface flex flex-wrap gap-2 p-4">
        <Input
          type="number"
          step="0.1"
          min={0}
          className="w-36"
          placeholder="Weight"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
        <Button type="submit">Log weight</Button>
        {latest ? (
          <p className="flex items-center text-sm text-muted-foreground">
            Latest: {latest.weight} on {latest.date}
          </p>
        ) : null}
      </form>

      <div className="kp-surface space-y-4 p-4">
        {series.length === 0 ? (
          <EmptyState title="No weight logs" description="Track body weight to see the trend." />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Body weight</p>
                <p className="font-display text-3xl tracking-tight">{latest?.weight}</p>
                {goal ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Goal: {goal.mode} → {goal.target_weight}
                    {progressPct != null ? ` · ${Math.round(progressPct)}% there` : ''}
                  </p>
                ) : null}
              </div>
              <LineSparkline values={series} width={320} height={80} target={goal?.target_weight} />
            </div>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {[...logs].reverse().map((row) => (
                <li key={row.id} className="flex items-center justify-between border-b border-border/40 py-1.5 last:border-0">
                  <span className="text-muted-foreground">{row.date}</span>
                  <div className="flex items-center gap-2">
                    <span>{row.weight}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        liftApi.removeBodyWeight(userId, row.id)
                        refresh()
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <form onSubmit={saveGoal} className="kp-surface space-y-3 p-4">
        <p className="text-sm font-medium">Weight goal</p>
        <div className="grid gap-3 sm:grid-cols-3">
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
          <Input
            type="number"
            step="0.1"
            placeholder={latest ? `Start (${latest.weight})` : 'Start weight'}
            value={startWeight}
            onChange={(e) => setStartWeight(e.target.value)}
          />
          <Input
            type="number"
            step="0.1"
            placeholder="Target weight"
            value={targetWeight}
            onChange={(e) => setTargetWeight(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline">
          Set goal
        </Button>
      </form>
    </div>
  )
}
