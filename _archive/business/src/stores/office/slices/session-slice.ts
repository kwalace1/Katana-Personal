import { StateCreator } from 'zustand'
import type { AppState } from '@/stores/office/use-app-store'
import type { Sessions, Session } from '@/lib/office/types'
import { api } from '@/lib/office/app/api-client'
import { fetchChat, fetchChats } from '@/lib/office/chat/chats'
import { invalidateFingerprint, setIfChanged } from '@/stores/office/set-if-changed'
import { createLoader, createInflightDeduplicator } from '@/stores/office/store-utils'

const sessionRefreshDedup = createInflightDeduplicator('sessionSlice_inflightRefreshes')

function getSessionSortScore(session: Session): number {
  return session.lastAssistantAt
    || session.lastActiveAt
    || session.updatedAt
    || session.createdAt
    || 0
}

function hasSessionContent(session: Session): boolean {
  if (typeof session.messageCount === 'number' && Number.isFinite(session.messageCount) && session.messageCount > 0) {
    return true
  }
  if (session.lastMessageSummary) return true
  return Array.isArray(session.messages) && session.messages.length > 0
}

function getLatestAgentSessionId(s: AppState, agentId: string, threadSessionId?: string | null): string | null {
  let bestAnyId: string | null = null
  let bestAnyScore = Number.NEGATIVE_INFINITY
  let bestWithContentId: string | null = null
  let bestWithContentScore = Number.NEGATIVE_INFINITY

  for (const [sessionId, session] of Object.entries(s.sessions)) {
    if (session.agentId !== agentId) continue
    const score = getSessionSortScore(session)
    if (score > bestAnyScore) {
      bestAnyScore = score
      bestAnyId = sessionId
    }
    if (hasSessionContent(session) && score > bestWithContentScore) {
      bestWithContentScore = score
      bestWithContentId = sessionId
    }
  }

  if (bestWithContentId) return bestWithContentId
  if (threadSessionId && s.sessions[threadSessionId]?.agentId === agentId) return threadSessionId
  return bestAnyId
}

/** Derive the active session ID from the current agent — no stored `currentSessionId`. */
export function selectActiveSessionId(s: AppState): string | null {
  if (s.activeSessionIdOverride && s.sessions[s.activeSessionIdOverride]) {
    return s.activeSessionIdOverride
  }
  if (!s.currentAgentId) return null
  const agent = s.agents[s.currentAgentId]
  const sid = getLatestAgentSessionId(s, s.currentAgentId, agent?.threadSessionId)
  if (sid) return sid
  // Never fall back to a session the user doesn't own (e.g. the engine's shared
  // per-agent thread), which the proxy would 403 — wait for setCurrentAgent to
  // provision the user's own session instead.
  const threadId = agent?.threadSessionId
  return threadId && s.sessions[threadId] ? threadId : null
}

export interface SessionSlice {
  sessions: Sessions
  activeSessionIdOverride: string | null
  setActiveSessionIdOverride: (id: string | null) => void
  loadSessions: () => Promise<void>
  refreshSession: (id: string) => Promise<void>
  removeSession: (id: string) => void
  clearSessions: (ids: string[]) => Promise<void>
  togglePinSession: (id: string) => Promise<void>
  updateSessionInStore: (session: Session) => void
}

export const createSessionSlice: StateCreator<AppState, [], [], SessionSlice> = (set, get) => ({
  sessions: {},
  activeSessionIdOverride: null,
  setActiveSessionIdOverride: (id) => set({ activeSessionIdOverride: id }),
  loadSessions: createLoader<AppState>(set, 'sessions', () => fetchChats()),
  refreshSession: async (id) => {
    if (!id) return
    await sessionRefreshDedup.dedup(id, async () => {
      try {
        const session = await fetchChat(id)
        const existing = get().sessions[id]
        // Skip update if the session data hasn't changed
        if (existing && JSON.stringify(existing) === JSON.stringify(session)) return
        invalidateFingerprint('sessions')
        set({
          sessions: { ...get().sessions, [id]: session },
        })
      } catch (err: unknown) {
        console.warn('Store error:', err)
      }
    })
  },
  removeSession: (id) => {
    const sessions = { ...get().sessions }
    delete sessions[id]
    invalidateFingerprint('sessions')
    const activeSessionId = selectActiveSessionId(get())
    if (activeSessionId === id) {
      set({ sessions, currentAgentId: null, activeSessionIdOverride: null })
    } else {
      const overrideId = get().activeSessionIdOverride
      set({ sessions, activeSessionIdOverride: overrideId === id ? null : overrideId })
    }
  },
  clearSessions: async (ids) => {
    if (!ids.length) return
    await api('DELETE', '/chats', { ids })
    const sessions = { ...get().sessions }
    for (const id of ids) delete sessions[id]
    invalidateFingerprint('sessions')
    const activeSessionId = selectActiveSessionId(get())
    if (activeSessionId && ids.includes(activeSessionId)) {
      set({ sessions, currentAgentId: null, activeSessionIdOverride: null })
    } else {
      const overrideId = get().activeSessionIdOverride
      set({
        sessions,
        activeSessionIdOverride: overrideId && ids.includes(overrideId) ? null : overrideId,
      })
    }
  },
  togglePinSession: async (id) => {
    const sessions = { ...get().sessions }
    if (!sessions[id]) return
    const wasPinned = sessions[id].pinned
    sessions[id] = { ...sessions[id], pinned: !wasPinned }
    invalidateFingerprint('sessions')
    set({ sessions })
    try {
      await api('PUT', `/chats/${id}`, { pinned: !wasPinned })
    } catch (err: unknown) {
      console.warn('Pin toggle failed:', err)
      await get().loadSessions()
    }
  },
  updateSessionInStore: (session) => {
    invalidateFingerprint('sessions')
    setIfChanged<AppState>(set, 'sessions', { ...get().sessions, [session.id]: session })
  }
})
