import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Pencil, Plus, Share2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QuantityInput, QUANTITY } from '@/components/ui/quantity-input'
import { EmptyState } from '@/components/ui/empty-state'
import { todayKey } from '@/lib/dates'
import { burstConfetti } from '@/lib/celebrate'
import { createTogetherPost } from '@/lib/social/feed'
import { buildLiftShareCard, offerBestLiftShare } from '@/lib/social/share-win'
import { DEFAULT_SHARE_PREFS } from '@/lib/social/types'
import {
  bumpLiftDraftKeyCounter,
  clearLiftDraft,
  emptyLiftDraftExercise,
  emptyLiftDraftSet,
  liftDraftHasContent,
  readLiftDraft,
  writeLiftDraft,
  type LiftDraftExercise,
  type LiftDraftSet,
} from '../../lift-draft'
import { liftApi } from '../../lift-api'
import { formatLiftDate } from './LiftLineChart'
import { HealthCardHeader, HealthFieldLabel, HealthInner, HealthPill } from '../health-ui'
import { cn } from '@/lib/utils'
import type { SplitDay } from '../../types'
import type { LiftSession } from '../../types'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { ShareAudiencePicker, type ShareAudienceSelection } from '@/components/ShareAudiencePicker'
import { shareSuccessMessage, shareWithAudience } from '@/lib/social/share-with-audience'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Props = {
  userId: string
  logDate: string
  tick: number
  refresh: () => void
  onGoSplits?: () => void
}

type DraftSet = LiftDraftSet
type DraftExercise = LiftDraftExercise

function exercisesFromPlannedDay(plannedDay?: SplitDay | null): DraftExercise[] {
  if (!plannedDay?.exercises?.length) return [emptyLiftDraftExercise()]
  return plannedDay.exercises.map((exercise) =>
    emptyLiftDraftExercise(
      exercise.name,
      Math.max(1, exercise.sets),
      String(Number.parseInt(exercise.reps, 10) || ''),
    ),
  )
}

function loadInitialDraft(userId: string, logDate: string, plannedDay?: SplitDay | null) {
  const saved = readLiftDraft(userId)
  if (saved) {
    bumpLiftDraftKeyCounter(saved.exercises)
    return {
      name: saved.name,
      date: saved.date || logDate || todayKey(),
      exercises: saved.exercises,
      fromSplit: Boolean(saved.fromSplit),
      editingSessionId: saved.editingSessionId || null,
      restored: true,
    }
  }
  return {
    name: '',
    date: logDate || todayKey(),
    exercises: exercisesFromPlannedDay(plannedDay),
    fromSplit: false,
    editingSessionId: null,
    restored: false,
  }
}

function previousTopSetLabel(record: { weight: number; reps: number; date: string } | null) {
  if (!record) return ''
  return `Last time: ${record.weight} lb × ${record.reps} · ${formatLiftDate(record.date)}`
}

export function LiftLogPanel({ userId, logDate, tick, refresh, onGoSplits }: Props) {
  const { cloudUser, cloudProfile, saveSharePrefs } = useCloudAuth()
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

  const [boot] = useState(() =>
    loadInitialDraft(userId, logDate, liftApi.plannedDay(userId, logDate)?.day),
  )

  const [name, setName] = useState(boot.name)
  const [date, setDate] = useState(boot.date)
  const [exercises, setExercises] = useState<DraftExercise[]>(boot.exercises)
  const [fromSplit, setFromSplit] = useState(boot.fromSplit)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(boot.editingSessionId)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [draftBanner, setDraftBanner] = useState(boot.restored)
  const [creatingSplitFromLifts, setCreatingSplitFromLifts] = useState(false)
  const [splitSelectionIds, setSplitSelectionIds] = useState<string[]>([])
  const [splitFromLiftsName, setSplitFromLiftsName] = useState('')
  const [shareSession, setShareSession] = useState<LiftSession | null>(null)
  const [selectedFriends, setSelectedFriends] = useState<Record<string, boolean>>({})
  const [selectedCircles, setSelectedCircles] = useState<Record<string, boolean>>({})
  const [audience, setAudience] = useState<ShareAudienceSelection>({
    friendIds: [],
    circles: [],
    hasAny: false,
  })
  const [shareToFeed, setShareToFeed] = useState(true)
  const [sharing, setSharing] = useState(false)
  const skipPersist = useRef(false)
  const latestRef = useRef({ name, date, exercises, fromSplit, editingSessionId })
  latestRef.current = { name, date, exercises, fromSplit, editingSessionId }

  const hasDraft = liftDraftHasContent({ name, exercises, editingSessionId })
  const selectedSplitWorkouts = splitSelectionIds
    .map((id) => sessions.find((session) => session.id === id))
    .filter((session): session is LiftSession => Boolean(session))
  const suggestedSplitName = [...new Set(selectedSplitWorkouts.map((session) => session.title).filter(Boolean))].join(
    ' / ',
  )

  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false
      return
    }
    const payload = { name, date, exercises, fromSplit, editingSessionId }
    if (!liftDraftHasContent(payload)) {
      clearLiftDraft(userId)
      return
    }
    const t = window.setTimeout(() => writeLiftDraft(userId, payload), 200)
    return () => window.clearTimeout(t)
  }, [userId, name, date, exercises, fromSplit, editingSessionId])

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
    if (boot.editingSessionId) {
      toast.message('Editing restored', { description: 'Your changes were kept while you were away.' })
      return
    }
    toast.message('Workout draft restored', {
      description: 'Your sets were kept while you were away.',
    })
  }, [boot.restored, boot.editingSessionId])

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
    setExercises([emptyLiftDraftExercise()])
    setFromSplit(false)
    setEditingSessionId(null)
    setDraftBanner(false)
  }

  function startEditWorkout(session: LiftSession) {
    const groups = liftApi.sessionExerciseGroups(userId, session.id)
    const nextExercises =
      groups.length > 0
        ? groups.map((group) => ({
            key: `ex-${group.exercise_id}`,
            name: group.name,
            sets:
              group.sets.length > 0
                ? group.sets.map((set) => ({
                    key: `set-${set.id}`,
                    weight: set.weight ? String(set.weight) : '',
                    reps: set.reps ? String(set.reps) : '',
                  }))
                : [emptyLiftDraftSet()],
          }))
        : [emptyLiftDraftExercise()]
    bumpLiftDraftKeyCounter(nextExercises)
    skipPersist.current = true
    setEditingSessionId(session.id)
    setFromSplit(false)
    setName(session.title)
    setDate(session.date)
    setExercises(nextExercises)
    setDraftBanner(false)
    writeLiftDraft(userId, {
      name: session.title,
      date: session.date,
      exercises: nextExercises,
      fromSplit: false,
      editingSessionId: session.id,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function saveWorkout(e: FormEvent) {
    e.preventDefault()
    const title = name.trim() || planned?.day.name || 'Lift'
    const payload = {
      date,
      name: title,
      exercises: exercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets.map((s) => ({
          weight: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
        })),
      })),
    }
    if (editingSessionId) {
      const session = liftApi.updateWorkout(userId, editingSessionId, payload)
      if (!session) {
        toast.error('Add at least one set with reps')
        return
      }
      toast.success('Workout updated')
      resetForm(true)
      refresh()
      return
    }
    const session = liftApi.logWorkout(userId, payload)
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

  function toggleSplitSelection(sessionId: string) {
    setSplitSelectionIds((ids) =>
      ids.includes(sessionId) ? ids.filter((id) => id !== sessionId) : [...ids, sessionId],
    )
  }

  function moveSplitSelection(sessionId: string, delta: number) {
    setSplitSelectionIds((ids) => {
      const index = ids.indexOf(sessionId)
      const next = index + delta
      if (index < 0 || next < 0 || next >= ids.length) return ids
      const copy = [...ids]
      const swap = copy[index]
      copy[index] = copy[next]!
      copy[next] = swap!
      return copy
    })
  }

  function saveSplitFromLifts() {
    if (selectedSplitWorkouts.length === 0) {
      toast.error('Select at least one logged lift')
      return
    }
    const splitName = splitFromLiftsName.trim() || suggestedSplitName
    if (!splitName) {
      toast.error('Add a split name')
      return
    }
    const split = liftApi.saveSplitFromSessions(userId, {
      name: splitName,
      sessionIds: splitSelectionIds,
    })
    if (!split) {
      toast.error('Couldn’t create split')
      return
    }
    setCreatingSplitFromLifts(false)
    setSplitSelectionIds([])
    setSplitFromLiftsName('')
    toast.success('Split saved from logged lifts')
    refresh()
    onGoSplits?.()
  }

  async function ensureFeedCards(): Promise<boolean> {
    if (!cloudProfile) return false
    if (cloudProfile.sharePrefs?.feedCards) return true
    try {
      await saveSharePrefs({
        ...DEFAULT_SHARE_PREFS,
        ...cloudProfile.sharePrefs,
        feedCards: true,
      })
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t enable Feed cards')
      return false
    }
  }

  function openShareSession(session: LiftSession) {
    if (!cloudUser) {
      toast.message('Connect Social in Settings to share workouts')
      return
    }
    setSelectedFriends({})
    setSelectedCircles({})
    setShareToFeed(true)
    setShareSession(session)
  }

  async function shareCompletedWorkout() {
    if (!shareSession || !cloudUser || sharing) return
    if (!shareToFeed && !audience.hasAny) return
    setSharing(true)
    try {
      const groups = liftApi.sessionExerciseGroups(userId, shareSession.id)
      const setCount = groups.reduce((sum, group) => sum + group.sets.length, 0)
      const parts: string[] = []

      if (shareToFeed) {
        const ok = await ensureFeedCards()
        if (!ok) return
        const offer = buildLiftShareCard({
          title: shareSession.title,
          dateLabel: formatLiftDate(shareSession.date),
          setCount,
          exerciseCount: groups.length,
        })
        await createTogetherPost({
          authorId: cloudUser.uid,
          text: offer.defaultCaption,
          audience: 'friends',
          card: offer.card,
        })
        parts.push('Posted to Social')
      }

      if (audience.hasAny) {
        const result = await shareWithAudience({
          kind: 'lift_session',
          title: shareSession.title,
          body: `${formatLiftDate(shareSession.date)} · ${setCount} sets`,
          data: {
            workout: {
              date: shareSession.date,
              notes: shareSession.notes,
              exercises: groups.map((group) => ({
                name: group.name,
                sets: group.sets.map((set) => ({ weight: set.weight, reps: set.reps })),
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
        parts.push(shareSuccessMessage(result))
      }

      toast.success(parts.join(' · '))
      setShareSession(null)
      setSelectedFriends({})
      setSelectedCircles({})
      setShareToFeed(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t share workout')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="space-y-5">
      {planned && !editingSessionId ? (
        <div className="kp-surface bg-primary/[0.06] p-4 sm:p-5">
          <p className="kp-section-label">Planned for {formatLiftDate(logDate)}</p>
          <p className="mt-1 font-display text-xl tracking-tight">
            {planned.day.name}
            {planned.day.focus ? (
              <span className="ml-2 text-base font-sans font-normal text-muted-foreground">
                · {planned.day.focus}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{planned.split.name}</p>
        </div>
      ) : null}

      <form
        onSubmit={saveWorkout}
        className={cn('kp-surface min-w-0 space-y-4 overflow-hidden p-4 sm:p-5', editingSessionId && 'ring-2 ring-primary/20')}
      >
        <HealthCardHeader
          eyebrow={editingSessionId ? 'Editing workout' : 'Log workout'}
          title={editingSessionId ? 'Update session' : 'New session'}
          description={
            hasDraft || draftBanner
              ? 'Autosaved on this device — safe if you leave mid-workout.'
              : 'Name the session, then add exercises and working sets.'
          }
          actions={
            editingSessionId ? (
              <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" onClick={() => resetForm(true)}>
                Cancel edit
              </Button>
            ) : hasDraft ? (
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
            ) : null
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 *:min-w-0">
          <div>
            <HealthFieldLabel>Workout name</HealthFieldLabel>
            <Input
              placeholder="Push, Pull, Legs…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Workout name"
            />
          </div>
          <div>
            <HealthFieldLabel>Date</HealthFieldLabel>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          </div>
        </div>

        <datalist id={listId}>
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>

        <div className="space-y-3">
          {exercises.map((ex, exIndex) => {
            const previous = fromSplit
              ? null
              : liftApi.getPreviousTopSet(userId, ex.name, editingSessionId)
            return (
              <HealthInner key={ex.key} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
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
                {previous ? (
                  <p className="text-xs text-muted-foreground">{previousTopSetLabel(previous)}</p>
                ) : null}
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
                  onClick={() => updateExercise(ex.key, { sets: [...ex.sets, emptyLiftDraftSet()] })}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add set
                </Button>
              </HealthInner>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setExercises((rows) => [...rows, emptyLiftDraftExercise()])}>
            <Plus className="mr-1 h-4 w-4" />
            Add exercise
          </Button>
          <Button type="submit">{editingSessionId ? 'Save changes' : 'Save workout'}</Button>
        </div>
      </form>

      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="kp-section-label">History</p>
            <h3 className="mt-1 font-display text-xl tracking-tight">Logged sessions</h3>
          </div>
          {sessions.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant={creatingSplitFromLifts ? 'default' : 'outline'}
              className="rounded-full"
              onClick={() => {
                if (creatingSplitFromLifts) {
                  setCreatingSplitFromLifts(false)
                  setSplitSelectionIds([])
                  setSplitFromLiftsName('')
                  return
                }
                setCreatingSplitFromLifts(true)
              }}
            >
              {creatingSplitFromLifts ? 'Cancel' : 'Create split'}
            </Button>
          ) : null}
        </div>
        {creatingSplitFromLifts ? (
          <div className="kp-surface mb-3 space-y-3 p-4 sm:p-5">
            <HealthCardHeader
              eyebrow="From lifts"
              title="Build a cycle"
              description="Select sessions in the order they should appear as days. Exercises, set counts, and rep ranges are copied from each one."
            />
            <HealthFieldLabel>Split name</HealthFieldLabel>
            <Input
              placeholder={suggestedSplitName || 'Push / Pull / Legs'}
              value={splitFromLiftsName}
              onChange={(e) => setSplitFromLiftsName(e.target.value)}
              aria-label="Split name"
            />
            {selectedSplitWorkouts.length ? (
              <ul className="space-y-2">
                {selectedSplitWorkouts.map((workout, index) => (
                  <li key={workout.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-secondary/40 px-3.5 py-2.5">
                    <div>
                      <p className="text-sm font-medium">Day {index + 1}</p>
                      <p className="text-xs text-muted-foreground">
                        {workout.title || 'Workout'} · {formatLiftDate(workout.date)} ·{' '}
                        {liftApi.sessionExerciseGroups(userId, workout.id).length} exercises
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() => moveSplitSelection(workout.id, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={index === selectedSplitWorkouts.length - 1}
                        onClick={() => moveSplitSelection(workout.id, 1)}
                      >
                        ↓
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => toggleSplitSelection(workout.id)}>
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No lifts selected yet.</p>
            )}
            <Button type="button" disabled={selectedSplitWorkouts.length === 0} onClick={saveSplitFromLifts}>
              Save split
            </Button>
          </div>
        ) : null}
        {sessions.length === 0 ? (
          <EmptyState title="No workouts yet" description="Log a multi-exercise session above." />
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => {
              const open = expanded.has(session.id)
              const groups = liftApi.sessionExerciseGroups(userId, session.id)
              const selected = splitSelectionIds.includes(session.id)
              return (
                <li
                  key={session.id}
                  className={cn(
                    'kp-surface overflow-hidden p-0',
                    editingSessionId === session.id && 'ring-2 ring-primary/20',
                    selected && 'ring-2 ring-primary/20',
                  )}
                >
                  <div className="flex w-full items-center gap-2 px-4 py-3.5">
                    {creatingSplitFromLifts ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={selected ? 'default' : 'outline'}
                        className="rounded-full"
                        onClick={() => toggleSplitSelection(session.id)}
                      >
                        {selected ? 'Selected' : 'Select'}
                      </Button>
                    ) : null}
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
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
                      {editingSessionId === session.id ? <HealthPill tone="primary">Editing</HealthPill> : null}
                      <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition', open && 'rotate-180')} />
                    </button>
                    {!creatingSplitFromLifts ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 shrink-0 text-muted-foreground"
                        aria-label={`Share ${session.title}`}
                        onClick={() => openShareSession(session)}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  {open ? (
                    <div className="space-y-3 border-t border-border/40 bg-secondary/20 px-4 pb-4 pt-3">
                      {groups.map((g) => (
                        <div key={g.exercise_id}>
                          <p className="text-sm font-medium">{g.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {g.sets.map((s) => `${s.weight} × ${s.reps}`).join(' · ')}
                          </p>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => startEditWorkout(session)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => openShareSession(session)}
                        >
                          <Share2 className="mr-1 h-3.5 w-3.5" />
                          Share
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full text-muted-foreground"
                          onClick={() => {
                            if (editingSessionId === session.id) resetForm(true)
                            setSplitSelectionIds((ids) => ids.filter((id) => id !== session.id))
                            liftApi.removeSession(userId, session.id)
                            refresh()
                            toast.message('Workout deleted')
                          }}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <Dialog open={Boolean(shareSession)} onOpenChange={(open) => !open && setShareSession(null)}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share {shareSession?.title}</DialogTitle>
          </DialogHeader>
          {cloudUser ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Post this lift to your Social feed, or send the full workout to circles and friends.
              </p>
              <ShareAudiencePicker
                uid={cloudUser.uid}
                selectedFriends={selectedFriends}
                selectedCircles={selectedCircles}
                onFriendsChange={setSelectedFriends}
                onCirclesChange={setSelectedCircles}
                onAudienceChange={setAudience}
                showSocialFeed
                socialFeedSelected={shareToFeed}
                onSocialFeedChange={setShareToFeed}
                compact
              />
              <Button
                className="w-full"
                disabled={(!shareToFeed && !audience.hasAny) || sharing}
                onClick={() => void shareCompletedWorkout()}
              >
                {sharing
                  ? 'Sharing…'
                  : shareToFeed && !audience.hasAny
                    ? 'Post to Social feed'
                    : shareToFeed
                      ? 'Share to feed & friends'
                      : 'Share complete workout'}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
