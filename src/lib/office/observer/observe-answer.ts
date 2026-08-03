// Fires the async answer observer. This is strictly best-effort telemetry: it
// must NEVER throw into, block, or otherwise affect the chat experience. The
// edge function does the LLM grounding screen and writes the audit row; here we
// just hand it the answer plus the tool signals only the client knows.
//
// supabase.functions.invoke attaches the signed-in user's session JWT (which the
// function verifies) and the anon apikey automatically.

import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export interface ObservePayload {
  agent_id: string
  agent_name?: string
  session_id?: string
  question: string
  answer: string
  used_sql: boolean
  delegated_to: string[]
  latency_ms?: number
}

export function observeAnswer(payload: ObservePayload): void {
  // Nothing to observe for an empty answer, and don't run if Supabase isn't
  // configured (dev with placeholder env).
  if (!payload.answer?.trim() || !isSupabaseConfigured) return
  try {
    void supabase.functions
      .invoke('agent-observer', { body: payload })
      .catch(() => { /* swallow: telemetry must not disrupt chat */ })
  } catch {
    /* swallow synchronous errors too */
  }
}
