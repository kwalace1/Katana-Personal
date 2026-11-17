import { beforeEach, describe, expect, it } from 'vitest'
import { localDb } from '@/lib/local-db'
import { createId } from '@/lib/id'
import { answerQuestionWithActions } from './engine'
import { shouldUseLlmForReply, isAuthoritativeAskReply, isPendingCaptureReply } from './ask-reply-policy'
import { listMemories } from './memory'
import { getActiveCommitment } from './commitments'

const USER = 'ask-reply-policy-user'

describe('Ask reply LLM policy (Phase 4.0)', () => {
  beforeEach(() => {
    localStorage.clear()
    localDb.clearAll(USER)
  })

  it('keeps pending capture replies local even after viaLlm', () => {
    const reply = {
      text: 'Tap to confirm',
      actions: [{ id: createId(), label: 'Add', kind: 'create_task' as const, title: 'Milk' }],
    }
    expect(isPendingCaptureReply(reply)).toBe(true)
    expect(shouldUseLlmForReply(reply, true)).toBe(false)
  })

  it('does not overwrite authoritative remember after viaLlm turn', () => {
    const reply = answerQuestionWithActions(USER, 'Remember that I prefer mornings', 'Alex')
    expect(isAuthoritativeAskReply(reply)).toBe(true)
    expect(shouldUseLlmForReply(reply, true)).toBe(false)
    expect(listMemories(USER)).toHaveLength(1)
    expect(reply.text).toMatch(/remember/i)
  })

  it('does not overwrite authoritative forget after viaLlm turn', () => {
    answerQuestionWithActions(USER, 'Remember that shellfish allergy', 'Alex')
    const reply = answerQuestionWithActions(USER, 'forget shellfish', 'Alex')
    expect(reply.authoritative).toBe(true)
    expect(shouldUseLlmForReply(reply, true)).toBe(false)
    expect(listMemories(USER)).toHaveLength(0)
  })

  it('does not overwrite commitment create / drop / snooze after viaLlm', () => {
    const create = answerQuestionWithActions(USER, 'Hold me to finish the brief', 'Alex')
    expect(create.authoritative).toBe(true)
    expect(shouldUseLlmForReply(create, true)).toBe(false)
    expect(getActiveCommitment(USER)?.title.toLowerCase()).toContain('finish the brief')

    const snooze = answerQuestionWithActions(USER, 'snooze commitment', 'Alex')
    expect(snooze.authoritative).toBe(true)
    expect(shouldUseLlmForReply(snooze, true)).toBe(false)

    // Wake by clearing snooze via drop path: make a fresh active then drop
    answerQuestionWithActions(USER, 'Hold me to call Mom', 'Alex')
    const drop = answerQuestionWithActions(USER, 'drop commitment', 'Alex')
    expect(drop.authoritative).toBe(true)
    expect(shouldUseLlmForReply(drop, true)).toBe(false)
    expect(getActiveCommitment(USER)).toBeNull()
  })

  it('still allows LLM for open-ended useLlm replies after viaLlm', () => {
    const reply = { text: 'fallback', actions: [], useLlm: true }
    expect(shouldUseLlmForReply(reply, true)).toBe(true)
    expect(shouldUseLlmForReply(reply, false)).toBe(true)
  })

  it('allows continueLlm for non-authoritative local intents after viaLlm', () => {
    const reply = { text: 'Here’s a briefing', actions: [] }
    expect(shouldUseLlmForReply(reply, true)).toBe(true)
    expect(shouldUseLlmForReply(reply, false)).toBe(false)
  })
})
