import { describe, expect, it } from 'vitest'
import { enrichSubtaskUpdates, formatSubtaskCompletionMeta } from './project-data'

describe('enrichSubtaskUpdates', () => {
  it('records who completed a subtask', () => {
    const before = [{ id: 's1', title: 'Wireframes', completed: false }]
    const after = [{ id: 's1', title: 'Wireframes', completed: true }]
    const enriched = enrichSubtaskUpdates(before, after, 'Jordan Lee')
    expect(enriched[0]?.completedBy).toBe('Jordan Lee')
    expect(enriched[0]?.completedAt).toBeTruthy()
  })

  it('clears attribution when a subtask is reopened', () => {
    const before = [
      {
        id: 's1',
        title: 'Wireframes',
        completed: true,
        completedBy: 'Jordan Lee',
        completedAt: '2025-06-08T10:00:00.000Z',
      },
    ]
    const after = [{ id: 's1', title: 'Wireframes', completed: false }]
    const enriched = enrichSubtaskUpdates(before, after, 'Jordan Lee')
    expect(enriched[0]?.completed).toBe(false)
    expect(enriched[0]?.completedBy).toBeUndefined()
    expect(enriched[0]?.completedAt).toBeUndefined()
  })
})

describe('formatSubtaskCompletionMeta', () => {
  it('returns a completed-by label for finished subtasks', () => {
    expect(
      formatSubtaskCompletionMeta({
        id: 's1',
        title: 'Wireframes',
        completed: true,
        completedBy: 'Jordan Lee',
      })
    ).toBe('Completed by Jordan Lee')
  })

  it('returns null for open subtasks', () => {
    expect(
      formatSubtaskCompletionMeta({
        id: 's1',
        title: 'Wireframes',
        completed: false,
      })
    ).toBeNull()
  })
})
