import { beforeEach, describe, expect, it } from 'vitest'
import { localDb } from '@/lib/local-db'
import { buildPersonalContext, compactPersonalContext } from '@/lib/personal-context'
import { answerQuestionWithActions } from './engine'
import {
  createMemory,
  deleteMemory,
  listMemories,
  selectMemoriesForContext,
  tryParseMemoryCommand,
  updateMemory,
} from './memory'

const USER = 'memory-phase3-user'

describe('Personal memory v1', () => {
  beforeEach(() => {
    localStorage.clear()
    localDb.clearAll(USER)
  })

  it('creates, lists, updates, deletes, and persists in personal_memory', () => {
    const created = createMemory(USER, { text: 'I prefer mornings for deep work', kind: 'preference' })
    expect(created).not.toBeNull()
    expect(created!.source).toBe('explicit')
    expect(created!.confidence).toBe(1)
    expect(listMemories(USER)).toHaveLength(1)
    expect(localDb.list('personal_memory', USER)).toHaveLength(1)

    const updated = updateMemory(USER, created!.id, { text: 'I prefer early mornings for deep work' })
    expect(updated?.text).toMatch(/early mornings/)

    expect(deleteMemory(USER, created!.id)).toBe(true)
    expect(listMemories(USER)).toHaveLength(0)
  })

  it('only creates via explicit remember parsing — not ordinary chat', () => {
    expect(tryParseMemoryCommand(USER, 'I remember when I used to run every day')).toBeNull()
    expect(tryParseMemoryCommand(USER, 'hold me to finish the report')).toBeNull()
    expect(tryParseMemoryCommand(USER, 'Remember to call Mom')).toBeNull()
    expect(listMemories(USER)).toHaveLength(0)

    const cmd = tryParseMemoryCommand(USER, 'Remember that I hate late meetings')
    expect(cmd?.kind).toBe('remember')
    expect(cmd?.memory?.kind).toBe('preference')
    expect(listMemories(USER)).toHaveLength(1)
  })

  it('forgets matching memories and forget-all', () => {
    createMemory(USER, { text: 'Allergic to shellfish', kind: 'fact' })
    createMemory(USER, { text: 'Prefer texting over calls', kind: 'preference' })
    const forget = tryParseMemoryCommand(USER, 'forget shellfish')
    expect(forget?.removed).toBe(1)
    expect(listMemories(USER)).toHaveLength(1)

    const clear = tryParseMemoryCommand(USER, 'forget all memories')
    expect(clear?.removed).toBe(1)
    expect(listMemories(USER)).toHaveLength(0)
  })

  it('selects a small deterministic set preferring preferences', () => {
    for (let i = 0; i < 10; i++) {
      createMemory(USER, { text: `Fact ${i}`, kind: 'fact' })
    }
    createMemory(USER, { text: 'Night owl', kind: 'preference' })
    const selected = selectMemoriesForContext(USER, 6)
    expect(selected).toHaveLength(6)
    expect(selected[0]?.kind).toBe('preference')
  })

  it('injects into PersonalContext.extensions.memory and LLM compact', () => {
    createMemory(USER, { text: 'Deep work before noon', kind: 'preference' })
    const ctx = buildPersonalContext(USER, { displayName: 'Alex' })
    expect(ctx.extensions.memory?.items.length).toBe(1)
    expect(ctx.extensions.memory?.items[0]?.text).toMatch(/Deep work/)
    expect(ctx.extensions.patterns).toBeNull()

    const compact = compactPersonalContext(ctx)
    expect(compact.personalMemories?.[0]?.text).toMatch(/Deep work/)
    expect(compact.personalMemories?.[0]?.source).toBe('explicit')
  })

  it('never auto-creates pattern memories from createMemory', () => {
    const m = createMemory(USER, { text: 'Often skips Friday workouts', kind: 'pattern' })
    expect(m?.kind).toBe('note')
    expect(m?.source).toBe('explicit')
  })

  it('Ask remember / list / forget path works without LLM', () => {
    const save = answerQuestionWithActions(USER, 'Remember that I am a morning person', 'Alex')
    expect(save.text).toMatch(/remember/i)
    expect(save.useLlm).toBeFalsy()
    expect(listMemories(USER)).toHaveLength(1)

    const list = answerQuestionWithActions(USER, 'What do you remember about me?', 'Alex')
    expect(list.text).toMatch(/morning person/i)
    expect(list.useLlm).toBeFalsy()

    const about = answerQuestionWithActions(USER, 'Tell me about myself', 'Alex')
    expect(about.text).toMatch(/morning person/i)

    const forget = answerQuestionWithActions(USER, 'forget morning person', 'Alex')
    expect(forget.text).toMatch(/Forgot/i)
    expect(listMemories(USER)).toHaveLength(0)
  })

  it('existing Ask focus still works with memories present', () => {
    createMemory(USER, { text: 'Prefer short check-ins', kind: 'preference' })
    const reply = answerQuestionWithActions(USER, 'What should I work on today?', 'Alex')
    expect(reply.text.length).toBeGreaterThan(0)
    expect(listMemories(USER)).toHaveLength(1)
  })
})
