import { describe, expect, it } from 'vitest'
import { PLUS_FEATURE_MATRIX } from './plus'

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
