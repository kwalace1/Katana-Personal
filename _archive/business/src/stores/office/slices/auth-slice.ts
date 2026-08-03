import { StateCreator } from 'zustand'
import type { AppState } from '@/stores/office/use-app-store'
import { safeStorageGet, safeStorageRemove, safeStorageSet } from '@/lib/office/app/safe-storage'
import { applyPinnedOverlay } from '@/lib/office/agent-pins'
import { invalidateFingerprint } from '@/stores/office/set-if-changed'

export interface AuthSlice {
  currentUser: string | null
  /**
   * Stable per-user identity (the Katana/Supabase user id). Used as the office
   * session `user` so each signed-in person owns their own chat threads — the
   * office proxy filters sessions by this. Kept separate from `currentUser`,
   * which is the human-readable display name.
   */
  currentUserId: string | null
  _hydrated: boolean
  hydrate: () => void
  setUser: (user: string | null) => void
  setUserId: (id: string | null) => void
}

export const createAuthSlice: StateCreator<AppState, [], [], AuthSlice> = (set, get) => ({
  currentUser: null,
  currentUserId: null,
  _hydrated: false,
  hydrate: () => {
    const user = safeStorageGet('sc_user')
    const savedAgentId = safeStorageGet('sc_agent')
    set({ currentUser: user, currentAgentId: savedAgentId, _hydrated: true })
  },
  setUser: (user) => {
    if (user) safeStorageSet('sc_user', user)
    else safeStorageRemove('sc_user')
    set({ currentUser: user })
  },
  setUserId: (id) => {
    set({ currentUserId: id })
    // Now that we know the user, re-apply their persisted agent pins to any
    // already-loaded agents (loadAgents may have run before the id was known).
    const agents = get().agents
    if (agents && Object.keys(agents).length > 0) {
      invalidateFingerprint('agents')
      set({ agents: applyPinnedOverlay(agents, id ?? get().currentUser) })
    }
  },
})
