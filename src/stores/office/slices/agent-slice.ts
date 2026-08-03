import { StateCreator } from 'zustand'
import type { AppState } from '@/stores/office/use-app-store'
import type { Session, Sessions, Agent, ExternalAgentRuntime, ProviderType } from '@/lib/office/types'
import { fetchAgents, bulkPatchAgents } from '@/lib/office/agents'
import { createChat } from '@/lib/office/chat/chats'
import { api } from '@/lib/office/app/api-client'
import { safeStorageRemove, safeStorageSet } from '@/lib/office/app/safe-storage'
import { applyPinnedOverlay, setAgentPinned } from '@/lib/office/agent-pins'
import { invalidateFingerprint, setIfChanged } from '@/stores/office/set-if-changed'
import { createLoader, createInflightDeduplicator } from '@/stores/office/store-utils'

const agentThreadDedup = createInflightDeduplicator('agentSlice_inflightLoads')

/**
 * The signed-in user's most-recent chat session for an agent. Sessions in the
 * store are already scoped to the caller (the office proxy filters `GET /chats`
 * by owner), so any human session with this agentId belongs to this user.
 */
function pickOwnAgentSession(sessions: Sessions, agentId: string): Session | null {
  let best: Session | null = null
  let bestScore = -Infinity
  for (const s of Object.values(sessions)) {
    if (s.agentId !== agentId) continue
    if (s.sessionType && s.sessionType !== 'human') continue
    const score = s.lastActiveAt || s.lastAssistantAt || s.updatedAt || s.createdAt || 0
    if (score > bestScore) { bestScore = score; best = s }
  }
  return best
}

export interface AgentSlice {
  currentAgentId: string | null
  setCurrentAgent: (id: string | null) => Promise<void>
  agents: Record<string, Agent>
  loadAgents: () => Promise<void>
  updateAgentInStore: (agent: Agent) => void
  togglePinAgent: (id: string) => Promise<void>
  trashedAgents: Record<string, Agent>
  loadTrashedAgents: () => Promise<void>
  batchUpdateAgents: (patches: Array<{ id: string; patch: Partial<Agent> }>) => Promise<void>
  externalAgents: ExternalAgentRuntime[]
  loadExternalAgents: () => Promise<void>
}

export const createAgentSlice: StateCreator<AppState, [], [], AgentSlice> = (set, get) => ({
  currentAgentId: null,
  setCurrentAgent: async (id) => {
    if (!id) {
      set({ currentAgentId: null, activeSessionIdOverride: null })
      safeStorageRemove('sc_agent')
      return
    }
    // Early-out only when the agent is already pointed at a session THIS user
    // owns (present in the filtered store), not the engine's shared thread.
    const existingId = get().agents[id]?.threadSessionId
    if (get().currentAgentId === id && existingId && get().sessions[existingId]) {
      set({ activeSessionIdOverride: null })
      return
    }
    set({ currentAgentId: id, activeSessionIdOverride: null })
    safeStorageSet('sc_agent', id)

    await agentThreadDedup.dedup(id, async () => {
      try {
        const owner = get().currentUserId || get().currentUser || 'default'

        // 1. Reuse the user's own session for this agent if we already have it.
        let session = pickOwnAgentSession(get().sessions, id)
        // 2. Not in the store yet — refresh once so we don't create a duplicate.
        if (!session) {
          await get().loadSessions()
          session = pickOwnAgentSession(get().sessions, id)
        }
        // 3. Still none — create a per-user session for this agent. Unlike the
        //    engine's shared /agents/:id/thread, POST /chats honors `user`, so
        //    each signed-in person gets their own isolated conversation.
        if (!session) {
          const agent = get().agents[id]
          if (agent) {
            session = await createChat(
              agent.name, '', owner,
              agent.provider as ProviderType, agent.model,
              agent.credentialId ?? null, agent.apiEndpoint ?? null,
              'human', id,
              agent.tools ?? [], agent.extensions ?? [],
            )
          }
        }

        if (session?.id) {
          const agents = { ...get().agents }
          if (agents[id]) agents[id] = { ...agents[id], threadSessionId: session.id }
          const sessions = { ...get().sessions, [session.id]: session }
          invalidateFingerprint('sessions')
          set({ sessions, agents })
        }
      } catch (err: unknown) {
        console.warn('Per-user agent session setup failed:', err)
      }
    })
  },
  agents: {},
  loadAgents: createLoader<AppState>(set, 'agents', async () =>
    applyPinnedOverlay(await fetchAgents(), get().currentUserId ?? get().currentUser),
  ),
  updateAgentInStore: (agent) => {
    invalidateFingerprint('agents')
    setIfChanged<AppState>(set, 'agents', { ...get().agents, [agent.id]: agent })
  },
  togglePinAgent: async (id) => {
    const agents = { ...get().agents }
    if (!agents[id]) return
    const nextPinned = !agents[id].pinned
    agents[id] = { ...agents[id], pinned: nextPinned }
    invalidateFingerprint('agents')
    set({ agents })
    // The engine doesn't persist `pinned`, so keep it per-user in localStorage
    // and overlay it back on every loadAgents (see agent-pins).
    setAgentPinned(get().currentUserId ?? get().currentUser, id, nextPinned)
  },
  batchUpdateAgents: async (patches) => {
    // Optimistic update
    const agents = { ...get().agents }
    for (const { id, patch } of patches) {
      if (agents[id]) {
        agents[id] = { ...agents[id], ...patch, updatedAt: Date.now() }
      }
    }
    invalidateFingerprint('agents')
    set({ agents })
    try {
      await bulkPatchAgents(patches)
      await get().loadAgents()
    } catch (err: unknown) {
      console.warn('Bulk agent update failed:', err)
      await get().loadAgents()
    }
  },
  trashedAgents: {},
  loadTrashedAgents: createLoader<AppState>(set, 'trashedAgents', () => api<Record<string, Agent>>('GET', '/agents/trash')),
  externalAgents: [],
  loadExternalAgents: createLoader<AppState>(set, 'externalAgents', () => api<ExternalAgentRuntime[]>('GET', '/external-agents'))
})
