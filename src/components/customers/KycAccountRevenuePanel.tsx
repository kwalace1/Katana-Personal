import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Calendar, CheckCircle2, Circle, DollarSign, TrendingUp } from 'lucide-react'
import type { KycRevenueIntel } from '@/lib/kyc-revenue-intel'
import { KycRiskChip } from '@/components/customers/KycRiskChip'
import { formatDateOnly } from '@/lib/due-date-utils'

interface KycAccountRevenuePanelProps {
  revenue: KycRevenueIntel
}

function MetricTile({ label, value, suffix = '' }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums mt-1">
        {value}
        {suffix}
      </p>
    </div>
  )
}

export function KycAccountRevenuePanel({ revenue }: KycAccountRevenuePanelProps) {
  const metrics = revenue.portfolio_metrics

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">ARR</p>
            <p className="text-2xl font-bold tabular-nums flex items-center gap-1">
              <DollarSign className="h-5 w-5 text-primary" />
              {(revenue.arr / 1000).toFixed(revenue.arr >= 1000 ? 0 : 1)}K
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Renewal date</p>
            <p className="text-lg font-semibold flex items-center gap-1">
              <Calendar className="h-4 w-4 text-primary" />
              {revenue.renewal_date ? formatDateOnly(revenue.renewal_date) : '—'}
            </p>
            {revenue.days_until_renewal != null && revenue.days_until_renewal >= 0 && (
              <p className="text-xs text-muted-foreground mt-1">{revenue.days_until_renewal} days away</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Active contracts</p>
            <p className="text-2xl font-bold tabular-nums">
              ${(revenue.active_contract_value / 1000).toFixed(0)}K
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Open pipeline</p>
            <p className="text-2xl font-bold tabular-nums">
              ${(revenue.open_pipeline_value / 1000).toFixed(0)}K
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">SaaS retention metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {metrics.available ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <MetricTile label="GRR" value={metrics.grr ?? '—'} suffix="%" />
              <MetricTile label="NRR" value={metrics.nrr ?? '—'} suffix="%" />
              <MetricTile label="Logo retention" value={metrics.logo_retention ?? '—'} suffix="%" />
              <MetricTile label="Expansion revenue" value={`$${((metrics.expansion_revenue ?? 0) / 1000).toFixed(0)}`} suffix="K" />
              <MetricTile label="Contraction revenue" value={`$${((metrics.contraction_revenue ?? 0) / 1000).toFixed(0)}`} suffix="K" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{metrics.note}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Expansion potential
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <KycRiskChip level={revenue.expansion_likelihood} />
          <ul className="space-y-1">
            {revenue.expansion_reasons.map((r) => (
              <li key={r} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="mt-2 h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
                {r}
              </li>
            ))}
          </ul>
          {revenue.expansion_estimate.available && revenue.expansion_estimate.estimated_annual_value != null ? (
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 mt-2">
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                Estimated expansion value: ${(revenue.expansion_estimate.estimated_annual_value / 1000).toFixed(0)}K / year
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Based on unpurchased module pricing × {Math.round(revenue.expansion_estimate.expansion_probability * 100)}% probability
              </p>
              <ul className="mt-2 space-y-1">
                {revenue.expansion_estimate.reasons.map((r) => (
                  <li key={r} className="text-xs text-muted-foreground">• {r}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground pt-2 border-t">
              {revenue.expansion_estimate.reasons[0] ?? 'Expansion dollar estimate withheld until adoption and pricing data support it.'}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Products in use
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {revenue.products_in_use.map((p) => (
              <div key={p.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{p.label}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {p.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{p.evidence}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Circle className="h-4 w-4 text-muted-foreground" />
              Suite opportunities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {revenue.products_not_purchased.map((p) => (
              <div key={p.id} className="rounded-lg border border-dashed p-3">
                <p className="text-sm font-medium">{p.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{p.evidence}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardContent className="py-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">{revenue.metrics_note}</p>
        </CardContent>
      </Card>

      {revenue.overdue_invoice_count > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="py-3 text-sm text-red-600 dark:text-red-400">
            {revenue.overdue_invoice_count} overdue invoice(s) — resolve billing before expansion conversations.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
