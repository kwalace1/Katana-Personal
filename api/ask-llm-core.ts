/**
 * Shared Ask LLM helpers — OpenRouter → Gemini Flash.
 * Used by Vercel `/api/ask-llm` and the Vite dev middleware.
 */

export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash'

/** Tunable Katana Ask voice — edit here to change how the model behaves. */
export const KATANA_ASK_SYSTEM_PROMPT = `You are Katana Ask — a calm personal day guide inside Katana Personal.

Voice:
- Warm, brief, and practical. Prefer 2–3 short sentences.
- Never sound like a generic chatbot or a corporate coach.
- No emoji unless the user used them first.
- Never say “no cloud AI” or that you cannot help with tasks — you guide and draft actions.

Facts:
- Only use the life snapshot provided. Do not invent tasks, events, habits, or numbers.
- If something isn’t in the snapshot, say you don’t see it here and suggest a concrete next step.

Actions:
- You do not write to the database yourself in this mode. Instead, steer the user to a short command the app can run with a confirm chip, e.g.:
  - “add Call Mom Friday 3pm”
  - “schedule dentist tomorrow 9am”
  - “close my day”
  - “what should I work on”
- If they want to create something, ask for the title (and optional day/time) in that exact phrasing.
- Prefer one clear next step over a long list.`

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
}

export type AskLlmRequest = {
  question: string
  snapshot: CompactLifeSnapshot
}

export type AskLlmResult =
  | { ok: true; text: string; model: string }
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
  return [
    `Name: ${snap.name}`,
    `Today: ${snap.todayLabel}`,
    `Priority tasks: ${snap.priorityTaskTitles.join('; ') || 'none'}`,
    `Today’s tasks: ${snap.todayTaskTitles.join('; ') || 'none'}`,
    `Open tasks: ${snap.openTaskTitles.join('; ') || 'none'}`,
    `Today’s events: ${snap.todayEventTitles.join('; ') || 'none'}`,
    `Upcoming: ${snap.upcomingEventTitles.join('; ') || 'none'}`,
    `Habits still open: ${snap.habitsOpen.join('; ') || 'none'}`,
    `Habits done today: ${snap.habitsDone.join('; ') || 'none'}`,
    `Goals: ${snap.goalTitles.join('; ') || 'none'}`,
    `Behind on goals: ${snap.behindGoalTitles.join('; ') || 'none'}`,
    `Journal today: ${snap.journalToday ? `yes (${snap.journalMood || 'mood n/a'})` : 'no'}`,
    `Water: ${snap.waterGlasses} glasses · Sleep last: ${snap.sleepHoursLast || 'n/a'}h · Calories today: ${snap.caloriesToday || 'n/a'}`,
    `This week (${snap.week.label}): ${snap.week.tasksCompleted} tasks done, ${snap.week.habitDays} habit days, ${snap.week.workouts} workouts, ${snap.week.journalEntries} journal entries`,
  ].join('\n')
}

export async function runGeminiAsk(
  body: AskLlmRequest,
  env: { apiKey?: string; model?: string } = {},
): Promise<AskLlmResult> {
  const apiKey = env.apiKey || process.env.OPENROUTER_API_KEY || ''
  const model = (
    env.model ||
    process.env.OPENROUTER_MODEL ||
    process.env.GEMINI_MODEL ||
    DEFAULT_OPENROUTER_MODEL
  ).trim()

  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: 'OPENROUTER_API_KEY is not configured. Add it to .env (local) or Vercel env vars.',
    }
  }

  const question = body.question?.trim()
  if (!question) {
    return { ok: false, status: 400, error: 'Missing question.' }
  }
  if (!body.snapshot || typeof body.snapshot !== 'object') {
    return { ok: false, status: 400, error: 'Missing life snapshot.' }
  }

  const userPrompt = `Life snapshot (facts only):\n${formatSnapshot(body.snapshot)}\n\nUser ask:\n${question}`

  let res: Response
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://katana-personal.vercel.app',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'Katana Personal',
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        max_tokens: 320,
        messages: [
          { role: 'system', content: KATANA_ASK_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    })
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? err.message : 'Network error calling OpenRouter.',
    }
  }

  const raw = (await res.json().catch(() => null)) as {
    error?: { message?: string }
    choices?: { message?: { content?: string | null } }[]
  } | null

  if (!res.ok) {
    return {
      ok: false,
      status: res.status >= 400 && res.status < 600 ? res.status : 502,
      error: raw?.error?.message || `OpenRouter error (${res.status}).`,
    }
  }

  const text = raw?.choices?.[0]?.message?.content?.trim()
  if (!text) {
    return { ok: false, status: 502, error: 'OpenRouter returned an empty reply.' }
  }

  return { ok: true, text, model }
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

  const result = await runGeminiAsk(body, env)
  if (!result.ok) {
    return askLlmJson({ error: result.error }, result.status)
  }
  return askLlmJson({ text: result.text, model: result.model })
}
