import { localDb } from '@/lib/local-db'
import { createId } from '@/lib/id'
import type { Goal, GoalHorizon } from './types'

const GOALS = 'goals'

function now() {
  return new Date().toISOString()
}

export const goalsApi = {
  list(userId: string): Goal[] {
    return localDb.list<Goal>(GOALS, userId).sort((a, b) => a.title.localeCompare(b.title))
  },

  create(
    userId: string,
    input: {
      title: string
      description?: string
      horizon?: GoalHorizon
      target?: number
      progress?: number
      parent_id?: string | null
    },
  ): Goal {
    const ts = now()
    return localDb.insert(GOALS, userId, {
      id: createId(),
      user_id: userId,
      title: input.title.trim(),
      description: input.description || '',
      horizon: input.horizon || 'monthly',
      target: input.target ?? 100,
      progress: input.progress ?? 0,
      parent_id: input.parent_id ?? null,
      created_at: ts,
      updated_at: ts,
    })
  },

  update(userId: string, id: string, patch: Partial<Goal>): Goal | null {
    return localDb.update<Goal>(GOALS, userId, id, { ...patch, updated_at: now() })
  },

  remove(userId: string, id: string): boolean {
    return localDb.remove(GOALS, userId, id)
  },

  active(userId: string, limit = 5): Goal[] {
    return goalsApi
      .list(userId)
      .filter((g) => g.progress < g.target)
      .slice(0, limit)
  },

  get(userId: string, id: string): Goal | null {
    return localDb.getById<Goal>(GOALS, userId, id)
  },

  milestones(userId: string, parentId: string): Goal[] {
    return goalsApi.list(userId).filter((g) => g.parent_id === parentId)
  },

  roots(userId: string): Goal[] {
    return goalsApi.list(userId).filter((g) => !g.parent_id)
  },
}
