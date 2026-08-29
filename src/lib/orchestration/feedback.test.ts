import { describe, expect, it, beforeEach } from 'vitest'
import {
  computeWeights,
  logFeedback,
  parsePreferenceWeights,
  shouldDeprioritize,
} from './feedback'
import { parseGoalIntent } from './goal-plan'

const USER = 'feedback-test-user'

describe('orchestration feedback', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('lowers workout weight after repeated ignores', () => {
    for (let i = 0; i < 4; i++) {
      logFeedback(USER, 'next_step_shown', 'workout')
      logFeedback(USER, 'next_step_dismissed', 'workout')
    }
    const w = computeWeights(USER)
    expect(w.workout).toBeLessThan(0.4)
    expect(shouldDeprioritize('workout', w)).toBe(true)
  })

  it('keeps task weight high when completed', () => {
    logFeedback(USER, 'next_step_shown', 'task')
    logFeedback(USER, 'next_step_completed', 'task')
    const w = computeWeights(USER)
    expect(w.task).toBeGreaterThan(0.8)
  })

  it('reads weights from preferences', () => {
    const w = parsePreferenceWeights({ orchestration_weights: { task: 0.9, workout: 0.2, habit: 1, event: 1, goal: 1 } })
    expect(w.workout).toBe(0.2)
  })
})

describe('goal-plan parse', () => {
  it('parses lose weight by december', () => {
    const intent = parseGoalIntent('I want to lose 10 pounds by December')
    expect(intent?.title.toLowerCase()).toMatch(/lose 10/)
    expect(intent?.targetDate).toMatch(/12-31/)
    expect(intent?.category).toBe('fitness')
  })

  it('parses 5k training goal', () => {
    const intent = parseGoalIntent('help me run a 5k by march')
    expect(intent?.title.toLowerCase()).toMatch(/5k|train/)
  })
})
