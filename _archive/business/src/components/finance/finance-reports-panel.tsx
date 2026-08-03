import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, BarChart3, Scale } from 'lucide-react'
import { formatCurrency, getProfitAndLossReport } from '@/lib/finance-api'
import { getBalanceSheetReport, getCashFlowReport } from '@/lib/finance-tax-api'
import type { BalanceSheetReport, CashFlowReport, ProfitLossReport } from '@/lib/finance-types'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { FinanceTabLayoutProps } from '@/lib/finance/finance-widget-layout'

interface FinanceReportsPanelProps {
  layout: FinanceTabLayoutProps
}

export function FinanceReportsPanel({ layout }: FinanceReportsPanelProps) {
  const now = new Date()
  const yearStart = `${now.getFullYear()}-01-01`
  const today = now.toISOString().slice(0, 10)
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [periodStart, setPeriodStart] = useState(monthStart)
  const [periodEnd, setPeriodEnd] = useState(today)
  const [asOfDate, setAsOfDate] = useState(today)
  const [pnl, setPnl] = useState<ProfitLossReport | null>(null)
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null)
  const [cashFlow, setCashFlow] = useState<CashFlowReport | null>(null)
  const [loading, setLoading] = useState(true)

  const loadReports = useCallback(async () => {
    setLoading(true)
    try {
      const [p, b, c] = await Promise.all([
        getProfitAndLossReport(periodStart, periodEnd),
        getBalanceSheetReport(asOfDate),
        getCashFlowReport(periodStart, periodEnd),
      ])
      setPnl(p)
      setBalanceSheet(b)
      setCashFlow(c)
    } finally {
      setLoading(false)
    }
  }, [periodStart, periodEnd, asOfDate])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const loadingPlaceholder = (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div data-tour="finance-reports">
      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId) => {
          if (widgetId === 'reports_header') {
            return (
              <div className="h-full overflow-auto">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Financial reports
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  P&L, balance sheet, and cash flow from posted journal entries and bank activity.
                </p>
              </div>
            )
          }

          if (widgetId === 'report_date_controls') {
            return (
              <Card className="h-full overflow-auto">
                <CardContent className="pt-6 flex flex-wrap items-end gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="r-start">From</Label>
                    <Input
                      id="r-start"
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="r-end">To</Label>
                    <Input
                      id="r-end"
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="r-asof">Balance sheet as of</Label>
                    <Input
                      id="r-asof"
                      type="date"
                      value={asOfDate}
                      onChange={(e) => setAsOfDate(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPeriodStart(yearStart)
                      setPeriodEnd(today)
                      setAsOfDate(today)
                    }}
                  >
                    YTD
                  </Button>
                  <Button onClick={loadReports} disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Refresh
                  </Button>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'report_viewer') {
            if (loading && !pnl) return loadingPlaceholder
            return (
              <div className="h-full overflow-auto">
                <Tabs defaultValue="pnl">
                  <TabsList>
                    <TabsTrigger value="pnl">Profit & Loss</TabsTrigger>
                    <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
                    <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
                  </TabsList>

                  <TabsContent value="pnl" className="mt-4">
                    {pnl && (
                      <div className="grid gap-6 lg:grid-cols-2">
                        <ReportLines title="Income" lines={pnl.income} total={pnl.total_income} positive />
                        <ReportLines title="Expenses" lines={pnl.expenses} total={pnl.total_expenses} />
                        <Card className="lg:col-span-2">
                          <CardHeader>
                            <CardTitle className="text-base">Net income</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p
                              className={`text-3xl font-bold ${
                                pnl.net_income >= 0 ? 'text-emerald-600' : 'text-red-600'
                              }`}
                            >
                              {formatCurrency(pnl.net_income)}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="balance" className="mt-4">
                    {balanceSheet && (
                      <div className="grid gap-6 lg:grid-cols-3">
                        <BalanceSection
                          title="Assets"
                          lines={balanceSheet.assets}
                          total={balanceSheet.total_assets}
                        />
                        <BalanceSection
                          title="Liabilities"
                          lines={balanceSheet.liabilities}
                          total={balanceSheet.total_liabilities}
                        />
                        <BalanceSection
                          title="Equity"
                          lines={balanceSheet.equity}
                          total={balanceSheet.total_equity}
                        />
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="cashflow" className="mt-4">
                    {cashFlow && <CashFlowCard cashFlow={cashFlow} />}
                  </TabsContent>
                </Tabs>
              </div>
            )
          }

          if (widgetId === 'pnl_income') {
            if (!pnl) return loadingPlaceholder
            return (
              <div className="h-full overflow-auto">
                <ReportLines title="Income" lines={pnl.income} total={pnl.total_income} positive />
              </div>
            )
          }

          if (widgetId === 'pnl_expenses') {
            if (!pnl) return loadingPlaceholder
            return (
              <div className="h-full overflow-auto">
                <ReportLines title="Expenses" lines={pnl.expenses} total={pnl.total_expenses} />
              </div>
            )
          }

          if (widgetId === 'pnl_net') {
            if (!pnl) return loadingPlaceholder
            return (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base">Net income</CardTitle>
                </CardHeader>
                <CardContent>
                  <p
                    className={`text-3xl font-bold ${
                      pnl.net_income >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(pnl.net_income)}
                  </p>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'bs_assets') {
            if (!balanceSheet) return loadingPlaceholder
            return (
              <div className="h-full overflow-auto">
                <BalanceSection
                  title="Assets"
                  lines={balanceSheet.assets}
                  total={balanceSheet.total_assets}
                />
              </div>
            )
          }

          if (widgetId === 'bs_liabilities') {
            if (!balanceSheet) return loadingPlaceholder
            return (
              <div className="h-full overflow-auto">
                <BalanceSection
                  title="Liabilities"
                  lines={balanceSheet.liabilities}
                  total={balanceSheet.total_liabilities}
                />
              </div>
            )
          }

          if (widgetId === 'bs_equity') {
            if (!balanceSheet) return loadingPlaceholder
            return (
              <div className="h-full overflow-auto">
                <BalanceSection
                  title="Equity"
                  lines={balanceSheet.equity}
                  total={balanceSheet.total_equity}
                />
              </div>
            )
          }

          if (widgetId === 'cash_flow_summary') {
            if (!cashFlow) return loadingPlaceholder
            return (
              <div className="h-full overflow-auto">
                <CashFlowCard cashFlow={cashFlow} />
              </div>
            )
          }

          return null
        }}
      />
    </div>
  )
}

function CashFlowCard({ cashFlow }: { cashFlow: CashFlowReport }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="w-4 h-4" />
          Cash flow summary
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
        <div>
          <p className="text-muted-foreground">Inflows</p>
          <p className="text-xl font-semibold text-emerald-600">
            {formatCurrency(cashFlow.inflows)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Outflows</p>
          <p className="text-xl font-semibold text-red-600">
            {formatCurrency(cashFlow.outflows)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Net change</p>
          <p
            className={`text-xl font-semibold ${
              cashFlow.net_change >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {formatCurrency(cashFlow.net_change)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function ReportLines({
  title,
  lines,
  total,
  positive,
}: {
  title: string
  lines: ProfitLossReport['income']
  total: number
  positive?: boolean
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {lines.map((l) => (
              <li key={l.account_id} className="flex justify-between gap-4">
                <span className="truncate">{l.account_name}</span>
                <span>{formatCurrency(l.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t mt-4 pt-3 flex justify-between font-semibold">
          <span>Total</span>
          <span className={positive ? 'text-emerald-600' : 'text-red-600'}>
            {formatCurrency(total)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function BalanceSection({
  title,
  lines,
  total,
}: {
  title: string
  lines: BalanceSheetReport['assets']
  total: number
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No balances.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {lines.map((l) => (
              <li key={l.account_id} className="flex justify-between gap-2">
                <span className="truncate">{l.account_name}</span>
                <span>{formatCurrency(l.balance)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t mt-4 pt-3 flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
