import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, Brain, ShieldAlert, TrendingUp, Zap } from 'lucide-react'
import type { ClientIntelligenceResult } from '@/lib/kyc-client-scoring'
import type { Client } from '@/lib/customer-success-api'
import { KycScoreBreakdown } from '@/components/customers/KycScoreBreakdown'
import { KycSignalBadges } from '@/components/customers/KycSignalBadges'
import { KycExecutiveSummary } from '@/components/customers/KycExecutiveSummary'
import { KycAccountCoach } from '@/components/customers/KycAccountCoach'
import { KycRenewalForecastCard } from '@/components/customers/KycRenewalForecastCard'
import { KycRecommendedActionButton } from '@/components/customers/KycRecommendedActionButton'
import type { KycSummarySource } from '@/lib/kyc-client-summary'
import {
  clientStatusBadgeClass,
  kycPriorityBadgeClass,
  kycRiskLevelBadgeClass,
} from '@/components/customers/KycUi'
import { cn } from '@/lib/utils'

interface KycAccountOverviewProps {
  client: Client
  intel: ClientIntelligenceResult
  outreachSlot?: React.ReactNode
  executiveSummary?: {
    text: string
    source: KycSummarySource
    loading?: boolean
    refreshing?: boolean
    generatedAt?: string | null
    onRefresh?: () => void
  }
  onActionTaskCreated?: () => void
}

function formatRiskLevel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1)
}

function ReasonList({ reasons, emptyMessage }: { reasons: string[]; emptyMessage: string }) {
  if (reasons.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyMessage}</p>
  }
  return (
    <ul className="space-y-1.5">
      {reasons.map((reason) => (
        <li key={reason} className="flex items-start gap-2 text-xs text-muted-foreground">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
          <span>{reason}</span>
        </li>
      ))}
    </ul>
  )
}

interface OverviewMetricCardProps {
  icon: typeof ShieldAlert
  title: string
  level: string
  reasons: string[]
  emptyMessage: string
  accentClass?: string
}

function OverviewMetricCard({
  icon: Icon,
  title,
  level,
  reasons,
  emptyMessage,
  accentClass,
}: OverviewMetricCardProps) {
  return (
    <Card className={cn('border bg-card/80', accentClass)}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
          <Badge variant="outline" className={kycRiskLevelBadgeClass(level)}>
            {formatRiskLevel(level)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ReasonList reasons={reasons} emptyMessage={emptyMessage} />
      </CardContent>
    </Card>
  )
}

export function KycAccountOverview({ client, intel, outreachSlot, executiveSummary, onActionTaskCreated }: KycAccountOverviewProps) {
  const action = intel.primary_action

  return (
    <div className="space-y-4">
      {executiveSummary && (
        <KycExecutiveSummary
          summary={executiveSummary.text}
          source={executiveSummary.source}
          loading={executiveSummary.loading}
          refreshing={executiveSummary.refreshing}
          generatedAt={executiveSummary.generatedAt}
          onRefresh={executiveSummary.onRefresh}
        />
      )}

      <div className="flex justify-end">
        <KycAccountCoach client={client} intel={intel} />
      </div>

      <Card className="overflow-hidden border-primary/20">
        <div className="bg-gradient-to-br from-primary/8 via-card to-card">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                Account overview
              </CardTitle>
              <Badge variant="outline" className={clientStatusBadgeClass(intel.status)}>
                {intel.status.replace('-', ' ')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pb-5">
            <KycScoreBreakdown
              healthScore={intel.health_score}
              attentionScore={intel.attention_score}
              breakdown={intel.health_breakdown}
              compact
            />

            {intel.top_signals.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Active signals
                </p>
                <KycSignalBadges keys={intel.top_signals} />
              </div>
            )}

            {(intel.health_reasoning.positive.length > 0 || intel.health_reasoning.negative.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-2 rounded-lg border bg-background/50 p-3">
                {intel.health_reasoning.positive.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-green-600 mb-1.5">Positive</p>
                    <ul className="space-y-1">
                      {intel.health_reasoning.positive.slice(0, 3).map((item) => (
                        <li key={item} className="text-xs text-muted-foreground">• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {intel.health_reasoning.negative.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 mb-1.5">Negative</p>
                    <ul className="space-y-1">
                      {intel.health_reasoning.negative.slice(0, 3).map((item) => (
                        <li key={item} className="text-xs text-muted-foreground">• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <OverviewMetricCard
          icon={ShieldAlert}
          title="Renewal risk"
          level={intel.renewal_risk}
          reasons={intel.renewal_risk_reasons}
          emptyMessage="No renewal risk factors detected from current account data."
        />
        <OverviewMetricCard
          icon={TrendingUp}
          title="Expansion likelihood"
          level={intel.expansion_likelihood}
          reasons={intel.expansion_reasons}
          emptyMessage="Not enough adoption or fit signals to assess expansion readiness."
        />
      </div>

      {intel.renewal_forecast && <KycRenewalForecastCard forecast={intel.renewal_forecast} />}

      <Card className="border-primary/15 bg-primary/5">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Recommended next action
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {action ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{action.label}</span>
                <Badge variant="outline" className={kycPriorityBadgeClass(action.priority)}>
                  {formatRiskLevel(action.priority)} priority
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-start gap-2">
                <ArrowRight className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                {action.reason}
              </p>
              <KycRecommendedActionButton
                clientId={client.id}
                action={action}
                assignedTo={client.csm_id ?? client.csm?.id ?? null}
                taskStatus={intel.kyc_action_task_status?.[action.id] ?? null}
                onCreated={() => onActionTaskCreated?.()}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No urgent actions flagged — continue monitoring account health and engagement.
            </p>
          )}
        </CardContent>
      </Card>

      {outreachSlot && <div className="rounded-lg border bg-background/60 p-3">{outreachSlot}</div>}
    </div>
  )
}
