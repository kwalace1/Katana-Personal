import { localDb } from '@/lib/local-db'
import { createId } from '@/lib/id'

const MESSAGES = 'ask_messages'

export type AskRole = 'you' | 'katana'

export interface AskAction {
  id: string
  label: string
  kind: 'complete_task' | 'toggle_habit' | 'log_water' | 'open_route'
  taskId?: string
  habitId?: string
  route?: string
}

export interface AskMessage {
  id: string
  user_id: string
  role: AskRole
  text: string
  actions: AskAction[]
  created_at: string
}

function now() {
  return new Date().toISOString()
}

function normalize(msg: AskMessage): AskMessage {
  return {
    ...msg,
    actions: Array.isArray(msg.actions) ? msg.actions : [],
  }
}

export const askApi = {
  list(userId: string): AskMessage[] {
    return localDb
      .list<AskMessage>(MESSAGES, userId)
      .map(normalize)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  },

  append(
    userId: string,
    input: { role: AskRole; text: string; actions?: AskAction[] },
  ): AskMessage {
    return normalize(
      localDb.insert(MESSAGES, userId, {
        id: createId(),
        user_id: userId,
        role: input.role,
        text: input.text,
        actions: input.actions || [],
        created_at: now(),
      }),
    )
  },

  clear(userId: string): void {
    localDb.replaceAll(MESSAGES, userId, [])
  },
}
