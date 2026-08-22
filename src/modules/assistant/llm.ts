import type { AskReply, LifeSnapshot } from './engine'
import type { AskAction } from './ask-api'
import { executeAskTools } from './ask-tools'
import { createId } from '@/lib/id'
import type { AskChatMessage, AskToolCall, CompactLifeSnapshot } from './ask-llm-types'

export type { CompactLifeSnapshot, AskChatMessage, AskToolCall }

export function compactSnapshot(snap: LifeSnapshot): CompactLifeSnapshot {
  const done = new Set(snap.habitsDoneIds)
  const toTask = (t: { id: string; title: string; due_at?: string | null }) => ({
    id: t.id,
    title: t.title,
    dueAt: t.due_at ?? null,
  })

  return {
    name: snap.name,
    todayLabel: snap.todayLabel,
    openTaskTitles: snap.openTasks.slice(0, 8).map((t) => t.title),
    todayTaskTitles: snap.todayTasks.slice(0, 8).map((t) => t.title),
    priorityTaskTitles: snap.priorityTasks.slice(0, 5).map((t) => t.title),
    todayEventTitles: snap.todayEvents.slice(0, 6).map((e) => e.title),
    upcomingEventTitles: snap.upcomingEvents.slice(0, 6).map((e) => e.title),
    habitsOpen: snap.habitsDue.filter((h) => !done.has(h.id)).map((h) => h.title),
    habitsDone: snap.habitsDue.filter((h) => done.has(h.id)).map((h) => h.title),
    goalTitles: snap.activeGoals.slice(0, 5).map((g) => g.title),
    behindGoalTitles: snap.behindGoals.slice(0, 4).map((g) => g.title),
    journalToday: snap.journalToday,
    journalMood: snap.journalMood,
    waterGlasses: snap.waterGlasses,
    sleepHoursLast: snap.sleepHoursLast,
    caloriesToday: snap.caloriesToday,
    week: {
      label: snap.week.label,
      tasksCompleted: snap.week.tasksCompleted,
      habitDays: snap.week.habitCheckInDays,
      workouts: snap.week.workouts + snap.week.lifts,
      journalEntries: snap.week.journalDays,
    },
    openTasks: snap.openTasks.slice(0, 12).map(toTask),
    todayTasks: snap.todayTasks.slice(0, 10).map(toTask),
    priorityTasks: snap.priorityTasks.slice(0, 6).map(toTask),
    habits: snap.habitsDue.slice(0, 12).map((h) => ({
      id: h.id,
      title: h.title,
      done: done.has(h.id),
    })),
    goals: snap.activeGoals.slice(0, 8).map((g) => ({
      id: g.id,
      title: g.title,
      progress: g.progress,
      target: g.target,
      horizon: g.horizon,
    })),
    behindGoals: snap.behindGoals.slice(0, 5).map((g) => ({
      id: g.id,
      title: g.title,
      progress: g.progress,
      target: g.target,
      horizon: g.horizon,
    })),
    todayEvents: snap.todayEvents.slice(0, 8).map((e) => ({
      title: e.title,
      startsAt: e.starts_at,
      allDay: e.all_day,
    })),
    upcomingEvents: snap.upcomingEvents.slice(0, 8).map((e) => ({
      title: e.title,
      startsAt: e.starts_at,
      allDay: e.all_day,
    })),
    recentJournal: (snap.recentJournal || []).slice(0, 5),
  }
}

export type AskStreamHandlers = {
  onDelta?: (text: string) => void
  onStatus?: (label: string) => void
}

export type AskAgentResult = {
  text: string
  model: string
  actions: AskAction[]
  usedLlm: boolean
}

type StreamEvent =
  | { type: 'delta'; text?: string }
  | { type: 'tool_calls'; tool_calls?: AskToolCall[] }
  | { type: 'done'; model?: string }
  | { type: 'error'; error?: string }

async function streamAskLlm(
  body: Record<string, unknown>,
  onDelta: (text: string) => void,
): Promise<{ text: string; model: string; tool_calls: AskToolCall[] }> {
  const res = await fetch('/api/ask-llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, stream: true }),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error || `Ask LLM failed (${res.status})`)
  }

  const ctype = res.headers.get('content-type') || ''
  if (ctype.includes('application/json')) {
    const data = (await res.json()) as {
      text?: string
      model?: string
      tool_calls?: AskToolCall[]
      error?: string
    }
    if (data.error) throw new Error(data.error)
    const text = data.text || ''
    if (text) onDelta(text)
    return {
      text,
      model: data.model || 'gemini',
      tool_calls: Array.isArray(data.tool_calls) ? data.tool_calls : [],
    }
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response stream')

  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let model = 'gemini'
  let tool_calls: AskToolCall[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''

    for (const part of parts) {
      const line = part
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.startsWith('data:'))
      if (!line) continue
      const raw = line.slice(5).trim()
      if (!raw || raw === '[DONE]') continue
      let ev: StreamEvent
      try {
        ev = JSON.parse(raw) as StreamEvent
      } catch {
        continue
      }
      if (ev.type === 'delta' && ev.text) {
        text += ev.text
        onDelta(ev.text)
      } else if (ev.type === 'tool_calls' && ev.tool_calls?.length) {
        tool_calls = ev.tool_calls
      } else if (ev.type === 'done' && ev.model) {
        model = ev.model
      } else if (ev.type === 'error') {
        throw new Error(ev.error || 'Stream error')
      }
    }
  }

  return { text: text.trim(), model, tool_calls }
}

/** Build prior chat turns for the model (excludes system snapshot). */
export function historyToAskMessages(
  messages: { role: 'you' | 'katana'; text: string }[],
  limit = 16,
): AskChatMessage[] {
  return messages
    .filter((m) => m.text.trim())
    .slice(-limit)
    .map((m) => ({
      role: m.role === 'you' ? ('user' as const) : ('assistant' as const),
      content: m.text,
    }))
}

function dedupeActions(actions: AskAction[]): AskAction[] {
  const seen = new Set<string>()
  const out: AskAction[] = []
  for (const a of actions) {
    const key = `${a.kind}:${a.route || ''}:${a.taskId || ''}:${a.habitId || ''}:${a.title || ''}:${a.label}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(a.id ? a : { ...a, id: createId() })
  }
  return out
}

/**
 * Multi-turn agent: tools run locally, then model continues.
 * Streams text deltas when the model is writing.
 */
export async function resolveAskAgent(
  userId: string,
  question: string,
  snap: LifeSnapshot,
  fallback: AskReply,
  opts: {
    personality?: string | null
    history?: AskChatMessage[]
    handlers?: AskStreamHandlers
  } = {},
): Promise<AskAgentResult> {
  const snapshot = compactSnapshot(snap)
  const personality = opts.personality || 'supportive'
  const handlers = opts.handlers
  const actions: AskAction[] = [...fallback.actions.slice(0, 2)]
  let messages: AskChatMessage[] = [...(opts.history || [])]

  const last = messages[messages.length - 1]
  if (!(last?.role === 'user' && last.content === question)) {
    messages.push({ role: 'user', content: question })
  }

  let model = 'gemini'
  const maxRounds = 4

  try {
    for (let round = 0; round < maxRounds; round++) {
      handlers?.onStatus?.(round === 0 ? 'Thinking…' : 'Acting on your life data…')

      let streamed = ''
      const result = await streamAskLlm(
        { snapshot, personality, messages, tools: true },
        (delta) => {
          streamed += delta
          handlers?.onDelta?.(delta)
        },
      )

      model = result.model

      if (result.tool_calls.length) {
        handlers?.onStatus?.('Updating your day…')
        const exec = executeAskTools(userId, result.tool_calls)
        for (const r of exec) {
          if (r.action) actions.push(r.action)
        }

        messages = [
          ...messages,
          {
            role: 'assistant',
            content: result.text || streamed || null,
            tool_calls: result.tool_calls,
          },
          ...exec.map((r) => ({
            role: 'tool' as const,
            tool_call_id: r.toolCallId,
            name: r.name,
            content: JSON.stringify({ ok: r.ok, message: r.message }),
          })),
        ]
        continue
      }

      const text = result.text || streamed
      if (!text) {
        return {
          text: actions.length ? 'Done — I updated your day.' : fallback.text,
          model,
          actions: dedupeActions([...actions, ...fallback.actions]).slice(0, 6),
          usedLlm: true,
        }
      }

      return {
        text,
        model,
        actions: dedupeActions([...actions, ...fallback.actions]).slice(0, 6),
        usedLlm: true,
      }
    }

    return {
      text: 'I hit a limit on tool steps — try a shorter ask, or tap a chip.',
      model,
      actions: dedupeActions([...actions, ...fallback.actions]).slice(0, 6),
      usedLlm: true,
    }
  } catch {
    return {
      text: fallback.text,
      model,
      actions: fallback.actions,
      usedLlm: false,
    }
  }
}

export async function askLlm(
  question: string,
  snapshot: CompactLifeSnapshot,
  personality?: string | null,
): Promise<{ text: string; model: string }> {
  const res = await fetch('/api/ask-llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      snapshot,
      personality: personality || 'supportive',
      tools: false,
      stream: false,
    }),
  })
  const data = (await res.json().catch(() => null)) as
    | { text?: string; model?: string; error?: string }
    | null
  if (!res.ok) {
    throw new Error(data?.error || `Ask LLM failed (${res.status})`)
  }
  if (!data?.text) {
    throw new Error('Ask LLM returned an empty reply')
  }
  return { text: data.text, model: data.model || 'gemini' }
}

/** Resolve open-ended asks via Gemini; fall back to rules text on failure. */
export async function resolveWithLlm(
  question: string,
  snap: LifeSnapshot,
  fallback: AskReply,
  personality?: string | null,
  userId = '',
): Promise<AskReply> {
  const result = await resolveAskAgent(userId, question, snap, fallback, { personality })
  return { text: result.text, actions: result.actions }
}
