/**
 * Shared Ask LLM helpers — OpenRouter → Gemini Flash.
 * Streaming + tool calling for a life-aware general assistant.
 * Used by Vercel `/api/ask-llm` and the Vite dev middleware.
 */

export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash'

/** General AI that already sees the user’s Katana life data. */
export const KATANA_ASK_SYSTEM_PROMPT = `You are Katana Ask — a capable general assistant inside Katana Personal who already sees the user’s life data.

You can:
- Answer general questions (ideas, explanations, planning, writing, decisions) like a strong chat AI.
- Use the life snapshot and chat history to ground answers in their real tasks, calendar, habits, goals, journal, and health.
- Take action in Katana via tools when they want something done (create/complete tasks, habits, events, water, journal, park tasks, close day).

Hard rules:
- Be useful and specific. Prefer clear structure when answers are longer (short paragraphs or tight bullets).
- Never invent tasks, events, habits, goals, or numbers that aren’t in the snapshot or tool results.
- If something isn’t in the data, say so briefly and still help with a concrete next step.
- No emoji unless the user used them first.
- Never claim you lack access to their life data when a snapshot is provided.
- Never say you cannot create tasks/events — use tools (or ask one clarifying question if critical info is missing).
- When acting, call tools instead of only telling them what to type.
- After tools run, confirm what changed in plain language.
- Stay conversational across turns — use prior messages; don’t restart from zero.
- When context_gaps lists missing areas (habits, calendar, sleep, etc.), weave in one brief encouragement to log or connect more — in your personality voice — so you can map their day better. Never preach; name what's missing.`

export type AskPersonalityId = 'supportive' | 'tough' | 'dry' | 'spicy'

const PERSONALITY_OVERLAY: Record<AskPersonalityId, string> = {
  supportive: `Personality — Supportive:
- Warm, human, slightly witty — like a sharp friend who texts back fast.
- Celebrate small wins without being syrupy.
- Avoid corporate wellness speak.`,
  tough: `Personality — Tough love:
- Direct and a little blunt. Skip soft openers.
- Call out avoidance firmly. Always end with one clear next move.`,
  dry: `Personality — Dry humor:
- Understated wit. Deadpan ok. Never try-hard. One joke max, then the point.`,
  spicy: `Personality — Spicy:
- Light sarcasm about procrastination. Roast the excuse, never the person.
- Always redeem with a clear next step.`,
}

export function resolveAskSystemPrompt(personality?: string | null): string {
  const mode: AskPersonalityId =
    personality === 'tough' || personality === 'dry' || personality === 'spicy' || personality === 'supportive'
      ? personality
      : 'supportive'
  return `${KATANA_ASK_SYSTEM_PROMPT}\n\n${PERSONALITY_OVERLAY[mode]}`
}

export type CompactTask = { id: string; title: string; dueAt?: string | null }
export type CompactHabit = { id: string; title: string; done: boolean }
export type CompactGoal = {
  id: string
  title: string
  progress: number
  target: number
  horizon: string
}
export type CompactEvent = { title: string; startsAt: string; allDay?: boolean }
export type CompactJournal = { date: string; mood: string | null; excerpt: string }

export type CompactLifeSnapshot = {
  name: string
  todayLabel: string
  openTaskTitles: string[]
  todayTaskTitles: string[]
  priorityTaskTitles: string[]
  todayEventTitles: string[]
  upcomingEventTitles: string[]
  habitsOpen: string[]
  habitsDone: string[]
  goalTitles: string[]
  behindGoalTitles: string[]
  journalToday: boolean
  journalMood: string | null
  waterGlasses: number
  sleepHoursLast: number
  caloriesToday: number
  week: {
    label: string
    tasksCompleted: number
    habitDays: number
    workouts: number
    journalEntries: number
  }
  /** Richer fields for tool calling + deeper context */
  openTasks?: CompactTask[]
  todayTasks?: CompactTask[]
  priorityTasks?: CompactTask[]
  habits?: CompactHabit[]
  goals?: CompactGoal[]
  behindGoals?: CompactGoal[]
  todayEvents?: CompactEvent[]
  upcomingEvents?: CompactEvent[]
  recentJournal?: CompactJournal[]
  contextGapLabels?: string[]
  richnessScore?: number
}

export type AskToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type AskChatMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null
  tool_call_id?: string
  name?: string
  tool_calls?: AskToolCall[]
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

export const ASK_TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'create_task',
      description: 'Create a new task in Katana.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          dueAt: { type: 'string', description: 'Optional ISO-8601 or YYYY-MM-DD due date' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'complete_task',
      description: 'Mark an open task done. Prefer taskId from the snapshot; title match is ok.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          title: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'toggle_habit',
      description: 'Check or uncheck a habit due today.',
      parameters: {
        type: 'object',
        properties: {
          habitId: { type: 'string' },
          title: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_event',
      description: 'Schedule a calendar event.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          startsAt: { type: 'string', description: 'ISO-8601 start' },
          endsAt: { type: 'string', description: 'ISO-8601 end' },
        },
        required: ['title', 'startsAt', 'endsAt'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'log_water',
      description: 'Log drinking water (glasses).',
      parameters: {
        type: 'object',
        properties: {
          glasses: { type: 'number', description: 'Glasses to add (default 1)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'upsert_journal',
      description: 'Write or update today’s journal entry.',
      parameters: {
        type: 'object',
        properties: {
          body: { type: 'string' },
          mood: { type: 'string', enum: ['great', 'good', 'okay', 'low', 'rough'] },
        },
        required: ['body'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'park_tasks',
      description: 'Move unfinished today tasks to tomorrow.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'close_day',
      description: 'Close the day: park leftover tasks and optionally journal a note.',
      parameters: {
        type: 'object',
        properties: {
          note: { type: 'string' },
        },
      },
    },
  },
]

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

  return [
    `Name: ${snap.name}`,
    `Today: ${snap.todayLabel}`,
    `Data richness: ${snap.richnessScore != null ? `${Math.round(snap.richnessScore * 100)}%` : 'unknown'}${snap.contextGapLabels?.length ? ` — sparse; missing: ${snap.contextGapLabels.join(', ')}` : ''}`,
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
    `Water: ${snap.waterGlasses} glasses · Sleep last: ${snap.sleepHoursLast || 'n/a'}h · Calories today: ${snap.caloriesToday || 'n/a'}`,
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
  if (personality === 'spicy' || personality === 'dry') return 0.75
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
        ...(useTools ? { tools: ASK_TOOL_DEFINITIONS, tool_choice: 'auto' } : {}),
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
        ...(useTools ? { tools: ASK_TOOL_DEFINITIONS, tool_choice: 'auto' } : {}),
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
