import { localDb } from '@/lib/local-db'
import { createId } from '@/lib/id'
import type { Goal, GoalHorizon } from './types'

const GOALS = 'goals'

function now() {
  return new Date().toISOString()
}

function normalizeGoal(goal: Goal): Goal {
  return {
    ...goal,
    target_date: goal.target_date ?? null,
  }
}

export const goalsApi = {
  list(userId: string): Goal[] {
    return localDb
      .list<Goal>(GOALS, userId)
      .map(normalizeGoal)
      .sort((a, b) => a.title.localeCompare(b.title))
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
      target_date?: string | null
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
      target_date: input.target_date ?? null,
      created_at: ts,
      updated_at: ts,
    })
  },

  update(userId: string, id: string, patch: Partial<Goal>): Goal | null {
    const updated = localDb.update<Goal>(GOALS, userId, id, { ...patch, updated_at: now() })
    return updated ? normalizeGoal(updated) : null
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
    const goal = localDb.getById<Goal>(GOALS, userId, id)
    return goal ? normalizeGoal(goal) : null
  },

  milestones(userId: string, parentId: string): Goal[] {
    return goalsApi.list(userId).filter((g) => g.parent_id === parentId)
  },

  roots(userId: string): Goal[] {
    return goalsApi.list(userId).filter((g) => !g.parent_id)
  },
}
