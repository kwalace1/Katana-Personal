import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Calendar, DollarSign, ShieldAlert, TrendingUp, Users } from 'lucide-react'
import type { KycAccountAttentionRow, KycPortfolioSummary } from '@/lib/kyc-api'
import { KYC_CLIENT_OUTREACH_LABELS } from '@/lib/kyc-client-scoring'
import { KycStatTile } from '@/components/customers/KycUi'
import { KycPortfolioTopActions } from '@/components/customers/KycPortfolioTopActions'
import { KycPortfolioPlaybooks } from '@/components/customers/KycPortfolioPlaybooks'
import { groupPortfolioPlaybooks } from '@/lib/kyc-api'

const OUTREACH_CHIP_COLORS: Record<string, string> = {
  none: 'bg-muted text-muted-foreground',
  planned: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  contacted: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  meeting: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400',
  at_risk: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

interface KycPortfolioSummaryBarProps {
  summary: KycPortfolioSummary
  accountRows?: KycAccountAttentionRow[]
  onOpenClient?: (clientId: string) => void
}

export function KycPortfolioSummaryBar({ summary, accountRows = [], onOpenClient }: KycPortfolioSummaryBarProps) {
  const playbooks = groupPortfolioPlaybooks(accountRows)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KycStatTile
          icon={AlertTriangle}
          label="At risk"
          value={summary.at_risk_count}
          subtitle={`${summary.b2b_at_risk} B2B · ${summary.b2c_at_risk} B2C · $${(summary.arr_at_risk / 1000).toFixed(0)}K ARR`}
          variant="danger"
        />
        <KycStatTile
          icon={ShieldAlert}
          label="High renewal risk"
          value={summary.renewal_risk_high_count}
          subtitle={`${summary.renewals_within_90d} renewals ≤90d`}
          variant="danger"
        />
        <KycStatTile
          icon={TrendingUp}
          label="Expansion ready"
          value={summary.expansion_high_count}
          subtitle="High expansion likelihood"
          variant="success"
        />
        <KycStatTile
          icon={Calendar}
          label="Renewals ≤90d"
          value={summary.renewals_within_90d}
          subtitle={`${summary.renewals_within_30d} within 30 days`}
          variant="warning"
        />
        <KycStatTile
          icon={Users}
          label="Portfolio mix"
          value={`${summary.b2b_count} / ${summary.b2c_count}`}
          subtitle="B2B accounts · B2C consumers"
          variant="default"
        />
        <KycStatTile
          icon={DollarSign}
          label="Avg health"
          value={`${summary.avg_health_score}%`}
          subtitle={`${summary.high_attention_count} need attention now`}
          variant={summary.avg_health_score >= 70 ? 'success' : summary.avg_health_score >= 40 ? 'warning' : 'danger'}
        />
      </div>

      {accountRows.length > 0 && (
        <KycPortfolioTopActions rows={accountRows} onOpenClient={onOpenClient} />
      )}

      <KycPortfolioPlaybooks playbooks={playbooks} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Renewal & expansion plays</CardTitle>
          <CardDescription>Outreach pipeline by play status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.outreach_by_status).map(([key, count]) => (
              <span
                key={key}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${OUTREACH_CHIP_COLORS[key] ?? 'bg-muted text-muted-foreground'}`}
              >
                {KYC_CLIENT_OUTREACH_LABELS[key] ?? key}
                <span className="tabular-nums font-bold">{count}</span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
