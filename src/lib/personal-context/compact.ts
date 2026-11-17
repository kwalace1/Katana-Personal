import type { CompactLifeSnapshot } from '@/modules/assistant/ask-llm-types'
import { compactSnapshot } from '@/modules/assistant/llm'
import type { PersonalContext } from './types'

/**
 * LLM projection of PersonalContext.
 * Reuses compactSnapshot for life fields; adds workload / conflict signals.
 */
export function compactPersonalContext(ctx: PersonalContext): CompactLifeSnapshot {
  const base = compactSnapshot(ctx.life, ctx.userId, ctx.assessment)
  const memoryItems = ctx.extensions.memory?.items
  return {
    ...base,
    contextGapLabels: ctx.assessment.gaps.map((g) => g.label),
    richnessScore: ctx.assessment.richnessScore,
    workloadLevel: ctx.workload.level,
    freeMinutes: ctx.workload.freeMinutes,
    conflictLabels: ctx.conflicts.map((c) => c.label),
    personalMemories:
      memoryItems && memoryItems.length > 0
        ? memoryItems.map((m) => ({
            kind: m.kind,
            text: m.text,
            confidence: m.confidence,
            source: m.source,
          }))
        : undefined,
  }
}
