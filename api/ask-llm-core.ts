/**
 * Shared Ask LLM helpers — OpenRouter → Gemini Flash.
 * Streaming + tool calling for a life-aware accountability companion.
 * Used by Vercel `/api/ask-llm` and the Vite dev middleware.
 *
 * Compact snapshot types + ASK_TOOL_DEFINITIONS live in
 * `src/modules/assistant/ask-llm-types.ts` (single source of truth).
 */

import {
  ASK_TOOL_DEFINITIONS,
  type AskChatMessage,
  type AskToolCall,
  type CompactLifeSnapshot,
} from '../src/modules/assistant/ask-llm-types'

export {
  ASK_TOOL_DEFINITIONS,
  ASK_TOOL_NAMES,
  type AskChatMessage,
  type AskToolCall,
  type AskToolName,
  type CompactCommitment,
  type CompactEvent,
  type CompactGoal,
  type CompactHabit,
  type CompactJournal,
  type CompactLifeSnapshot,
  type CompactTask,
} from '../src/modules/assistant/ask-llm-types'

export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash'

/** Companion / accountability coach that already sees the user’s Katana life data. */
export const KATANA_ASK_SYSTEM_PROMPT = `You are Katana Ask — the user’s companion and accountability coach inside Katana Personal. You already see their life data for today.

Who you are:
- A sidekick for the day loop: pick the next step, do it, stay honest, close the day.
- Warm enough to feel like a companion; sharp enough to keep them accountable.
- Not a generic chatbot, therapist brochure, or project-management bot.

You can:
- Ground every reply in their real tasks, calendar, habits, goals, journal, health, and personal memories from the life snapshot.
- Use personal memories (preferences and confirmed facts) to tailor tone and next steps — appropriately, not as a dump of everything you know.
- Answer planning / writing / decision questions when asked — still steer back to what matters today when it fits.
- Take action in Katana via tools (tasks, commitments, habits, goals, events, workout blocks, water, journal, park tasks, close day).

How you coach:
- Default to ONE clear next move tied to priority / today’s tasks, open habits, or the next calendar block.
- Prefer “do this now” over long option menus. If they need a plan, keep it to 2–4 short steps max.
- When they stall, name the avoidance briefly and offer the smallest honest step.
- When they want to be held accountable (“hold me to X”, “make me do X”, “don’t let me skip”), call make_commitment (preferred) or create_task, then confirm you’ll check back next time they open Ask.
- Celebrate real progress lightly; don’t cheer empty intentions.
- Stay with them across turns — use chat history; don’t restart from zero.

Hard rules:
- Never invent tasks, events, habits, goals, memories, or numbers that aren’t in the snapshot or tool results.
- Personal memories marked unconfirmed / inferred / pattern are NOT facts — say so if you lean on them, or prefer confirmed preferences and facts.
- Never silently create durable personal memories. The app only stores memories when the user explicitly says “remember…”. Chat history is not memory.
- If something isn’t in the data, say so briefly and still help with a concrete next step.
- No emoji unless the user used them first.
- Never claim you lack access to their life data when a snapshot is provided.
- Never say you cannot create tasks/events — use tools (or ask one clarifying question if critical info is missing).
- When acting, call tools instead of only telling them what to type.
- After tools run, confirm what changed and what happens next.
- Prefer short paragraphs or tight bullets when longer answers help.
- When context_gaps lists missing areas (habits, calendar, sleep, etc.), weave in one brief encouragement to log or connect more — in your personality voice. Never preach; name what’s missing.`

export type AskPersonalityId = 'supportive' | 'tough' | 'dry'

const PERSONALITY_OVERLAY: Record<AskPersonalityId, string> = {
  supportive: `Personality — Supportive companion coach:
- Warm, human, slightly witty — like a sharp friend who texts back fast.
- Celebrate small wins without being syrupy.
- Name the friction, then make the next step feel doable.
- Prefer “we” lightly (“Let’s knock this out”) when it fits.
- Avoid corporate wellness speak (“leverage,” “optimize your day”).`,
  tough: `Personality — Tough love accountability coach:
- Sound like a sharp training partner, not a therapist brochure.
- Direct and a little blunt. Skip soft openers.
- Call out avoidance firmly (“That’s stalling. Pick one.”).
- Celebrate only when they actually did the thing.
- Always end with one clear next move.`,
  dry: `Personality — Dry humor companion:
- Understated wit. Deadpan ok. Never try-hard or meme-speak.
- Treat their day like a slightly absurd project you respect.
- One joke max per reply, then the next step.
- Keep advice concrete under the humor.`,
}

export function resolveAskSystemPrompt(personality?: string | null): string {
  const mode: AskPersonalityId =
    personality === 'tough' || personality === 'dry' || personality === 'supportive'
      ? personality
      : 'supportive'
  return `${KATANA_ASK_SYSTEM_PROMPT}\n\n${PERSONALITY_OVERLAY[mode]}`
}

export type AskLlmRequest = {
  question?: string
  snapshot: CompactLifeSnapshot
  personality?: AskPersonalityId | string | null
  /** Prior turns (user/assistant/tool). Current question may be last user message or `question`. */
  messages?: AskChatMessage[]
  /** Prefer SSE token stream when true. */
  stream?: boolean
  /** Enable life-action tools (default true). */
  tools?: boolean
}

export type AskLlmResult =
  | { ok: true; text: string; model: string; tool_calls?: AskToolCall[] }
  | { ok: false; error: string; status: number }

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export function askLlmOptionsResponse(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export function askLlmJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  })
}

function formatSnapshot(snap: CompactLifeSnapshot): string {
  const open =
    snap.openTasks && snap.openTasks.length > 0
      ? snap.openTasks.map((t) => `[${t.id}] ${t.title}${t.dueAt ? ` (due ${t.dueAt})` : ''}`).join('; ')
      : snap.openTaskTitles.join('; ') || 'none'
  const today =
    snap.todayTasks && snap.todayTasks.length > 0
      ? snap.todayTasks.map((t) => `[${t.id}] ${t.title}`).join('; ')
      : snap.todayTaskTitles.join('; ') || 'none'
  const priority =
    snap.priorityTasks && snap.priorityTasks.length > 0
      ? snap.priorityTasks.map((t) => `[${t.id}] ${t.title}`).join('; ')
      : snap.priorityTaskTitles.join('; ') || 'none'
  const habits =
    snap.habits && snap.habits.length > 0
      ? snap.habits.map((h) => `[${h.id}] ${h.title} (${h.done ? 'done' : 'open'})`).join('; ')
      : [
          ...snap.habitsOpen.map((t) => `${t} (open)`),
          ...snap.habitsDone.map((t) => `${t} (done)`),
        ].join('; ') || 'none'
  const goals =
    snap.goals && snap.goals.length > 0
      ? snap.goals.map((g) => `[${g.id}] ${g.title} ${g.progress}/${g.target} (${g.horizon})`).join('; ')
      : snap.goalTitles.join('; ') || 'none'
  const behind =
    snap.behindGoals && snap.behindGoals.length > 0
      ? snap.behindGoals.map((g) => g.title).join('; ')
      : snap.behindGoalTitles.join('; ') || 'none'
  const todayEv =
    snap.todayEvents && snap.todayEvents.length > 0
      ? snap.todayEvents.map((e) => `${e.title} @ ${e.startsAt}`).join('; ')
      : snap.todayEventTitles.join('; ') || 'none'
  const upcoming =
    snap.upcomingEvents && snap.upcomingEvents.length > 0
      ? snap.upcomingEvents.map((e) => `${e.title} @ ${e.startsAt}`).join('; ')
      : snap.upcomingEventTitles.join('; ') || 'none'
  const journalBits =
    snap.recentJournal && snap.recentJournal.length > 0
      ? snap.recentJournal
          .map((j) => `${j.date}${j.mood ? ` (${j.mood})` : ''}: ${j.excerpt}`)
          .join('\n  ')
      : 'none'

  const commitment = snap.activeCommitment
    ? `[${snap.activeCommitment.taskId}] ${snap.activeCommitment.title}`
    : 'none'
  const workload =
    snap.workloadLevel != null
      ? `Workload: ${snap.workloadLevel}${snap.freeMinutes != null ? ` · ~${snap.freeMinutes}m free before next block` : ''}${snap.conflictLabels?.length ? ` · conflicts: ${snap.conflictLabels.join('; ')}` : ''}`
      : null

  const memories =
    snap.personalMemories && snap.personalMemories.length > 0
      ? snap.personalMemories
          .map((m) => {
            // Same certainty rules as src/modules/assistant/memory.ts
            // (confirmed = explicit + confidence >= 1 + kind !== pattern).
            const confirmed =
              m.source === 'explicit' && m.confidence >= 1 && m.kind !== 'pattern'
            const kindLabel =
              m.kind === 'preference'
                ? 'Preference'
                : m.kind === 'pattern'
                  ? 'Pattern'
                  : m.kind === 'fact'
                    ? 'Fact'
                    : 'Note'
            const tag = confirmed ? kindLabel : `${kindLabel} (unconfirmed)`
            return `${tag}: ${m.text}`
          })
          .join('; ')
      : 'none'

  return [
    `Name: ${snap.name}`,
    `Today: ${snap.todayLabel}`,
    `Data richness: ${snap.richnessScore != null ? `${Math.round(snap.richnessScore * 100)}%` : 'unknown'}${snap.contextGapLabels?.length ? ` — sparse; missing: ${snap.contextGapLabels.join(', ')}` : ''}`,
    `Active commitment: ${commitment}`,
    ...(workload ? [workload] : []),
    `Personal memory (user-controlled; do not invent; unconfirmed ≠ fact): ${memories}`,
    `Priority tasks: ${priority}`,
    `Today’s tasks: ${today}`,
    `Open tasks: ${open}`,
    `Today’s events: ${todayEv}`,
    `Upcoming: ${upcoming}`,
    `Habits: ${habits}`,
    `Goals: ${goals}`,
    `Behind on goals: ${behind}`,
    `Journal today: ${snap.journalToday ? `yes (${snap.journalMood || 'mood n/a'})` : 'no'}`,
    `Recent journal:\n  ${journalBits}`,
    `Water: ${snap.waterGlasses} mL logged${snap.waterGoalMl ? ` of a ${snap.waterGoalMl} mL goal` : ''} · Sleep last: ${snap.sleepHoursLast || 'n/a'}h · Calories today: ${snap.caloriesToday || 'n/a'}`,
    `This week (${snap.week.label}): ${snap.week.tasksCompleted} tasks done, ${snap.week.habitDays} habit days, ${snap.week.workouts} workouts, ${snap.week.journalEntries} journal entries`,
  ].join('\n')
}

function normalizeMessages(
  body: AskLlmRequest,
  snapshotBlock: string,
): {
  role: string
  content: string | null
  tool_call_id?: string
  name?: string
  tool_calls?: AskToolCall[]
}[] {
  const system = resolveAskSystemPrompt(body.personality)
  const out: {
    role: string
    content: string | null
    tool_call_id?: string
    name?: string
    tool_calls?: AskToolCall[]
  }[] = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `Life snapshot (facts only — do not invent beyond this):\n${snapshotBlock}`,
    },
  ]

  const history = Array.isArray(body.messages) ? body.messages : []
  for (const m of history) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant' && m.role !== 'tool' && m.role !== 'system')) {
      continue
    }
    if (m.role === 'tool') {
      out.push({
        role: 'tool',
        content: m.content ?? '',
        tool_call_id: m.tool_call_id,
        name: m.name,
      })
      continue
    }
    if (m.role === 'assistant' && m.tool_calls?.length) {
      out.push({
        role: 'assistant',
        content: m.content,
        tool_calls: m.tool_calls,
      })
      continue
    }
    out.push({ role: m.role, content: m.content ?? '' })
  }

  const q = body.question?.trim()
  if (q) {
    const last = history[history.length - 1]
    const already = last?.role === 'user' && (last.content || '').trim() === q
    if (!already) out.push({ role: 'user', content: q })
  }

  return out
}

function openRouterHeaders(apiKey: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://katana-personal.vercel.app',
    'X-Title': process.env.OPENROUTER_APP_NAME || 'Katana Personal',
  }
}

function resolveEnv(env: { apiKey?: string; model?: string } = {}) {
  const apiKey = env.apiKey || process.env.OPENROUTER_API_KEY || ''
  const model = (
    env.model ||
    process.env.OPENROUTER_MODEL ||
    process.env.GEMINI_MODEL ||
    DEFAULT_OPENROUTER_MODEL
  ).trim()
  return { apiKey, model }
}

function temperatureFor(personality?: string | null) {
  if (personality === 'dry') return 0.75
  if (personality === 'tough') return 0.55
  return 0.65
}

type OrChunk = {
  error?: { message?: string }
  choices?: {
    delta?: {
      content?: string | null
      tool_calls?: {
        index?: number
        id?: string
        type?: string
        function?: { name?: string; arguments?: string }
      }[]
    }
    message?: { content?: string | null; tool_calls?: AskToolCall[] }
  }[]
}

function validateBody(body: AskLlmRequest): Extract<AskLlmResult, { ok: false }> | null {
  if (!body.snapshot || typeof body.snapshot !== 'object') {
    return { ok: false, status: 400, error: 'Missing life snapshot.' }
  }
  const hasQuestion = Boolean(body.question?.trim())
  const hasMessages =
    Array.isArray(body.messages) && body.messages.some((m) => m.role === 'user' || m.role === 'tool')
  if (!hasQuestion && !hasMessages) {
    return { ok: false, status: 400, error: 'Missing question or messages.' }
  }
  return null
}

export async function runGeminiAsk(
  body: AskLlmRequest,
  env: { apiKey?: string; model?: string } = {},
): Promise<AskLlmResult> {
  const { apiKey, model } = resolveEnv(env)
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: 'OPENROUTER_API_KEY is not configured. Add it to .env (local) or Vercel env vars.',
    }
  }

  const invalid = validateBody(body)
  if (invalid) return invalid

  const messages = normalizeMessages(body, formatSnapshot(body.snapshot))
  const useTools = body.tools !== false

  let res: Response
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: openRouterHeaders(apiKey),
      body: JSON.stringify({
        model,
        temperature: temperatureFor(body.personality),
        max_tokens: 1200,
        messages,
        ...(useTools ? { tools: [...ASK_TOOL_DEFINITIONS], tool_choice: 'auto' } : {}),
      }),
    })
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? err.message : 'Network error calling OpenRouter.',
    }
  }

  const raw = (await res.json().catch(() => null)) as OrChunk | null

  if (!res.ok) {
    return {
      ok: false,
      status: res.status >= 400 && res.status < 600 ? res.status : 502,
      error: raw?.error?.message || `OpenRouter error (${res.status}).`,
    }
  }

  const msg = raw?.choices?.[0]?.message
  const toolCalls = msg?.tool_calls?.filter((t) => t?.function?.name)
  const text = msg?.content?.trim() || ''

  if (toolCalls?.length) {
    return { ok: true, text, model, tool_calls: toolCalls }
  }
  if (!text) {
    return { ok: false, status: 502, error: 'OpenRouter returned an empty reply.' }
  }
  return { ok: true, text, model }
}

/** SSE stream of Ask events: delta | tool_calls | done | error */
export async function streamGeminiAsk(
  body: AskLlmRequest,
  env: { apiKey?: string; model?: string } = {},
): Promise<Response> {
  const { apiKey, model } = resolveEnv(env)
  if (!apiKey) {
    return askLlmJson(
      { error: 'OPENROUTER_API_KEY is not configured. Add it to .env (local) or Vercel env vars.' },
      503,
    )
  }

  const invalid = validateBody(body)
  if (invalid) return askLlmJson({ error: invalid.error }, invalid.status)

  const messages = normalizeMessages(body, formatSnapshot(body.snapshot))
  const useTools = body.tools !== false

  let upstream: Response
  try {
    upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: openRouterHeaders(apiKey),
      body: JSON.stringify({
        model,
        temperature: temperatureFor(body.personality),
        max_tokens: 1200,
        stream: true,
        messages,
        ...(useTools ? { tools: [...ASK_TOOL_DEFINITIONS], tool_choice: 'auto' } : {}),
      }),
    })
  } catch (err) {
    return askLlmJson(
      { error: err instanceof Error ? err.message : 'Network error calling OpenRouter.' },
      502,
    )
  }

  if (!upstream.ok || !upstream.body) {
    const raw = (await upstream.json().catch(() => null)) as OrChunk | null
    return askLlmJson(
      { error: raw?.error?.message || `OpenRouter error (${upstream.status}).` },
      upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502,
    )
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }

      const toolAcc: Record<
        number,
        { id: string; type: 'function'; function: { name: string; arguments: string } }
      > = {}
      let sawContent = false
      let buffer = ''

      try {
        const reader = upstream.body!.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const data = trimmed.slice(5).trim()
            if (!data || data === '[DONE]') continue

            let chunk: OrChunk
            try {
              chunk = JSON.parse(data) as OrChunk
            } catch {
              continue
            }

            if (chunk.error?.message) {
              send({ type: 'error', error: chunk.error.message })
              controller.close()
              return
            }

            const delta = chunk.choices?.[0]?.delta
            if (delta?.content) {
              sawContent = true
              send({ type: 'delta', text: delta.content })
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0
                if (!toolAcc[idx]) {
                  toolAcc[idx] = {
                    id: tc.id || `call_${idx}`,
                    type: 'function',
                    function: { name: tc.function?.name || '', arguments: tc.function?.arguments || '' },
                  }
                } else {
                  if (tc.id) toolAcc[idx].id = tc.id
                  if (tc.function?.name) toolAcc[idx].function.name += tc.function.name
                  if (tc.function?.arguments) {
                    toolAcc[idx].function.arguments += tc.function.arguments
                  }
                }
              }
            }
          }
        }

        const tool_calls = Object.keys(toolAcc)
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => toolAcc[Number(k)])
          .filter((t) => t.function.name)

        if (tool_calls.length) {
          send({ type: 'tool_calls', tool_calls })
        } else if (!sawContent) {
          send({ type: 'error', error: 'OpenRouter returned an empty reply.' })
        }

        send({ type: 'done', model })
        controller.close()
      } catch (err) {
        send({
          type: 'error',
          error: err instanceof Error ? err.message : 'Stream failed',
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      ...corsHeaders(),
    },
  })
}

export async function handleAskLlmRequest(
  req: Request,
  env?: { apiKey?: string; model?: string },
): Promise<Response> {
  if (req.method === 'OPTIONS') return askLlmOptionsResponse()
  if (req.method !== 'POST') {
    return askLlmJson({ error: 'Method not allowed' }, 405)
  }

  let body: AskLlmRequest
  try {
    body = (await req.json()) as AskLlmRequest
  } catch {
    return askLlmJson({ error: 'Invalid JSON body' }, 400)
  }

  if (body.stream) {
    return streamGeminiAsk(body, env)
  }

  const result = await runGeminiAsk(body, env)
  if (!result.ok) {
    return askLlmJson({ error: result.error }, result.status)
  }
  return askLlmJson({
    text: result.text,
    model: result.model,
    tool_calls: result.tool_calls || [],
  })
}
