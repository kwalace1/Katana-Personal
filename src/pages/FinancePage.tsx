import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MotionPage } from '@/components/motion-page'
import { ModuleHelpButton } from '@/components/tour/module-help-button'
import { useModuleTour } from '@/components/tour/use-module-tour'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, Landmark, Loader2, Settings2 } from 'lucide-react'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  getAccounts,
  getBankTransactions,
  getDashboardSummary,
  getEntitySettings,
  getFinancialAccounts,
} from '@/lib/finance-api'
import type {
  FinAccount,
  FinBankTransaction,
  FinDashboardSummary,
  FinEntitySettings,
  FinFinancialAccount,
} from '@/lib/finance-types'
import { FinanceSetupDialog } from '@/components/finance/finance-setup-dialog'
import { FinanceOverview } from '@/components/finance/finance-overview'
import { FinanceBankAccountsPanel } from '@/components/finance/finance-bank-accounts-panel'
import { FinanceTransactionsPanel } from '@/components/finance/finance-transactions-panel'
import { FinanceChartOfAccountsPanel } from '@/components/finance/finance-chart-of-accounts-panel'
import { FinanceReconciliationPanel } from '@/components/finance/finance-reconciliation-panel'
import { FinanceReportsPanel } from '@/components/finance/finance-reports-panel'
import { FinanceTaxReadinessPanel } from '@/components/finance/finance-tax-readiness-panel'
import { ENTITY_TYPE_LABELS, TAX_BASIS_LABELS } from '@/lib/finance-types'
import {
  ModuleCustomizeControls,
  ModuleCustomizeHint,
} from '@/components/module-layout/ModuleCustomizeBar'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import { WidgetCatalogDialog } from '@/components/module-layout/WidgetCatalogDialog'
import { useModuleWidgetLayout } from '@/hooks/useModuleWidgetLayout'
import {
  FINANCE_MODULE_ID,
  getFinanceTabSurfaceConfig,
  isFinanceTabSurfaceId,
  type FinanceTabLayoutProps,
} from '@/lib/finance/finance-widget-layout'

export default function FinancePage() {
  useModuleTour('finance')
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab')
    return tab && isFinanceTabSurfaceId(tab) ? tab : 'overview'
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<FinEntitySettings | null>(null)
  const [summary, setSummary] = useState<FinDashboardSummary | null>(null)
  const [financialAccounts, setFinancialAccounts] = useState<FinFinancialAccount[]>([])
  const [transactions, setTransactions] = useState<FinBankTransaction[]>([])
  const [coaAccounts, setCoaAccounts] = useState<FinAccount[]>([])
  const [setupOpen, setSetupOpen] = useState(false)

  const surfaceConfig = getFinanceTabSurfaceConfig(activeTab)
  const {
    layout,
    isCustomizeMode,
    enterCustomize,
    saveAndExit,
    onLayoutChange,
    addWidget,
    removeWidget,
    availableWidgets,
    resetToDefault,
  } = useModuleWidgetLayout({
    moduleId: FINANCE_MODULE_ID,
    surfaceId: surfaceConfig.id,
    catalog: surfaceConfig.catalog,
    normalize: surfaceConfig.normalize,
    toBase: surfaceConfig.toBase,
    successMessage: `${surfaceConfig.label} layout saved`,
  })

  const tabLayout: FinanceTabLayoutProps = {
    widgets: layout.widgets,
    catalog: surfaceConfig.catalog,
    customizeMode: isCustomizeMode,
    onLayoutChange,
    onRemoveWidget: removeWidget,
  }

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    setError(null)
    try {
      const [entitySettings, dashboard, finAccounts, txns, accounts] = await Promise.all([
        getEntitySettings(),
        getDashboardSummary(),
        getFinancialAccounts(),
        getBankTransactions({ limit: 100 }),
        getAccounts(),
      ])
      setSettings(entitySettings)
      setSummary(dashboard)
      setFinancialAccounts(finAccounts)
      setTransactions(txns)
      setCoaAccounts(accounts)
      if (!entitySettings?.setup_completed_at) {
        setSetupOpen(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load finance data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && isFinanceTabSurfaceId(tab) && tab !== activeTab) {
      setActiveTab(tab)
    }
  }, [searchParams, activeTab])

  const handleTabChange = (tab: string) => {
    if (!isFinanceTabSurfaceId(tab)) return
    setActiveTab(tab)
    const next = new URLSearchParams(searchParams)
    if (tab === 'overview') next.delete('tab')
    else next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  const expenseAccounts = useMemo(
    () => coaAccounts.filter((a) => a.is_active),
    [coaAccounts],
  )

  const customizeChrome = isCustomizeMode ? (
    <div className="space-y-3 mb-4">
      <ModuleCustomizeHint surfaceLabel={surfaceConfig.label} />
      <div className="flex flex-wrap items-center gap-2">
        <WidgetCatalogDialog available={availableWidgets} onAdd={addWidget} />
        <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
          Reset layout
        </Button>
      </div>
    </div>
  ) : null

  if (!isSupabaseConfigured) {
    return (
      <MotionPage className="p-6">
        <FinanceHeader
          customizeMode={false}
          onEnterCustomize={() => undefined}
          onDone={() => undefined}
        />
        <Card className="mt-6">
          <CardContent className="py-12 text-center text-muted-foreground">
            Connect Supabase to use Katana Finance.
          </CardContent>
        </Card>
      </MotionPage>
    )
  }

  if (loading) {
    return (
      <MotionPage className="p-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </MotionPage>
    )
  }

  return (
    <MotionPage className="p-6 space-y-6">
      <FinanceHeader
        customizeMode={isCustomizeMode}
        onEnterCustomize={enterCustomize}
        onDone={() => void saveAndExit()}
      />

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Could not load finance data</p>
              <p className="text-muted-foreground mt-1">{error}</p>
              <p className="text-muted-foreground mt-2 text-xs">
                If this is your first time, run <code className="text-xs">supabase-finance-schema.sql</code>{' '}
                in the Supabase SQL Editor.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-amber-500/30 bg-amber-500/5" data-tour="finance-disclaimer">
        <CardContent className="pt-4 text-xs text-muted-foreground">
          Katana Finance helps organize your books and prepare information for your tax professional.
          It does not provide tax advice or file returns.
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={handleTabChange} data-tour="finance-tabs">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">
            Transactions
            {(summary?.uncategorizedCount ?? 0) > 0 && (
              <span className="ml-1.5 text-xs bg-destructive text-destructive-foreground rounded-full px-1.5">
                {summary?.uncategorizedCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="accounts">Bank accounts</TabsTrigger>
          <TabsTrigger value="reconcile">Reconcile</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="tax">Tax readiness</TabsTrigger>
          <TabsTrigger value="coa">Chart of accounts</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {customizeChrome}
          {summary && (
            <FinanceOverview
              summary={summary}
              settings={settings}
              onGoToTransactions={() => handleTabChange('transactions')}
              onGoToAccounts={() => handleTabChange('accounts')}
              onGoToReconcile={() => handleTabChange('reconcile')}
              onGoToReports={() => handleTabChange('reports')}
              onGoToTax={() => handleTabChange('tax')}
              layout={tabLayout}
            />
          )}
        </TabsContent>

        <TabsContent value="transactions" className="mt-6">
          {customizeChrome}
          <FinanceTransactionsPanel
            transactions={transactions}
            financialAccounts={financialAccounts}
            expenseAccounts={expenseAccounts}
            onRefresh={fetchData}
            layout={tabLayout}
          />
        </TabsContent>

        <TabsContent value="accounts" className="mt-6">
          {customizeChrome}
          <FinanceBankAccountsPanel
            accounts={financialAccounts}
            onRefresh={fetchData}
            layout={tabLayout}
          />
        </TabsContent>

        <TabsContent value="reconcile" className="mt-6">
          {customizeChrome}
          <FinanceReconciliationPanel
            financialAccounts={financialAccounts}
            onRefresh={fetchData}
            layout={tabLayout}
          />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          {customizeChrome}
          <FinanceReportsPanel layout={tabLayout} />
        </TabsContent>

        <TabsContent value="tax" className="mt-6">
          {customizeChrome}
          <FinanceTaxReadinessPanel layout={tabLayout} />
        </TabsContent>

        <TabsContent value="coa" className="mt-6">
          {customizeChrome}
          <FinanceChartOfAccountsPanel accounts={coaAccounts} layout={tabLayout} />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          {customizeChrome}
          <FinanceSettingsPanel
            settings={settings}
            onEditSetup={() => setSetupOpen(true)}
            layout={tabLayout}
          />
        </TabsContent>
      </Tabs>

      <FinanceSetupDialog open={setupOpen} onOpenChange={setSetupOpen} onComplete={fetchData} />
    </MotionPage>
  )
}

function FinanceHeader({
  customizeMode,
  onEnterCustomize,
  onDone,
}: {
  customizeMode: boolean
  onEnterCustomize: () => void
  onDone: () => void
}) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4" data-tour="finance-header">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Landmark className="w-7 h-7" />
          Katana Finance
          <ModuleHelpButton moduleId="finance" />
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Reconcile accounts, categorize transactions, and get export-ready for tax season.
        </p>
      </div>
      <ModuleCustomizeControls
        customizeMode={customizeMode}
        onEnterCustomize={onEnterCustomize}
        onDone={onDone}
        dataTourCustomize="finance-customize"
      />
    </div>
  )
}

function FinanceSettingsPanel({
  settings,
  onEditSetup,
  layout,
}: {
  settings: FinEntitySettings | null
  onEditSetup: () => void
  layout: FinanceTabLayoutProps
}) {
  return (
    <ModuleWidgetCanvas
      widgets={layout.widgets}
      catalog={layout.catalog}
      customizeMode={layout.customizeMode}
      onLayoutChange={layout.onLayoutChange}
      onRemoveWidget={layout.onRemoveWidget}
      rowHeight={36}
      renderWidget={(widgetId) => {
        if (widgetId === 'settings_empty') {
          if (settings) {
            return (
              <Card className="h-full">
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  Finance is configured. Use entity settings to review details.
                </CardContent>
              </Card>
            )
          }
          return (
            <Card className="h-full">
              <CardContent className="py-12 text-center space-y-4">
                <Settings2 className="w-10 h-10 mx-auto text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Finance is not configured yet.</p>
                <Button onClick={onEditSetup}>Run setup wizard</Button>
              </CardContent>
            </Card>
          )
        }

        if (!settings) {
          if (widgetId === 'entity_settings' || widgetId === 'setup_actions') {
            return (
              <Card className="h-full">
                <CardContent className="py-12 text-center space-y-4">
                  <Settings2 className="w-10 h-10 mx-auto text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Finance is not configured yet.</p>
                  <Button onClick={onEditSetup}>Run setup wizard</Button>
                </CardContent>
              </Card>
            )
          }
          return null
        }

        if (widgetId === 'entity_settings') {
          return (
            <Card className="h-full overflow-auto">
              <CardContent className="pt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Legal structure</p>
                    <p className="font-medium">{ENTITY_TYPE_LABELS[settings.entity_type]}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Accounting method</p>
                    <p className="font-medium">{TAX_BASIS_LABELS[settings.tax_basis]}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Industry template</p>
                    <p className="font-medium capitalize">{settings.industry_template}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fiscal year end</p>
                    <p className="font-medium">
                      {settings.fiscal_year_end_month}/{settings.fiscal_year_end_day}
                    </p>
                  </div>
                  {settings.ein && (
                    <div>
                      <p className="text-muted-foreground">EIN</p>
                      <p className="font-medium">{settings.ein}</p>
                    </div>
                  )}
                  {settings.state_of_formation && (
                    <div>
                      <p className="text-muted-foreground">State of formation</p>
                      <p className="font-medium">{settings.state_of_formation}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        }

        if (widgetId === 'setup_actions') {
          return (
            <Card className="h-full overflow-auto">
              <CardContent className="pt-6 space-y-4">
                <Button variant="outline" onClick={onEditSetup}>
                  Re-run setup
                </Button>
                <p className="text-xs text-muted-foreground">
                  Connect live bank feeds via Plaid on the Bank accounts tab. Export tax packets from
                  Tax readiness.
                </p>
              </CardContent>
            </Card>
          )
        }

        return null
      }}
    />
  )
}
