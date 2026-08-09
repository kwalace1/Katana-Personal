/** Persist in-progress lift logging so workouts survive leaving the app. */

export type LiftDraftSet = { key: string; weight: string; reps: string }
export type LiftDraftExercise = { key: string; name: string; sets: LiftDraftSet[] }

export type LiftWorkoutDraft = {
  name: string
  date: string
  exercises: LiftDraftExercise[]
  updatedAt: string
}

const PREFIX = 'katana-personal:lift-draft:'

function storageKey(userId: string) {
  return `${PREFIX}${userId}`
}

function isDraftSet(value: unknown): value is LiftDraftSet {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return typeof s.key === 'string' && typeof s.weight === 'string' && typeof s.reps === 'string'
}

function isDraftExercise(value: unknown): value is LiftDraftExercise {
  if (!value || typeof value !== 'object') return false
  const ex = value as Record<string, unknown>
  return (
    typeof ex.key === 'string' &&
    typeof ex.name === 'string' &&
    Array.isArray(ex.sets) &&
    ex.sets.every(isDraftSet) &&
    ex.sets.length > 0
  )
}

export function readLiftDraft(userId: string): LiftWorkoutDraft | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const d = parsed as Record<string, unknown>
    if (typeof d.name !== 'string' || typeof d.date !== 'string') return null
    if (!Array.isArray(d.exercises) || d.exercises.length === 0) return null
    if (!d.exercises.every(isDraftExercise)) return null
    return {
      name: d.name,
      date: d.date,
      exercises: d.exercises,
      updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function writeLiftDraft(userId: string, draft: Omit<LiftWorkoutDraft, 'updatedAt'>) {
  try {
    const payload: LiftWorkoutDraft = {
      ...draft,
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem(storageKey(userId), JSON.stringify(payload))
  } catch {
    // private mode / quota — logging still works in memory
  }
}

export function clearLiftDraft(userId: string) {
  try {
    localStorage.removeItem(storageKey(userId))
  } catch {
    // ignore
  }
}

/** True when the draft has anything worth keeping (not a blank starter form). */
export function liftDraftHasContent(draft: {
  name: string
  exercises: LiftDraftExercise[]
}): boolean {
  if (draft.name.trim()) return true
  if (draft.exercises.length > 1) return true
  return draft.exercises.some(
    (ex) =>
      ex.sets.length > 1 ||
      ex.sets.some((s) => s.weight.trim() !== '' || s.reps.trim() !== '') ||
      (ex.name.trim() !== '' && ex.name.trim() !== 'Bench Press'),
  )
}
