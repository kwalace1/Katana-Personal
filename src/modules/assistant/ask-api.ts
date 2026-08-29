import { localDb } from '@/lib/local-db'
import { createId } from '@/lib/id'

const MESSAGES = 'ask_messages'

export type AskRole = 'you' | 'katana'

export interface AskAction {
  id: string
  label: string
  kind:
    | 'complete_task'
    | 'toggle_habit'
    | 'log_water'
    | 'open_route'
    | 'create_task'
    | 'create_event'
    | 'park_tasks'
    | 'upsert_journal'
    | 'close_day'
    | 'create_goal'
    | 'create_habit'
  taskId?: string
  habitId?: string
  route?: string
  title?: string
  dueAt?: string | null
  startsAt?: string
  endsAt?: string
  /** Journal body for upsert_journal / close_day */
  body?: string
}

export interface AskMessage {
  id: string
  user_id: string
  role: AskRole
  text: string
  actions: AskAction[]
  created_at: string
  /** True when this reply came from the deeper LLM agent (memory / streaming). */
  viaLlm?: boolean
}

function now() {
  return new Date().toISOString()
}

function normalize(msg: AskMessage): AskMessage {
  return {
    ...msg,
    actions: Array.isArray(msg.actions) ? msg.actions : [],
    viaLlm: Boolean(msg.viaLlm),
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
    input: { role: AskRole; text: string; actions?: AskAction[]; viaLlm?: boolean },
  ): AskMessage {
    return normalize(
      localDb.insert(MESSAGES, userId, {
        id: createId(),
        user_id: userId,
        role: input.role,
        text: input.text,
        actions: input.actions || [],
        viaLlm: Boolean(input.viaLlm),
        created_at: now(),
      }),
    )
  },

  update(
    userId: string,
    messageId: string,
    patch: Partial<Pick<AskMessage, 'text' | 'actions' | 'viaLlm'>>,
  ): AskMessage | null {
    const updated = localDb.update<AskMessage>(MESSAGES, userId, messageId, patch)
    return updated ? normalize(updated) : null
  },

  /** Remove a spent action chip from a message. */
  consumeAction(userId: string, messageId: string, actionId: string): void {
    const msg = localDb.getById<AskMessage>(MESSAGES, userId, messageId)
    if (!msg) return
    localDb.update<AskMessage>(MESSAGES, userId, messageId, {
      actions: (msg.actions || []).filter((a) => a.id !== actionId),
    })
  },

  clear(userId: string): void {
    localDb.replaceAll(MESSAGES, userId, [])
  },
}
