import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, AlertTriangle, Gauge, Activity, RefreshCw, Database, GitBranch } from 'lucide-react'
import { useOffice } from '@/components/agent-office/OfficeProvider'
import { fetchAudits, summarize, type AgentAudit } from '@/lib/office/quality/agent-audits-api'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Accent = 'default' | 'success' | 'warning' | 'danger'

function StatCard({ label, value, sub, icon: Icon, accent = 'default' }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; accent?: Accent
}) {
  const tone: Record<Accent, string> = {
    default: 'text-foreground',
    success: 'text-green-600 dark:text-green-500',
    warning: 'text-amber-600 dark:text-amber-500',
    danger: 'text-red-600 dark:text-red-500',
  }
  return (
    <div className="rounded-xl border border-border bg-card/80 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </span>
      </div>
      <div className={cn('mt-2 text-2xl font-bold tabular-nums', tone[accent])}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

function flagBadges(row: AgentAudit) {
  const out: Array<{ label: string; tone: string }> = []
  const f = row.flags || {}
  if (f.leaked_json) out.push({ label: 'leaked json', tone: 'bg-red-500/10 text-red-600 dark:text-red-400' })
  if (f.empty) out.push({ label: 'empty', tone: 'bg-red-500/10 text-red-600 dark:text-red-400' })
  if (f.error_marker) out.push({ label: 'error', tone: 'bg-red-500/10 text-red-600 dark:text-red-400' })
  if (f.control_token) out.push({ label: 'control token', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' })
  if (f.duplicate_answer) out.push({ label: 'duplicated answer', tone: 'bg-red-500/10 text-red-600 dark:text-red-400' })
  if (f.competitor_mention) out.push({ label: 'competitor mention', tone: 'bg-red-500/10 text-red-600 dark:text-red-400' })
  if (row.observer_status === 'flagged') out.push({ label: `observer: ${row.observer_verdict || 'flagged'}`, tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' })
  return out
}

export default function QualityView() {
  const { navMode } = useOffice()
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [agentName, setAgentName] = useState<string | null>(null)

  // Owner/admin only — the audit log contains other users' agent Q&A.
  if (navMode !== 'full') return <Navigate to="/agents/chat" replace />

  const { data: rows = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['agent-audits', flaggedOnly, agentName],
    queryFn: () => fetchAudits({ flaggedOnly, agentName: agentName ?? undefined, limit: 300 }),
  })

  const overview = useMemo(() => summarize(rows), [rows])
  const agentNames = useMemo(
    () => [...new Set(rows.map((r) => r.agent_name).filter(Boolean) as string[])].sort(),
    [rows],
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Agent Quality</h1>
            <p className="text-xs text-muted-foreground">
              The observer checks every delivered answer under the hood — deterministic flags plus an
              LLM grounding screen. Flagged answers are good candidates for new eval cases.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Answers observed" value={overview.total} icon={Activity} />
          <StatCard label="Flagged" value={overview.flagged}
            sub={overview.total ? `${Math.round((100 * overview.flagged) / overview.total)}% of answers` : undefined}
            icon={AlertTriangle} accent={overview.flagged ? 'warning' : 'success'} />
          <StatCard label="Hard defects" value={overview.det_flagged}
            sub="leaked JSON / empty / error" icon={ShieldCheck}
            accent={overview.det_flagged ? 'danger' : 'success'} />
          <StatCard label="Avg observer score" value={overview.avg_score ?? '—'}
            sub="0–100, grounding" icon={Gauge}
            accent={overview.avg_score == null ? 'default' : overview.avg_score >= 80 ? 'success' : overview.avg_score >= 60 ? 'warning' : 'danger'} />
        </div>

        {/* Per-agent rollup */}
        {overview.by_agent.length > 0 && (
          <div className="mt-5">
            <h2 className="mb-2 text-sm font-semibold">By agent</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {overview.by_agent.map((a) => (
                <button
                  key={a.agent_name}
                  onClick={() => setAgentName(agentName === a.agent_name ? null : a.agent_name)}
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors',
                    agentName === a.agent_name ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
                  )}
                >
                  <span className="text-sm font-medium">{a.agent_name}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{a.total} ans</span>
                    <span className={cn(a.flagged ? 'text-amber-600 dark:text-amber-500' : 'text-green-600 dark:text-green-500')}>
                      {a.flagged} flagged
                    </span>
                    {a.avg_score != null && <span>· {a.avg_score}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mt-5 flex items-center gap-2">
          <Button variant={flaggedOnly ? 'default' : 'outline'} size="sm" onClick={() => setFlaggedOnly((v) => !v)}>
            <AlertTriangle className="h-4 w-4" />
            {flaggedOnly ? 'Showing flagged' : 'Flagged only'}
          </Button>
          {agentName && (
            <Button variant="outline" size="sm" onClick={() => setAgentName(null)}>
              {agentName} ✕
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{rows.length} shown</span>
        </div>

        {/* Table */}
        <div className="mt-3 rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading audits…</div>
          ) : isError ? (
            <div className="py-16 text-center text-sm text-red-600 dark:text-red-500">
              Couldn’t load audits{(error as Error)?.message ? `: ${(error as Error).message}` : ''}.
              This page is limited to org owners and admins.
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-16 text-center">
              <p className="text-sm font-medium">No observed answers yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                As people chat with the agents, each answer is checked and logged here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[15%]">Agent</TableHead>
                    <TableHead className="w-[40%]">Question</TableHead>
                    <TableHead className="w-[10%]">Signals</TableHead>
                    <TableHead className="w-[25%]">Flags / observer</TableHead>
                    <TableHead className="w-[10%] text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const badges = flagBadges(r)
                    return (
                      <TableRow key={r.id} className={cn((r.det_flagged || r.observer_status === 'flagged') && 'bg-amber-500/5')}>
                        <TableCell className="align-top">
                          <div className="text-sm font-medium">{r.agent_name || r.agent_id}</div>
                          <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="text-sm">{r.question}</div>
                          {r.observer_reasons && (
                            <div className="mt-1 text-[11px] text-muted-foreground italic">{r.observer_reasons}</div>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                            {r.used_sql && <span className="flex items-center gap-1"><Database className="h-3 w-3" /> sql</span>}
                            {r.delegated_to?.length > 0 && (
                              <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" /> {r.delegated_to.join(', ')}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap gap-1">
                            {badges.length === 0 ? (
                              <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-transparent">clean</Badge>
                            ) : badges.map((b, i) => (
                              <span key={i} className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', b.tone)}>{b.label}</span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-right">
                          {r.observer_score != null ? (
                            <span className={cn('text-sm font-semibold tabular-nums',
                              r.observer_score >= 80 ? 'text-green-600 dark:text-green-500'
                                : r.observer_score >= 60 ? 'text-amber-600 dark:text-amber-500'
                                : 'text-red-600 dark:text-red-500')}>
                              {r.observer_score}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">{r.observer_status}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
