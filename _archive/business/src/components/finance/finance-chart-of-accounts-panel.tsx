import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { COA_ACCOUNT_TYPE_LABELS, type FinAccount } from '@/lib/finance-types'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { FinanceTabLayoutProps } from '@/lib/finance/finance-widget-layout'

interface FinanceChartOfAccountsPanelProps {
  accounts: FinAccount[]
  layout: FinanceTabLayoutProps
}

export function FinanceChartOfAccountsPanel({
  accounts,
  layout,
}: FinanceChartOfAccountsPanelProps) {
  const grouped = accounts.reduce<Record<string, FinAccount[]>>((acc, account) => {
    const type = account.account_type
    if (!acc[type]) acc[type] = []
    acc[type].push(account)
    return acc
  }, {})

  const typeOrder = [
    'bank',
    'accounts_receivable',
    'other_current_asset',
    'fixed_asset',
    'accounts_payable',
    'credit_card',
    'other_current_liability',
    'long_term_liability',
    'equity',
    'income',
    'cost_of_goods_sold',
    'expense',
    'other_income',
    'other_expense',
  ]

  return (
    <div data-tour="finance-coa">
      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId) => {
          if (widgetId === 'coa_header') {
            return (
              <div className="h-full overflow-auto">
                <h2 className="text-lg font-medium">Chart of accounts</h2>
                <p className="text-sm text-muted-foreground">
                  Your organization&apos;s ledger structure. Account types follow QuickBooks
                  conventions for future sync compatibility.
                </p>
              </div>
            )
          }

          if (widgetId === 'coa_ledger') {
            if (accounts.length === 0) {
              return (
                <Card className="h-full">
                  <CardContent className="py-12 text-center text-muted-foreground text-sm">
                    Complete setup to generate your chart of accounts.
                  </CardContent>
                </Card>
              )
            }
            return (
              <div className="h-full overflow-auto space-y-6">
                {typeOrder
                  .filter((type) => grouped[type]?.length)
                  .map((type) => (
                    <div key={type}>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                        {COA_ACCOUNT_TYPE_LABELS[type as keyof typeof COA_ACCOUNT_TYPE_LABELS]}
                      </h3>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-3 font-medium w-24">Number</th>
                              <th className="text-left p-3 font-medium">Name</th>
                              <th className="text-left p-3 font-medium w-24">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grouped[type].map((account) => (
                              <tr key={account.id} className="border-t">
                                <td className="p-3 font-mono text-muted-foreground">
                                  {account.account_number ?? '—'}
                                </td>
                                <td className="p-3">
                                  {account.name}
                                  {account.is_system && (
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      System
                                    </Badge>
                                  )}
                                </td>
                                <td className="p-3 text-muted-foreground text-xs">
                                  {COA_ACCOUNT_TYPE_LABELS[account.account_type]}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
              </div>
            )
          }

          return null
        }}
      />
    </div>
  )
}
