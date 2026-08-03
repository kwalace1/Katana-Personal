import { create } from 'zustand'
import type { AuthSlice, SessionSlice, UiSlice, AgentSlice, TaskSlice, DataSlice } from '@/stores/office/slices'
import { createAuthSlice } from '@/stores/office/slices/auth-slice'
import { createSessionSlice } from '@/stores/office/slices/session-slice'
import { createUiSlice } from '@/stores/office/slices/ui-slice'
import { createAgentSlice } from '@/stores/office/slices/agent-slice'
import { createTaskSlice } from '@/stores/office/slices/task-slice'
import { createDataSlice } from '@/stores/office/slices/data-slice'

export type AppState = AuthSlice & SessionSlice & UiSlice & AgentSlice & TaskSlice & DataSlice

export const useAppStore = create<AppState>()((...a) => ({
  ...createAuthSlice(...a),
  ...createSessionSlice(...a),
  ...createUiSlice(...a),
  ...createAgentSlice(...a),
  ...createTaskSlice(...a),
  ...createDataSlice(...a)
}))
