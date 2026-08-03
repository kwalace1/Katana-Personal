import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import type { AutomationDashboardStats } from '@/lib/automation-api'
import { jobTypeLabel, type AutomationJobType } from '@/lib/automation-api'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { AutomationTabLayoutProps } from '@/lib/automation/automation-widget-layout'

interface AnalyticsPanelProps {
  stats: AutomationDashboardStats | null
  loading?: boolean
  layout: AutomationTabLayoutProps
}

export function AnalyticsPanel({ stats, loading, layout }: AnalyticsPanelProps) {
  const byType = Object.entries(stats?.jobsByType ?? {}).sort((a, b) => b[1] - a[1])

  return (
    <div data-tour="automation-analytics-panel">
      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId): ReactNode => {
          if (widgetId === 'analytics_kpis') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>Analytics & Insights</CardTitle>
                  <CardDescription>
                    Usage statistics for Automation knowledge and tools
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading && !stats ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading analytics…
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border p-4">
                        <p className="mb-1 text-sm text-muted-foreground">Files uploaded</p>
                        <p className="text-2xl font-bold">{stats?.documentsIndexed ?? 0}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="mb-1 text-sm text-muted-foreground">Text-indexed</p>
                        <p className="text-2xl font-bold">{stats?.documentsReady ?? 0}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="mb-1 text-sm text-muted-foreground">Tool Runs</p>
                        <p className="text-2xl font-bold">{stats?.toolRuns ?? 0}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="mb-1 text-sm text-muted-foreground">Tasks Completed</p>
                        <p className="text-2xl font-bold">{stats?.tasksCompleted ?? 0}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="mb-1 text-sm text-muted-foreground">Failed Runs</p>
                        <p className="text-2xl font-bold">{stats?.failedRuns ?? 0}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'activity_by_type') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-base">Activity by type</CardTitle>
                  <CardDescription>
                    Counts come from your organization&apos;s Automation documents and job history.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading && !stats ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading analytics…
                    </div>
                  ) : byType.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No jobs yet. Upload a document or run a browser tool.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {byType.map(([type, count]) => {
                        const total = byType.reduce((sum, [, n]) => sum + n, 0) || 1
                        const pct = Math.round((count / total) * 100)
                        return (
                          <div key={type} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{jobTypeLabel(type as AutomationJobType)}</span>
                              <span className="text-muted-foreground">
                                {count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary/70"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
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
