/**
 * Unified PersonalContext — read-only situation model for Katana Personal.
 *
 * This is NOT a data store. Module APIs + IndexedDB remain the source of truth.
 * PersonalContext composes existing assemblies so Today, Ask, Next Step, and the
 * LLM share one typed view of the person’s current circumstances.
 *
 * Extensibility: `extensions` reserves slots for Phase 3+ memory / patterns /
 * history without forcing another architectural rewrite.
 */

import type { LifeSnapshot } from '@/modules/assistant/engine'
import type { ContextAssessment } from '@/modules/assistant/context-gaps'
import type { CommitmentSnapshot } from '@/modules/assistant/commitments'
import type { NextStep, PickNextStepInput } from '@/lib/orchestration/next-step'
import type { PreferenceWeights } from '@/lib/orchestration/feedback'

export const PERSONAL_CONTEXT_VERSION = 1 as const

export type WorkloadLevel = 'light' | 'moderate' | 'heavy'

export type SituationConflictKind =
  | 'calendar_tight'
  | 'overdue_load'
  | 'behind_goals'
  | 'recovery_needed'
  | 'commitment_open'

export type SituationConflict = {
  kind: SituationConflictKind
  /** Short coach-facing label */
  label: string
  detail?: string
}

export type WorkloadSummary = {
  level: WorkloadLevel
  overdueCount: number
  todayTaskCount: number
  openHabitCount: number
  todayEventCount: number
  /** Free minutes before next timed event (or end of evening). */
  freeMinutes: number
  behindGoalCount: number
}

/**
 * Durable personal memory slice (Phase 3).
 * Only user-confirmed items should appear with confidence 1 / source explicit.
 * Inferred / pattern items must stay clearly lower confidence — never invent facts.
 */
export type PersonalMemorySlice = {
  items: {
    id: string
    kind: string
    text: string
    confidence: number
    source: 'explicit' | 'inferred'
  }[]
}

/** Reserved for inferred behavioral patterns (Phase 4). */
export type PersonalPatternSlice = {
  items: { id: string; label: string; confidence: number }[]
}

/** Reserved for multi-week historical rollups beyond LifeSnapshot.week. */
export type PersonalHistorySlice = {
  label: string
  notes?: string
}

export type PersonalContextExtensions = {
  memory: PersonalMemorySlice | null
  patterns: PersonalPatternSlice | null
  history: PersonalHistorySlice | null
}

export type PersonalContext = {
  version: typeof PERSONAL_CONTEXT_VERSION
  builtAt: string
  userId: string
  identity: {
    displayName: string
  }
  now: {
    iso: string
    todayKey: string
    dayClosed: boolean
  }
  /** Existing life assembly — tasks, calendar, habits, goals, health, week, commitment. */
  life: LifeSnapshot
  /** Orchestration input used to pick the next step (includes overdue, sleep, workout plan). */
  pick: PickNextStepInput
  /** One recommended next move, or null when nothing urgent. */
  focus: NextStep | null
  /** Sparse-domain assessment for coaching / LLM. */
  assessment: ContextAssessment
  preferenceWeights: PreferenceWeights
  /** Convenience pointer; same as life.activeCommitment. */
  commitment: CommitmentSnapshot | null
  workload: WorkloadSummary
  conflicts: SituationConflict[]
  /** Future context sources — null in Phase 1. */
  extensions: PersonalContextExtensions
}

export type BuildPersonalContextOptions = {
  displayName?: string
  preferences?: Record<string, unknown>
  dayClosed?: boolean
  now?: Date
}
