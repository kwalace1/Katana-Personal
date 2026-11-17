import { beforeEach, describe, expect, it } from 'vitest'
import {
  FREE_LLM_ASKS_PER_DAY,
  PLUS_FEATURE_MATRIX,
  canUseLlmAsk,
  consumeLlmAsk,
  freeLlmAsksRemaining,
  setPlusUnlocked,
} from './plus'

describe('PLUS_FEATURE_MATRIX', () => {
  it('lists the Accountability pack features we actually gate', () => {
    const features = PLUS_FEATURE_MATRIX.map((row) => row.feature)
    expect(features).toEqual([
      'llm',
      'challenge',
      'nutrition_ai',
      'integrations',
      'orchestration_push',
      'programs',
      'diet_plans',
    ])
  })
})

describe('Ask LLM quota', () => {
  beforeEach(() => {
    localStorage.clear()
    setPlusUnlocked(false)
  })

  it('allows free asks until the daily cap', () => {
    expect(canUseLlmAsk()).toBe(true)
    expect(freeLlmAsksRemaining()).toBe(FREE_LLM_ASKS_PER_DAY)
    for (let i = 0; i < FREE_LLM_ASKS_PER_DAY; i++) consumeLlmAsk()
    expect(canUseLlmAsk()).toBe(false)
    expect(freeLlmAsksRemaining()).toBe(0)
  })

  it('unlimited when Plus is unlocked', () => {
    for (let i = 0; i < FREE_LLM_ASKS_PER_DAY; i++) consumeLlmAsk()
    setPlusUnlocked(true)
    expect(canUseLlmAsk()).toBe(true)
    expect(freeLlmAsksRemaining()).toBe(Number.POSITIVE_INFINITY)
  })
})
