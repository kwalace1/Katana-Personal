// agent-observer — the "under the hood" quality checker for the Agent Office.
//
// The chat client fires this (fire-and-forget) after every delivered agent
// answer. It (1) recomputes cheap deterministic flags server-side, (2) runs a
// cheap LLM grounding/quality screen on a DIFFERENT model than the agents use
// (google/gemini-2.5-flash-lite via OpenRouter), and (3) writes one row to
// public.agent_answer_audits with the service role. Owners/admins review the
// results at /agents/quality; flagged answers become new eval cases.
//
// Runs async and off the user's answer path, so it adds ZERO user-facing
// latency and never blocks or alters what the user sees.
//
// Deploy: MCP deploy_edge_function (verify_jwt: true). Secret: OPENROUTER_API_KEY.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const JUDGE_MODEL = Deno.env.get('OBSERVER_MODEL') ?? 'google/gemini-2.5-flash-lite'

// Internal-metadata keys that must never appear in a user-facing answer.
const LEAK_RE = /factsUpsert|workflowKey|objectiveSummary|invariants|quality_score|taskIntent|isIncomplete|learnedSkill|working_state|workingState|"derived"|"failures"/
// Owner rule: agents must never name another company's product (this is
// Katana's internal tool). Mirrors src/lib/office/observer/detect-flags.ts.
const COMPETITOR_RE = /\b(asana|trello|jira|clickup|basecamp|airtable|hubspot|zendesk|freshdesk|quickbooks|xero|netsuite|workday|bamboohr|salesforce|wrike|smartsheet|monday\.com|notion\.so)\b/i
const FENCE_JSON_RE = /```(?:json)?\s*[[{]/
const CONTROL_RE = /\b(NO_MESSAGE|HEARTBEAT_OK)\b/
const ERROR_RE = /\[Error:/
const REFUSAL_RE = /(no (?:facilities |dedicated )?(?:data|records|information)|don'?t have (?:any )?(?:data|access)|not (?:available|tracked|stored)|hand(?:ing)? off|ask the \w+ agent)/i

// Near-duplicate whole-answer detection (the Hub duplicated-answer incident,
// 2026-07-09): a second generation restates the answer, possibly reformatted or
// reworded, glued after the first. Mirrors src/lib/office/observer/detect-flags.ts.
function hasDuplicatedAnswerBlock(text: string): boolean {
  const trimmed = (text || '').trim()
  if (trimmed.length < 160) return false

  const words: Array<{ w: string; start: number }> = []
  const wordRe = /[A-Za-z0-9$.,%']+/g
  let m: RegExpExecArray | null
  while ((m = wordRe.exec(trimmed)) !== null) words.push({ w: m[0].toLowerCase(), start: m.index })
  const N = 6
  if (words.length < N * 2) return false

  const firstSeen = new Map<string, number>()
  let secondStart = -1
  let firstStart = -1
  for (let i = 0; i + N <= words.length; i++) {
    const slice = words.slice(i, i + N)
    if (slice.reduce((acc, x) => acc + x.w.length, 0) < 18) continue
    const key = slice.map((x) => x.w).join(' ')
    const existing = firstSeen.get(key)
    if (existing !== undefined) { secondStart = words[i].start; firstStart = existing; break }
    firstSeen.set(key, words[i].start)
  }
  if (secondStart < 0 || secondStart < trimmed.length * 0.4) return false
  // A genuine glued restate repeats the answer's OPENING, so its anchor first
  // occurs early. Per-row boilerplate refrains ("no records added yet" per
  // module) first appear late, after the intro — not duplication.
  if (firstStart > trimmed.length * 0.4) return false

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const headTokens = new Set(norm(trimmed.slice(0, secondStart)).split(' ').filter((t) => t.length >= 4))
  const tailTokens = norm(trimmed.slice(secondStart)).split(' ').filter((t) => t.length >= 4)
  if (tailTokens.length < 12) return false
  const overlap = tailTokens.filter((t) => headTokens.has(t)).length / tailTokens.length
  return overlap >= 0.6
}

function deterministicFlags(answer: string) {
  const a = answer || ''
  const flags = {
    empty: a.trim().length === 0,
    leaked_json: LEAK_RE.test(a) || FENCE_JSON_RE.test(a),
    control_token: CONTROL_RE.test(a),
    error_marker: ERROR_RE.test(a),
    refusal: REFUSAL_RE.test(a),
    duplicate_answer: hasDuplicatedAnswerBlock(a),
    competitor_mention: COMPETITOR_RE.test(a),
  }
  // refusal alone is not a defect (it's correct for empty modules); the rest are.
  const det_flagged = flags.empty || flags.leaked_json || flags.control_token || flags.error_marker
    || flags.duplicate_answer || flags.competitor_mention
  return { flags, det_flagged }
}

const JUDGE_SYSTEM =
  'You are a QA observer for an enterprise assistant. Given a user QUESTION and the ' +
  'assistant ANSWER, judge how likely the answer is accurate and free of fabricated ' +
  'data. Penalize invented numbers/names/ids, internal metadata or JSON, self-' +
  'contradiction, and dodging the question. An honest "no data / handing off" is fine. ' +
  'Reply with ONLY JSON: {"score": <0-100 int>, "verdict": "grounded"|"ungrounded"|"uncertain", "reasons": "<one sentence>"}.'

async function llmObserve(question: string, answer: string, apiKey: string) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'X-Title': 'Katana Agent Observer' },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      temperature: 0,
      max_tokens: 300,
      messages: [
        { role: 'system', content: JUDGE_SYSTEM },
        { role: 'user', content: `QUESTION:\n${question}\n\nANSWER:\n${answer}\n\nJudge now. JSON only.` },
      ],
    }),
  })
  if (!res.ok) throw new Error(`openrouter ${res.status}`)
  const data = await res.json()
  const content: string = data?.choices?.[0]?.message?.content ?? ''
  const m = content.match(/\{[\s\S]*\}/)
  if (m) {
    try {
      const o = JSON.parse(m[0])
      const score = Math.max(0, Math.min(100, Math.round(Number(o.score))))
      const verdict = ['grounded', 'ungrounded', 'uncertain'].includes(o.verdict) ? o.verdict : 'uncertain'
      return { score: Number.isFinite(score) ? score : null, verdict, reasons: String(o.reasons ?? '').slice(0, 400) }
    } catch { /* fall through */ }
  }
  return { score: null, verdict: 'uncertain', reasons: 'unparseable observer reply' }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const OPENROUTER = Deno.env.get('OPENROUTER_API_KEY') ?? ''

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ error: 'missing authorization' }, 401)

  // Identify the caller from their (gateway-verified) JWT.
  const asUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await asUser.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401)
  const userId = userData.user.id

  let payload: any
  try { payload = await req.json() } catch { return json({ error: 'bad json' }, 400) }

  const answer: string = typeof payload?.answer === 'string' ? payload.answer : ''
  const question: string = typeof payload?.question === 'string' ? payload.question : ''

  const svc = createClient(SUPABASE_URL, SERVICE)

  // Resolve the caller's org server-side (never trust a client-sent org).
  const { data: prof } = await svc
    .from('user_profiles').select('organization_id').eq('id', userId).maybeSingle()
  const organizationId = prof?.organization_id
  if (!organizationId) return json({ error: 'no organization for user' }, 403)

  const { flags, det_flagged } = deterministicFlags(answer)

  // Async LLM screen (skipped for empty answers; errors are recorded, not thrown).
  let observer_status = 'skipped', observer_score: number | null = null,
      observer_verdict: string | null = null, observer_reasons: string | null = null,
      observer_model: string | null = null
  if (answer.trim() && OPENROUTER) {
    try {
      const r = await llmObserve(question, answer, OPENROUTER)
      observer_score = r.score
      observer_verdict = r.verdict
      observer_reasons = r.reasons
      observer_model = JUDGE_MODEL
      observer_status = (r.verdict === 'ungrounded' || (r.score ?? 100) < 60) ? 'flagged' : 'ok'
    } catch (e) {
      observer_status = 'error'
      observer_reasons = String(e).slice(0, 200)
    }
  }

  const row = {
    organization_id: organizationId,
    user_id: userId,
    agent_id: String(payload?.agent_id ?? ''),
    agent_name: payload?.agent_name ?? null,
    session_id: payload?.session_id ?? null,
    question: question.slice(0, 4000),
    answer: answer.slice(0, 8000),
    used_sql: Boolean(payload?.used_sql),
    delegated_to: Array.isArray(payload?.delegated_to) ? payload.delegated_to.slice(0, 12).map(String) : [],
    latency_ms: Number.isFinite(payload?.latency_ms) ? Math.round(payload.latency_ms) : null,
    flags,
    det_flagged,
    observer_status,
    observer_score,
    observer_verdict,
    observer_reasons,
    observer_model,
  }

  const { data: inserted, error: insErr } = await svc
    .from('agent_answer_audits').insert(row).select('id').single()
  if (insErr) return json({ error: 'insert failed', detail: insErr.message }, 500)

  return json({ ok: true, id: inserted?.id, det_flagged, observer_status, observer_score })
})
