import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CircleDollarSign,
  ListChecks,
  Wallet,
} from 'lucide-react'
import { formatCurrency } from '@/lib/finance-api'
import type { FinDashboardSummary, FinEntitySettings } from '@/lib/finance-types'
import { ENTITY_TYPE_LABELS, TAX_BASIS_LABELS } from '@/lib/finance-types'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { FinanceTabLayoutProps } from '@/lib/finance/finance-widget-layout'

interface FinanceOverviewProps {
  summary: FinDashboardSummary
  settings: FinEntitySettings | null
  onGoToTransactions: () => void
  onGoToAccounts: () => void
  onGoToReconcile: () => void
  onGoToReports: () => void
  onGoToTax: () => void
  layout: FinanceTabLayoutProps
}

export function FinanceOverview({
  summary,
  settings,
  onGoToTransactions,
  onGoToAccounts,
  onGoToReconcile,
  onGoToReports,
  onGoToTax,
  layout,
}: FinanceOverviewProps) {
  return (
    <div data-tour="finance-overview">
      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId) => {
          if (widgetId === 'entity_badges') {
            if (!settings) {
              return (
                <Card className="h-full">
                  <CardContent className="pt-6 text-sm text-muted-foreground">
                    Complete setup to see entity context.
                  </CardContent>
                </Card>
              )
            }
            return (
              <Card className="h-full border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="pt-6 flex flex-wrap items-center gap-3 text-sm">
                  <Badge variant="secondary">{ENTITY_TYPE_LABELS[settings.entity_type]}</Badge>
                  <Badge variant="outline">{TAX_BASIS_LABELS[settings.tax_basis]}</Badge>
                  <span className="text-muted-foreground">
                    Fiscal year ends {settings.fiscal_year_end_month}/{settings.fiscal_year_end_day}
                  </span>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'stats') {
            return (
              <div className="h-full grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  icon={<ArrowDownLeft className="w-4 h-4 text-emerald-600" />}
                  label="Inflow (this month)"
                  value={formatCurrency(summary.inflowThisMonth)}
                  valueClassName="text-emerald-600"
                />
                <MetricCard
                  icon={<ArrowUpRight className="w-4 h-4 text-red-600" />}
                  label="Outflow (this month)"
                  value={formatCurrency(summary.outflowThisMonth)}
                  valueClassName="text-red-600"
                />
                <MetricCard
                  icon={<ListChecks className="w-4 h-4" />}
                  label="To categorize"
                  value={String(summary.uncategorizedCount)}
                  action={
                    summary.uncategorizedCount > 0 ? (
                      <Button variant="link" className="px-0 h-auto mt-1" onClick={onGoToTransactions}>
                        Review transactions
                      </Button>
                    ) : null
                  }
                />
                <MetricCard
                  icon={<CircleDollarSign className="w-4 h-4" />}
                  label="Net income (YTD)"
                  value={formatCurrency(summary.netIncomeYtd)}
                  valueClassName={
                    summary.netIncomeYtd >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }
                  action={
                    <Button variant="link" className="px-0 h-auto mt-1 text-xs" onClick={onGoToReports}>
                      View P&L report
                    </Button>
                  }
                />
              </div>
            )
          }

          if (widgetId === 'metric_inflow') {
            return (
              <MetricCard
                icon={<ArrowDownLeft className="w-4 h-4 text-emerald-600" />}
                label="Inflow (this month)"
                value={formatCurrency(summary.inflowThisMonth)}
                valueClassName="text-emerald-600"
              />
            )
          }

          if (widgetId === 'metric_outflow') {
            return (
              <MetricCard
                icon={<ArrowUpRight className="w-4 h-4 text-red-600" />}
                label="Outflow (this month)"
                value={formatCurrency(summary.outflowThisMonth)}
                valueClassName="text-red-600"
              />
            )
          }

          if (widgetId === 'metric_uncategorized') {
            return (
              <MetricCard
                icon={<ListChecks className="w-4 h-4" />}
                label="To categorize"
                value={String(summary.uncategorizedCount)}
                action={
                  summary.uncategorizedCount > 0 ? (
                    <Button variant="link" className="px-0 h-auto mt-1" onClick={onGoToTransactions}>
                      Review transactions
                    </Button>
                  ) : null
                }
              />
            )
          }

          if (widgetId === 'metric_net_income_ytd') {
            return (
              <MetricCard
                icon={<CircleDollarSign className="w-4 h-4" />}
                label="Net income (YTD)"
                value={formatCurrency(summary.netIncomeYtd)}
                valueClassName={summary.netIncomeYtd >= 0 ? 'text-emerald-600' : 'text-red-600'}
                action={
                  <Button variant="link" className="px-0 h-auto mt-1 text-xs" onClick={onGoToReports}>
                    View P&L report
                  </Button>
                }
              />
            )
          }

          if (widgetId === 'close_checklist') {
            return (
              <Card className="h-full overflow-auto" data-tour="finance-workflow">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Monthly close checklist
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <ChecklistItem
                    done={summary.financialAccountCount > 0}
                    label="Add at least one bank account"
                  />
                  <ChecklistItem
                    done={summary.uncategorizedCount === 0}
                    label="Categorize all transactions"
                  />
                  <ChecklistItem
                    done={summary.categorizedThisMonth > 0}
                    label="Review this month's activity"
                  />
                  <ChecklistItem
                    done={
                      summary.openReconciliationCount === 0 && summary.categorizedThisMonth > 0
                    }
                    label="Reconcile against bank statement"
                  />
                  <ChecklistItem done={false} label="Export tax packet for CPA" />
                  <Button variant="link" className="px-0 h-auto text-xs" onClick={onGoToTax}>
                    Open tax readiness
                  </Button>
                  {summary.openReconciliationCount > 0 && (
                    <Button
                      variant="link"
                      className="px-0 h-auto text-xs"
                      onClick={onGoToReconcile}
                    >
                      {summary.openReconciliationCount} reconciliation in progress
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'integrations_blurb') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Connected to Katana
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Finance will link to your CRM invoices, inventory purchase orders, and WFM job
                    costs so you can see profitability across modules.
                  </p>
                  <p className="text-xs">
                    Match suggestions link CRM invoices and inventory POs to bank deposits and
                    payments.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button variant="outline" size="sm" onClick={onGoToTransactions}>
                      Import & categorize
                    </Button>
                    <Button variant="outline" size="sm" onClick={onGoToAccounts}>
                      Bank accounts
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          }

          return null
        }}
      />
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  valueClassName,
  action,
}: {
  icon: ReactNode
  label: string
  value: string
  valueClassName?: string
  action?: ReactNode
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold ${valueClassName ?? ''}`}>{value}</p>
        {action}
      </CardContent>
    </Card>
  )
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${done ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
      />
      <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  )
}
