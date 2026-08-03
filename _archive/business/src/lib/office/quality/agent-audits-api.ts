// Read API for the Agent Office Quality dashboard. Rows are written by the
// agent-observer edge function; RLS restricts reads to org owners/admins, so
// these queries return only the caller's org and only for admins.

import { supabase } from '@/lib/supabase'

export interface AgentAudit {
  id: string
  agent_id: string
  agent_name: string | null
  session_id: string | null
  question: string | null
  answer: string | null
  used_sql: boolean
  delegated_to: string[]
  latency_ms: number | null
  flags: Record<string, boolean>
  det_flagged: boolean
  observer_status: 'pending' | 'ok' | 'flagged' | 'error' | 'skipped'
  observer_score: number | null
  observer_verdict: string | null
  observer_reasons: string | null
  observer_model: string | null
  created_at: string
}

export interface AgentQualityStat {
  agent_name: string
  total: number
  flagged: number
  avg_score: number | null
  flag_rate: number
}

export interface QualityOverview {
  total: number
  flagged: number
  det_flagged: number
  avg_score: number | null
  by_agent: AgentQualityStat[]
}

const SELECT =
  'id, agent_id, agent_name, session_id, question, answer, used_sql, delegated_to, ' +
  'latency_ms, flags, det_flagged, observer_status, observer_score, observer_verdict, ' +
  'observer_reasons, observer_model, created_at'

export interface AuditFilter {
  flaggedOnly?: boolean
  agentName?: string
  limit?: number
}

export async function fetchAudits(filter: AuditFilter = {}): Promise<AgentAudit[]> {
  let q = supabase
    .from('agent_answer_audits')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 200)
  if (filter.agentName) q = q.eq('agent_name', filter.agentName)
  if (filter.flaggedOnly) q = q.or('det_flagged.eq.true,observer_status.eq.flagged')
  const { data, error } = await q
  if (error) throw error
  // agent_answer_audits isn't in the hand-maintained Database type, so supabase-js
  // can't infer the row shape; cast through unknown.
  return (data ?? []) as unknown as AgentAudit[]
}

/** Roll a page of audits into per-agent and overall quality stats. */
export function summarize(rows: AgentAudit[]): QualityOverview {
  const flagged = (r: AgentAudit) => r.det_flagged || r.observer_status === 'flagged'
  const byAgent = new Map<string, { total: number; flagged: number; scores: number[] }>()
  let totalFlagged = 0, detFlagged = 0
  const allScores: number[] = []

  for (const r of rows) {
    const key = r.agent_name || r.agent_id || 'Unknown'
    const a = byAgent.get(key) ?? { total: 0, flagged: 0, scores: [] }
    a.total += 1
    if (flagged(r)) { a.flagged += 1; totalFlagged += 1 }
    if (r.det_flagged) detFlagged += 1
    if (typeof r.observer_score === 'number') { a.scores.push(r.observer_score); allScores.push(r.observer_score) }
    byAgent.set(key, a)
  }

  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, n) => s + n, 0) / xs.length)) : null)
  const by_agent: AgentQualityStat[] = [...byAgent.entries()]
    .map(([agent_name, a]) => ({
      agent_name,
      total: a.total,
      flagged: a.flagged,
      avg_score: avg(a.scores),
      flag_rate: a.total ? Math.round((100 * a.flagged) / a.total) : 0,
    }))
    .sort((x, y) => y.flagged - x.flagged || y.total - x.total)

  return {
    total: rows.length,
    flagged: totalFlagged,
    det_flagged: detFlagged,
    avg_score: avg(allScores),
    by_agent,
  }
}
