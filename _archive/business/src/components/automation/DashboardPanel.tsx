import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart3,
  Bot,
  CheckCircle2,
  FileText,
  Loader2,
  MessageSquare,
  Upload,
  Zap,
  XCircle,
} from 'lucide-react'
import type { AutomationDashboardStats } from '@/lib/automation-api'
import { jobTypeLabel, relativeTime } from '@/lib/automation-api'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { AutomationTabLayoutProps } from '@/lib/automation/automation-widget-layout'
import type { AutomationTab } from './types'

interface DashboardPanelProps {
  stats: AutomationDashboardStats | null
  loading?: boolean
  onSelectTab: (tab: AutomationTab) => void
  onOpenAgent: () => void
  layout: AutomationTabLayoutProps
}

export function DashboardPanel({
  stats,
  loading,
  onSelectTab,
  onOpenAgent,
  layout,
}: DashboardPanelProps) {
  const documentsIndexed = stats?.documentsReady ?? stats?.documentsIndexed ?? 0
  const tasksCompleted = stats?.tasksCompleted ?? 0
  const toolRuns = stats?.toolRuns ?? 0
  const activity = stats?.recentActivity ?? []

  return (
    <div data-tour="automation-dashboard-panel">
      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId): ReactNode => {
          if (widgetId === 'kpi_strip') {
            return (
              <Card className="h-full overflow-hidden">
                <CardContent className="h-full p-6">
                  {loading && !stats ? (
                    <div className="flex h-full items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading dashboard…
                    </div>
                  ) : (
                    <div className="grid h-full grid-cols-1 content-center divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
                      <div className="flex items-center gap-4 py-4 md:px-6 md:py-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            Documents Indexed
                          </p>
                          <p className="text-2xl font-bold">{documentsIndexed}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 py-4 md:px-6 md:py-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            Tasks Completed
                          </p>
                          <p className="text-2xl font-bold">{tasksCompleted}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 py-4 md:px-6 md:py-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Zap className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Tool Runs</p>
                          <p className="text-2xl font-bold">{toolRuns}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'quick_actions') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>
                    Manage knowledge and tools — chat with agents in Agent Office
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="h-20 flex-col gap-2 bg-transparent"
                      onClick={onOpenAgent}
                    >
                      <MessageSquare className="h-5 w-5" />
                      <span>Ask Automation Agent</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-20 flex-col gap-2 bg-transparent"
                      onClick={() => onSelectTab('documents')}
                    >
                      <Upload className="h-5 w-5" />
                      <span>Upload Document</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-20 flex-col gap-2 bg-transparent"
                      onClick={() => onSelectTab('automation')}
                    >
                      <Zap className="h-5 w-5" />
                      <span>Run Automation</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-20 flex-col gap-2 bg-transparent"
                      onClick={() => onSelectTab('analytics')}
                    >
                      <BarChart3 className="h-5 w-5" />
                      <span>View Analytics</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'recent_activity') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest document uploads and tool runs</CardDescription>
                </CardHeader>
                <CardContent>
                  {activity.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No activity yet. Upload a document or run a browser tool to get started.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {activity.map((job) => (
                        <div key={job.id} className="flex items-center gap-3 rounded-lg border p-3">
                          {job.status === 'failed' ? (
                            <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                          ) : job.job_type === 'document_upload' ? (
                            <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                          ) : job.job_type === 'screenshot' ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                          ) : (
                            <Bot className="h-4 w-4 shrink-0 text-indigo-500" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {job.title || jobTypeLabel(job.job_type)}
                            {job.error_message ? ` — ${job.error_message}` : ''}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {relativeTime(job.created_at)}
                          </span>
                        </div>
                      ))}
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
