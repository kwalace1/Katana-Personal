import type { AskReply } from './engine'

/**
 * Phase 4.0 — decide whether Ask should stream an LLM reply over a local rules reply.
 *
 * Authoritative local mutation confirmations (remember/forget, commitment changes, etc.)
 * must never be overwritten by continueLlm, including mid-thread after a viaLlm turn.
 * Pending capture chips (create_task / create_event) stay local so the user confirms.
 */

export function isPendingCaptureReply(reply: AskReply): boolean {
  return reply.actions.some((a) => a.kind === 'create_task' || a.kind === 'create_event')
}

/** True when the rules path already mutated durable state (or confirmed that mutation). */
export function isAuthoritativeAskReply(reply: AskReply): boolean {
  return Boolean(reply.authoritative)
}

/**
 * Whether finalizeReply should call the LLM agent.
 * @param priorKatanaViaLlm — last katana message in the thread used deeper Ask
 */
export function shouldUseLlmForReply(reply: AskReply, priorKatanaViaLlm: boolean): boolean {
  if (isAuthoritativeAskReply(reply)) return false
  if (isPendingCaptureReply(reply)) return false
  if (reply.useLlm) return true
  // Conversational continuity after a deeper Ask turn — but never over mutations above.
  return priorKatanaViaLlm
}

/** Mark a reply as the source of truth for a durable local mutation. */
export function asAuthoritative(reply: AskReply): AskReply {
  return { ...reply, authoritative: true, useLlm: false }
}
