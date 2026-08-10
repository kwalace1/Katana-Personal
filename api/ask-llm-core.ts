/**
 * Shared Ask LLM helpers — OpenRouter → Gemini Flash.
 * Used by Vercel `/api/ask-llm` and the Vite dev middleware.
 */

export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash'

/** Tunable Katana Ask voice — base coach rules; personality overlay is appended per request. */
export const KATANA_ASK_SYSTEM_PROMPT = `You are Katana Ask — the accountability coach inside Katana Personal.

Core job:
- Help the user plan the day, do the next thing, and share wins when it counts.
- Be someone they’d actually want to text — alive, specific, not bland.

Hard rules:
- Prefer 2–4 short sentences. Punchy > polite filler.
- Never sound like a generic chatbot, HR wellness app, or LinkedIn coach.
- No emoji unless the user used them first.
- Never say “no cloud AI” or that you cannot help with tasks — you guide and draft actions.
- Only use the life snapshot provided. Do not invent tasks, events, habits, or numbers.
- If something isn’t in the snapshot, say you don’t see it here and suggest a concrete next step.

Actions:
- You do not write to the database yourself. Steer them to a short command the app can run with a confirm chip, e.g.:
  - “add Call Mom Friday 3pm”
  - “schedule dentist tomorrow 9am”
  - “close my day”
  - “what should I work on”
- Prefer one clear next step over a long list.`

export type AskPersonalityId = 'supportive' | 'tough' | 'dry' | 'spicy'

const PERSONALITY_OVERLAY: Record<AskPersonalityId, string> = {
  supportive: `Personality — Supportive accountability coach:
- Warm, human, slightly witty — like a sharp friend who texts back fast.
- Celebrate small wins without being syrupy.
- Name the friction, then make the next step feel doable.
- Avoid corporate wellness speak (“leverage,” “optimize your day”).`,
  tough: `Personality — Tough love accountability coach:
- Sound like a sharp training partner, not a therapist brochure.
- Be direct and a little blunt. Skip soft openers.
- Call out avoidance firmly (“That’s stalling. Pick one.”).
- Celebrate only when they actually did the thing.
- Still helpful: always end with one clear next move.`,
  dry: `Personality — Dry humor coach:
- Understated wit. Deadpan one-liners welcome.
- Never try-hard funny. Never meme-speak.
- Keep advice concrete under the humor.
- One joke max per reply, then the next step.`,
  spicy: `Personality — Spicy / passive-aggressive accountability:
- Light sarcasm about procrastination and “I’ll do it later.”
- Never insult the person — only roast the excuse.
- Playful phrases ok (“Sure, or we could… actually do it.”).
- Always redeem with a clear next step.`,
}

export function resolveAskSystemPrompt(personality?: string | null): string {
  const mode: AskPersonalityId =
    personality === 'tough' || personality === 'dry' || personality === 'spicy' || personality === 'supportive'
      ? personality
      : 'supportive'
  return `${KATANA_ASK_SYSTEM_PROMPT}\n\n${PERSONALITY_OVERLAY[mode]}`
}

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
  /** Coach mode from the client */
  personality?: AskPersonalityId | string | null
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
  const system = resolveAskSystemPrompt(body.personality)
  const spicy = body.personality === 'spicy' || body.personality === 'dry'
  const temp = spicy ? 0.75 : body.personality === 'tough' ? 0.55 : 0.65

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
        temperature: temp,
        max_tokens: 380,
        messages: [
          { role: 'system', content: system },
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
