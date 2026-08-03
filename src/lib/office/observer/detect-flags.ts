// Inline deterministic layer of the answer observer. Pure, synchronous, and free
// -- it runs on the client the moment an answer finalizes, with zero added
// latency. It extracts the tool signals the server can't recompute (did the
// agent run SQL? who did it delegate to?) and the same leak/empty/refusal flags
// the agent-observer edge function records, so the client and server agree.

// Minimal shape we read off finalized tool events (kept local to avoid importing
// from the chat store, which imports this module).
interface ToolEventLike {
  name?: string
  input?: unknown
}

export interface ToolSignals {
  used_sql: boolean
  delegated_to: string[] // resolved agent names when possible, else ids
}

export interface AnswerFlags {
  empty: boolean
  leaked_json: boolean
  control_token: boolean
  error_marker: boolean
  refusal: boolean
  duplicate_answer: boolean
  competitor_mention: boolean
}

const LEAK_RE = /factsUpsert|workflowKey|objectiveSummary|invariants|quality_score|taskIntent|isIncomplete|learnedSkill|working_state|workingState|"derived"|"failures"/
// Owner rule: agents must never name another company's product (this is
// Katana's internal tool). Word-bounded, unambiguous product names only —
// words that double as common nouns (monday, notion, linear, teams) need the
// .com/.so form so answers about the org's own data can't false-positive.
const COMPETITOR_RE = /\b(asana|trello|jira|clickup|basecamp|airtable|hubspot|zendesk|freshdesk|quickbooks|xero|netsuite|workday|bamboohr|salesforce|wrike|smartsheet|monday\.com|notion\.so)\b/i
const FENCE_JSON_RE = /```(?:json)?\s*[[{]/
const CONTROL_RE = /\b(NO_MESSAGE|HEARTBEAT_OK)\b/
const ERROR_RE = /\[Error:/
const REFUSAL_RE = /(no (?:facilities |dedicated )?(?:data|records|information)|don'?t have (?:any )?(?:data|access)|not (?:available|tracked|stored)|hand(?:ing)? off|ask the \w+ agent)/i

function collectAgentIds(value: unknown, out: string[]): void {
  if (Array.isArray(value)) {
    for (const v of value) collectAgentIds(v, out)
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'agentId' && typeof v === 'string') out.push(v)
      else collectAgentIds(v, out)
    }
  }
}

export function extractToolSignals(
  toolEvents: ToolEventLike[] | undefined,
  resolveName: (id: string) => string | undefined,
): ToolSignals {
  let usedSql = false
  const ids: string[] = []
  for (const e of toolEvents || []) {
    const name = (e?.name || '').toLowerCase()
    if (name.includes('sql') || name.includes('ai_query') || name.includes('query')) usedSql = true
    if (e?.name === 'spawn_subagent') collectAgentIds(e.input, ids)
  }
  const seen = new Set<string>()
  const delegated = ids
    .filter((id) => !seen.has(id) && seen.add(id))
    .map((id) => resolveName(id) || id)
  return { used_sql: usedSql, delegated_to: delegated }
}

export function detectAnswerFlags(answer: string): AnswerFlags {
  const a = answer || ''
  return {
    empty: a.trim().length === 0,
    leaked_json: LEAK_RE.test(a) || FENCE_JSON_RE.test(a),
    control_token: CONTROL_RE.test(a),
    error_marker: ERROR_RE.test(a),
    refusal: REFUSAL_RE.test(a),
    duplicate_answer: hasDuplicatedAnswerBlock(a),
    competitor_mention: COMPETITOR_RE.test(a),
  }
}

/**
 * Near-duplicate whole-answer detection (the Hub duplicated-answer incident,
 * 2026-07-09): a second generation restates the answer — possibly reformatted
 * or reworded — glued after the first. Verbatim checks miss it, so this uses
 * the same conservative heuristic as the engine's collapseRepeatedTail: an
 * exact 6-significant-word phrase recurring in the latter 60% of the text,
 * where the tail past that point substantially repeats earlier content.
 * Detection-only — surfacing on /agents/quality — never used to edit text.
 */
export function hasDuplicatedAnswerBlock(text: string): boolean {
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

/** True when a flag set represents a real defect (refusal alone is not one). */
export function isDefect(flags: AnswerFlags): boolean {
  return flags.empty || flags.leaked_json || flags.control_token || flags.error_marker
    || flags.duplicate_answer || flags.competitor_mention
}
