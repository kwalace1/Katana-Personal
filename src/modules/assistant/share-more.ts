import type { AskReply, LifeSnapshot } from './engine'
import type { AskAction } from './ask-api'
import {
  assessContextGaps,
  buildShareMoreActions,
  type ContextAssessment,
} from './context-gaps'
import { coachShareMoreNudge, type AskPersonality } from './personality'

function dedupeActions(actions: AskAction[]): AskAction[] {
  const seen = new Set<string>()
  const out: AskAction[] = []
  for (const a of actions) {
    const key = `${a.kind}:${a.route || ''}:${a.label}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(a)
  }
  return out
}

export function shouldSkipShareMoreNudge(question: string): boolean {
  const q = question.trim().toLowerCase()
  return (
    q.includes('thank') ||
    q === 'ty' ||
    q === 'thx' ||
    q.includes('what can you') ||
    q.includes('what do you do') ||
    q.includes('how do you work') ||
    q === 'help' ||
    q === 'commands' ||
    q.includes('capabilities')
  )
}

/** Append personality-aware “share more” copy + chips when Katana lacks context. */
export function enrichReplyWithShareMore(
  userId: string,
  reply: AskReply,
  snap: LifeSnapshot,
  personality: AskPersonality,
  assessment?: ContextAssessment,
): AskReply {
  const ctx = assessment ?? assessContextGaps(userId, snap)
  if (!ctx.sparse || ctx.gaps.length === 0) return reply

  const nudge = coachShareMoreNudge(personality, snap.name, ctx.gaps)
  if (!nudge) return reply

  const alreadyNudging = reply.text.toLowerCase().includes('share more') || reply.text.toLowerCase().includes('missing')
  const text = alreadyNudging ? reply.text : `${reply.text} ${nudge}`.trim()

  const shareActions = buildShareMoreActions(ctx.gaps, 3)
  const actions = dedupeActions([...reply.actions, ...shareActions]).slice(0, 6)

  return { ...reply, text, actions }
}

export function assessAskContext(userId: string, snap: LifeSnapshot): ContextAssessment {
  return assessContextGaps(userId, snap)
}
