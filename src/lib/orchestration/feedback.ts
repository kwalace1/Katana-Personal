import type { NextStepKind } from './next-step'

import type { AskAction } from '@/modules/assistant/ask-api'

export type FeedbackEventType =
  | 'next_step_shown'
  | 'next_step_completed'
  | 'next_step_dismissed'
  | 'ask_action_taken'

export type AskActionKind =
  | 'schedule_workout'
  | 'adjust_goal'
  | 'create_event'
  | 'toggle_habit'
  | 'complete_task'
  | 'other'

export interface FeedbackEvent {
  id: string
  type: FeedbackEventType
  kind: NextStepKind | 'ask'
  actionKind?: AskActionKind
  hour?: number
  at: string
}

export interface PreferenceWeights {
  task: number
  event: number
  habit: number
  workout: number
  goal: number
  recovery: number
}

const KEY_PREFIX = 'katana-personal:orchestration-feedback'
const MAX_EVENTS = 400
const ROLLUP_DAYS = 14

export const DEFAULT_WEIGHTS: PreferenceWeights = {
  task: 1,
  event: 1,
  habit: 1,
  workout: 1,
  goal: 1,
  recovery: 1,
}

function storageKey(userId: string) {
  return `${KEY_PREFIX}:${userId}`
}

function readEvents(userId: string): FeedbackEvent[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as FeedbackEvent[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeEvents(userId: string, events: FeedbackEvent[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(events.slice(-MAX_EVENTS)))
}

let rollupTimer: ReturnType<typeof setTimeout> | null = null

export function askActionFeedbackKind(action: AskAction): AskActionKind {
  if (action.kind === 'schedule_workout') return 'schedule_workout'
  if (action.kind === 'adjust_goal') return 'adjust_goal'
  if (action.kind === 'create_event') return 'create_event'
  if (action.kind === 'toggle_habit') return 'toggle_habit'
  if (action.kind === 'complete_task') return 'complete_task'
  return 'other'
}

export function logFeedback(
  userId: string,
  type: FeedbackEventType,
  kind: FeedbackEvent['kind'],
  onRollUp?: (weights: PreferenceWeights) => void,
  meta?: { actionKind?: AskActionKind; hour?: number },
) {
  const events = readEvents(userId)
  events.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    kind,
    actionKind: meta?.actionKind,
    hour: meta?.hour ?? new Date().getHours(),
    at: new Date().toISOString(),
  })
  writeEvents(userId, events)

  if (onRollUp) {
    if (rollupTimer) clearTimeout(rollupTimer)
    rollupTimer = setTimeout(() => {
      onRollUp(computeWeights(userId))
    }, 800)
  }
}

export function recentEvents(userId: string, days = ROLLUP_DAYS): FeedbackEvent[] {
  const cutoff = Date.now() - days * 86400000
  return readEvents(userId).filter((e) => new Date(e.at).getTime() >= cutoff)
}

export function computeWeights(userId: string): PreferenceWeights {
  const events = recentEvents(userId)
  const kinds = ['task', 'event', 'habit', 'workout', 'goal', 'recovery'] as const
  const shown: Record<string, number> = {}
  const completed: Record<string, number> = {}
  const dismissed: Record<string, number> = {}

  for (const k of kinds) {
    shown[k] = 0
    completed[k] = 0
    dismissed[k] = 0
  }

  for (const e of events) {
    if (e.kind === 'ask' || e.kind === 'wind_down') continue
    if (e.type === 'next_step_shown') shown[e.kind] = (shown[e.kind] ?? 0) + 1
    if (e.type === 'next_step_completed') completed[e.kind] = (completed[e.kind] ?? 0) + 1
    if (e.type === 'next_step_dismissed') dismissed[e.kind] = (dismissed[e.kind] ?? 0) + 1
  }

  const out = { ...DEFAULT_WEIGHTS }
  for (const k of kinds) {
    const s = shown[k] ?? 0
    const c = completed[k] ?? 0
    const d = dismissed[k] ?? 0
    if (s === 0 && d === 0) {
      out[k] = 1
      continue
    }
    const acceptance = s > 0 ? c / s : 0
    if (s >= 3 && c === 0) out[k] = 0.2
    else if (d >= 2 && acceptance < 0.25) out[k] = 0.35
    else out[k] = Math.max(0.25, Math.min(1, 0.35 + 0.65 * acceptance))
  }
  return out
}

export function parsePreferenceWeights(preferences?: Record<string, unknown>): PreferenceWeights {
  const raw = preferences?.orchestration_weights
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_WEIGHTS }
  const w = raw as Record<string, unknown>
  const num = (k: keyof PreferenceWeights) => {
    const v = w[k]
    return typeof v === 'number' && Number.isFinite(v) ? Math.max(0.2, Math.min(1, v)) : DEFAULT_WEIGHTS[k]
  }
  return {
    task: num('task'),
    event: num('event'),
    habit: num('habit'),
    workout: num('workout'),
    goal: num('goal'),
    recovery: num('recovery'),
  }
}

export function preferredWorkoutHour(userId: string): number | null {
  const events = recentEvents(userId).filter(
    (e) =>
      e.type === 'ask_action_taken' &&
      e.actionKind === 'schedule_workout' &&
      typeof e.hour === 'number',
  )
  if (events.length < 2) return null
  const counts = new Map<number, number>()
  for (const e of events) {
    const h = e.hour!
    counts.set(h, (counts.get(h) ?? 0) + 1)
  }
  let best: number | null = null
  let bestCount = 0
  for (const [h, c] of counts) {
    if (c > bestCount) {
      best = h
      bestCount = c
    }
  }
  return best
}

export function shouldDeprioritize(
  kind: NextStepKind,
  weights: PreferenceWeights,
  opts?: { soft?: boolean },
): boolean {
  if (kind === 'task' || kind === 'event' || kind === 'wind_down') return false
  const w = weights[kind as keyof PreferenceWeights]
  if (w == null) return false
  if (!opts?.soft) return w < 0.3
  return w < 0.35
}

/** When next step changes without completion, count as dismissed. */
export function logNextStepDismissedIfNeeded(
  userId: string,
  prev: { kind: NextStepKind; id: string } | null,
  next: { kind: NextStepKind; id: string } | null,
  onRollUp?: (weights: PreferenceWeights) => void,
) {
  if (!prev || !next || prev.id === next.id) return
  logFeedback(userId, 'next_step_dismissed', prev.kind, onRollUp)
}

export function nextStepTrackingId(step: { kind: NextStepKind; taskId?: string; habitId?: string; eventId?: string; goalId?: string; title: string }) {
  return `${step.kind}:${step.taskId || step.habitId || step.eventId || step.goalId || step.title}`
}
