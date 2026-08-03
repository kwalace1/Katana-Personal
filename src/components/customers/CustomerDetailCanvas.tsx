import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Building, Loader2, Target, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Client } from '@/lib/customer-success-api'
import { formatDateOnly } from '@/lib/due-date-utils'
import {
  getAccountWorkspaceData,
  updateClientOutreachStatus,
  type KycAccountWorkspaceData,
  type KycOutreachStatus,
} from '@/lib/kyc-api'
import { buildKycSummaryContext, buildTemplateClientSummary, type KycSummarySource } from '@/lib/kyc-client-summary'
import { generateClientExecutiveSummary } from '@/lib/kyc-summary-api'
import { KycAccountOverview } from '@/components/customers/KycAccountOverview'
import { KycCsmBriefingCard } from '@/components/customers/KycCsmBriefingCard'
import { KycAccountActivityPanel } from '@/components/customers/KycAccountActivityPanel'
import { KycAccountPeoplePanel } from '@/components/customers/KycAccountPeoplePanel'
import { KycAccountRevenuePanel } from '@/components/customers/KycAccountRevenuePanel'
import { KycAccountIntelligencePanel } from '@/components/customers/KycAccountIntelligencePanel'
import { KycRelationshipMap } from '@/components/customers/KycRelationshipMap'
import { KycModuleEntitlementsPanel } from '@/components/customers/KycModuleEntitlementsPanel'
import { KycOutreachSelector } from '@/components/customers/KycOutreachSelector'
import { CrmCustomerLinkedRecords } from '@/components/customers/CrmCustomerLinkedRecords'
import { ModuleCustomizeControls, ModuleCustomizeHint } from '@/components/module-layout/ModuleCustomizeBar'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import { WidgetCatalogDialog } from '@/components/module-layout/WidgetCatalogDialog'
import { useModuleWidgetLayout } from '@/hooks/useModuleWidgetLayout'
import {
  CUSTOMERS_CLIENT_DETAIL_SURFACE,
  CUSTOMERS_CLIENT_DETAIL_WIDGET_CATALOG,
  CUSTOMERS_MODULE_ID,
  customersClientDetailWidgetLayoutToBase,
  normalizeCustomersClientDetailWidgetLayout,
} from '@/lib/customers/customers-widget-layout'

interface CustomerDetailCanvasProps {
  client: Client
  taskCounts: { completed: number; total: number }
  milestoneCounts: { completed: number; total: number }
  interactionsCount: number
  getHealthColor: (score: number) => string
  getHealthBadge: (status: string) => ReactNode
  getTimeSince: (dateString: string) => string
  onClientUpdated?: () => void
}

export function CustomerDetailCanvas({
  client,
  taskCounts,
  milestoneCounts,
  interactionsCount,
  getHealthColor,
  getHealthBadge,
  getTimeSince,
  onClientUpdated,
}: CustomerDetailCanvasProps) {
  const [workspace, setWorkspace] = useState<KycAccountWorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [outreachStatus, setOutreachStatus] = useState<KycOutreachStatus>(
    (client.outreach_status as KycOutreachStatus) ?? 'none',
  )
  const [savingOutreach, setSavingOutreach] = useState(false)
  const [summary, setSummary] = useState('')
  const [summarySource, setSummarySource] = useState<KycSummarySource>('template')
  const [summaryGeneratedAt, setSummaryGeneratedAt] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryRefreshing, setSummaryRefreshing] = useState(false)

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
    moduleId: CUSTOMERS_MODULE_ID,
    surfaceId: CUSTOMERS_CLIENT_DETAIL_SURFACE,
    catalog: CUSTOMERS_CLIENT_DETAIL_WIDGET_CATALOG,
    normalize: normalizeCustomersClientDetailWidgetLayout,
    toBase: customersClientDetailWidgetLayoutToBase,
    successMessage: 'Client detail layout saved',
  })

  const loadWorkspace = useCallback(async () => {
    setLoading(true)
    const data = await getAccountWorkspaceData(client)
    setWorkspace(data)
    setLoading(false)
    return data
  }, [client])

  const loadSummary = useCallback(
    async (intelResult: KycAccountWorkspaceData['intel'], options?: { force?: boolean }) => {
      setSummaryLoading(!options?.force)
      setSummaryRefreshing(Boolean(options?.force))
      try {
        const result = await generateClientExecutiveSummary(client, intelResult, {
          preferAi: true,
          force: options?.force,
        })
        setSummary(result.summary)
        setSummarySource(result.source)
        setSummaryGeneratedAt(result.generated_at)
      } catch {
        setSummary(buildTemplateClientSummary(buildKycSummaryContext(client, intelResult)))
        setSummarySource('template')
        setSummaryGeneratedAt(null)
      } finally {
        setSummaryLoading(false)
        setSummaryRefreshing(false)
      }
    },
    [client],
  )

  useEffect(() => {
    void (async () => {
      const data = await loadWorkspace()
      const instant = buildTemplateClientSummary(buildKycSummaryContext(client, data.intel))
      setSummary(instant)
      setSummarySource('template')
      void loadSummary(data.intel)
    })()
    setOutreachStatus((client.outreach_status as KycOutreachStatus) ?? 'none')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  const handleRefresh = useCallback(() => {
    void loadWorkspace().then((data) => {
      if (data) void loadSummary(data.intel, { force: true })
    })
    onClientUpdated?.()
  }, [loadWorkspace, loadSummary, onClientUpdated])

  const handleOutreachChange = async (value: string) => {
    const next = value as KycOutreachStatus
    setOutreachStatus(next)
    setSavingOutreach(true)
    const ok = await updateClientOutreachStatus(client.id, next)
    setSavingOutreach(false)
    if (ok) {
      onClientUpdated?.()
    } else {
      setOutreachStatus((client.outreach_status as KycOutreachStatus) ?? 'none')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <ModuleCustomizeControls
          customizeMode={isCustomizeMode}
          onEnterCustomize={enterCustomize}
          onDone={() => void saveAndExit()}
          dataTourCustomize="cs-client-detail-customize"
        />
      </div>

      {isCustomizeMode ? (
        <div className="space-y-3">
          <ModuleCustomizeHint surfaceLabel="client detail" />
          <div className="flex flex-wrap items-center gap-2">
            <WidgetCatalogDialog available={availableWidgets} onAdd={addWidget} />
            <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
              Reset layout
            </Button>
          </div>
        </div>
      ) : null}

      {loading || !workspace ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center rounded-xl border bg-muted/20">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading customer intelligence…
        </div>
      ) : (
        <ModuleWidgetCanvas
          widgets={layout.widgets}
          catalog={CUSTOMERS_CLIENT_DETAIL_WIDGET_CATALOG}
          customizeMode={isCustomizeMode}
          onLayoutChange={onLayoutChange}
          onRemoveWidget={removeWidget}
          rowHeight={36}
          renderWidget={(widgetId) => {
            if (widgetId === 'stats') {
              return (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 h-full">
                  <Card className="bg-card">
                    <CardContent className="pt-4 pb-4 px-3">
                      <div className="text-center space-y-2">
                        <p className="text-xs text-muted-foreground">Engagement</p>
                        <p className={`text-2xl font-bold ${getHealthColor(client.health_score)}`}>
                          {client.health_score}%
                        </p>
                        <div className="flex justify-center">{getHealthBadge(client.status)}</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card">
                    <CardContent className="pt-4 pb-4 px-3">
                      <div className="text-center space-y-2">
                        <p className="text-xs text-muted-foreground">Engagement level</p>
                        <p className="text-2xl font-bold">{client.engagement_score}%</p>
                        <p className="text-xs text-muted-foreground">Activity & usage</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card">
                    <CardContent className="pt-4 pb-4 px-3">
                      <div className="text-center space-y-2">
                        <p className="text-xs text-muted-foreground">Last contact</p>
                        <p className="text-2xl font-bold">{getTimeSince(client.last_contact_date)}</p>
                        <p className="text-xs text-muted-foreground">ago</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card">
                    <CardContent className="pt-4 pb-4 px-3">
                      <div className="text-center space-y-2">
                        <p className="text-xs text-muted-foreground">Next follow-up</p>
                        <p className="text-2xl font-bold">{formatDateOnly(client.renewal_date)}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )
            }

            if (widgetId === 'csm_briefing') {
              return (
                <div className="h-full overflow-auto">
                  <KycCsmBriefingCard briefing={workspace.briefing} />
                </div>
              )
            }

            if (widgetId === 'account_overview') {
              return (
                <div className="h-full overflow-auto">
                  <KycAccountOverview
                    client={client}
                    intel={workspace.intel}
                    outreachSlot={
                      <KycOutreachSelector
                        mode="client"
                        value={outreachStatus}
                        onChange={(v) => void handleOutreachChange(v)}
                        disabled={savingOutreach}
                      />
                    }
                    executiveSummary={{
                      text: summary,
                      source: summarySource,
                      loading: summaryLoading && !summary,
                      refreshing: summaryRefreshing,
                      generatedAt: summaryGeneratedAt,
                      onRefresh: () => void loadSummary(workspace.intel, { force: true }),
                    }}
                    onActionTaskCreated={handleRefresh}
                  />
                </div>
              )
            }

            if (widgetId === 'activity') {
              return (
                <div className="h-full overflow-auto">
                  <KycAccountActivityPanel client={client} />
                </div>
              )
            }

            if (widgetId === 'people') {
              return (
                <div className="h-full overflow-auto">
                  <KycAccountPeoplePanel contacts={workspace.contacts} onUpdated={onClientUpdated} />
                </div>
              )
            }

            if (widgetId === 'relationship_map') {
              return (
                <div className="h-full overflow-auto">
                  <KycRelationshipMap client={client} embedded />
                </div>
              )
            }

            if (widgetId === 'revenue') {
              return (
                <div className="h-full overflow-auto">
                  <KycAccountRevenuePanel revenue={workspace.revenue} />
                </div>
              )
            }

            if (widgetId === 'intelligence') {
              return (
                <div className="h-full overflow-auto">
                  <KycAccountIntelligencePanel client={client} intel={workspace.intel} onRefreshed={handleRefresh} />
                </div>
              )
            }

            if (widgetId === 'entitlements') {
              return (
                <div className="h-full overflow-auto">
                  <KycModuleEntitlementsPanel client={client} intel={workspace.intel} />
                </div>
              )
            }

            if (widgetId === 'company_info') {
              return (
                <Card className="bg-card h-full overflow-auto">
                  <CardContent className="pt-6 pb-6 space-y-6">
                    <div>
                      <h4 className="font-semibold mb-4 flex items-center gap-2 text-base">
                        <Building className="w-4 h-4" />
                        Company Information
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground whitespace-nowrap">Industry:</span>
                          <span className="font-medium text-right">{client.industry}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground whitespace-nowrap">Next follow-up:</span>
                          <span className="font-medium text-right">{formatDateOnly(client.renewal_date)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground whitespace-nowrap">Last Contact:</span>
                          <span className="font-medium text-right">{getTimeSince(client.last_contact_date)} ago</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-4 flex items-center gap-2 text-base">
                        <Users className="w-4 h-4" />
                        Account Management
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-muted-foreground whitespace-nowrap">CSM:</span>
                          {client.csm ? (
                            <div className="flex items-center gap-2">
                              {client.csm.avatar && (
                                <img
                                  src={client.csm.avatar}
                                  alt={client.csm.name}
                                  className="w-5 h-5 rounded-full"
                                />
                              )}
                              <span className="font-medium">{client.csm.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </div>
                        {client.csm?.email && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground whitespace-nowrap">Email:</span>
                            <span className="font-medium text-right break-all">{client.csm.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            }

            if (widgetId === 'linked_records') {
              return (
                <div className="h-full overflow-auto">
                  <CrmCustomerLinkedRecords clientId={client.id} />
                </div>
              )
            }

            if (widgetId === 'account_counts') {
              return (
                <div className="h-full overflow-auto">
                  <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                    <Target className="w-4 h-4" />
                    Activity Overview
                  </h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Card className="bg-card">
                      <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Tasks</p>
                        <p className="text-2xl font-bold">
                          {taskCounts.completed}/{taskCounts.total}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-card">
                      <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Milestones</p>
                        <p className="text-2xl font-bold">
                          {milestoneCounts.completed}/{milestoneCounts.total}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-card">
                      <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Interactions</p>
                        <p className="text-2xl font-bold">{interactionsCount}</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )
            }

            return null
          }}
        />
      )}
    </div>
  )
}
