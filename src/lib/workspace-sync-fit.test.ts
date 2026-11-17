import { describe, expect, it } from 'vitest'
import {
  NEVER_TRUNCATE_SYNC_COLLECTIONS,
  prepareCollectionItemsForSync,
} from './workspace-sync'

describe('prepareCollectionItemsForSync (Phase 4.0)', () => {
  it('protects personal memory and commitment history from silent truncation', () => {
    expect(NEVER_TRUNCATE_SYNC_COLLECTIONS.has('personal_memory')).toBe(true)
    expect(NEVER_TRUNCATE_SYNC_COLLECTIONS.has('ask_commitment_outcomes')).toBe(true)
    expect(NEVER_TRUNCATE_SYNC_COLLECTIONS.has('ask_commitments')).toBe(true)
    expect(NEVER_TRUNCATE_SYNC_COLLECTIONS.has('tasks')).toBe(false)
  })

  it('never drops rows from protected collections even when oversized', () => {
    // ~1KB per row → well over 700KB
    const items = Array.from({ length: 900 }, (_, i) => ({
      id: `m-${i}`,
      text: 'x'.repeat(900),
      updated_at: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
    }))
    const result = prepareCollectionItemsForSync('personal_memory', items)
    expect(result.protectedFromTruncation).toBe(true)
    expect(result.truncated).toBe(false)
    expect(result.items).toHaveLength(items.length)
  })

  it('truncates non-protected oversized collections keeping newest stamps', () => {
    const items = Array.from({ length: 900 }, (_, i) => ({
      id: `t-${i}`,
      title: 'x'.repeat(900),
      updated_at: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00.000Z`,
      created_at: `2025-01-01T00:00:00.000Z`,
    }))
    const result = prepareCollectionItemsForSync('tasks', items)
    expect(result.protectedFromTruncation).toBe(false)
    expect(result.truncated).toBe(true)
    expect(result.items.length).toBeLessThan(items.length)
    expect(result.items.length).toBeGreaterThan(0)
  })
})
