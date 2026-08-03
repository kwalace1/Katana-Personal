import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, Zap } from 'lucide-react'
import type { KycAccountAttentionRow } from '@/lib/kyc-api'
import { KycRiskChip } from '@/components/customers/KycRiskChip'
import { kycPriorityBadgeClass } from '@/components/customers/KycUi'

interface KycPortfolioTopActionsProps {
  rows: KycAccountAttentionRow[]
  onOpenClient?: (clientId: string) => void
  limit?: number
}

export function KycPortfolioTopActions({ rows, onOpenClient, limit = 5 }: KycPortfolioTopActionsProps) {
  const priority = rows
    .filter((row) => row.primary_action)
    .sort((a, b) => b.attention_score - a.attention_score)
    .slice(0, limit)

  if (priority.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Top actions needed
        </CardTitle>
        <CardDescription>Accounts ranked by attention priority with recommended next moves</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {priority.map((row) => (
          <div
            key={row.client_id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card/60 p-3"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold truncate">{row.client_name}</span>
                <KycRiskChip level={row.renewal_risk} />
                {row.primary_action && (
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${kycPriorityBadgeClass(row.primary_action.priority)}`}
                  >
                    {row.primary_action.priority} priority
                  </span>
                )}
              </div>
              {row.primary_action && (
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>
                    <span className="font-medium text-foreground">{row.primary_action.label}</span>
                    {' — '}
                    {row.primary_action.reason}
                  </span>
                </p>
              )}
            </div>
            {onOpenClient && (
              <Button type="button" size="sm" variant="outline" onClick={() => onOpenClient(row.client_id)}>
                Open
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
