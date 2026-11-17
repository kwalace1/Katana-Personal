import { todayKey } from '@/lib/dates'
import { buildPickNextStepInput } from '@/lib/orchestration/build-input'
import { pickNextStep } from '@/lib/orchestration/next-step'
import { DEFAULT_WEIGHTS } from '@/lib/orchestration/feedback'
import { assessContextGaps } from '@/modules/assistant/context-gaps'
import { buildSnapshot } from '@/modules/assistant/engine'
import {
  PERSONAL_CONTEXT_VERSION,
  type BuildPersonalContextOptions,
  type PersonalContext,
} from './types'
import { summarizeWorkload } from './workload'

/**
 * Deterministic PersonalContext builder.
 * Reads live module data via existing assemblers — never writes.
 */
export function buildPersonalContext(
  userId: string,
  options: BuildPersonalContextOptions = {},
): PersonalContext {
  const now = options.now ?? new Date()
  const displayName = options.displayName?.trim() || 'there'
  const dayClosed = Boolean(options.dayClosed)

  const life = buildSnapshot(userId, displayName)
  const pick = buildPickNextStepInput(userId, life, {
    preferences: options.preferences,
    dayClosed,
    now,
  })
  const focus = pickNextStep(pick)
  const assessment = assessContextGaps(userId, life)
  const { workload, conflicts } = summarizeWorkload(life, pick, now)

  return {
    version: PERSONAL_CONTEXT_VERSION,
    builtAt: now.toISOString(),
    userId,
    identity: { displayName },
    now: {
      iso: now.toISOString(),
      todayKey: todayKey(now),
      dayClosed,
    },
    life,
    pick,
    focus,
    assessment,
    preferenceWeights: pick.preferenceWeights ?? DEFAULT_WEIGHTS,
    commitment: life.activeCommitment,
    workload,
    conflicts,
    extensions: {
      memory: null,
      patterns: null,
      history: null,
    },
  }
}
