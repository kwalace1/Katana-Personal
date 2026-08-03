import type { ReactNode } from 'react'
import { AlertCircle, Briefcase, Calendar, CheckCircle2, Clock, Plus, Sparkles, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { WfmStatCard } from '@/components/workforce/WfmStatCard'
import { WfmEmptyState } from '@/components/workforce/WfmEmptyState'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { WfmTerminology } from '@/lib/wfm-terminology'
import type { WorkforceTabLayoutProps } from '@/lib/workforce/workforce-widget-layout'

export interface WfmTodayJobCard {
  id: string
  title: string
  status: string
  assignee: string
  dateLabel: string
}

export interface WfmTeamCapacityRow {
  name: string
  activeCount: number
}

interface WfmTodayTabProps {
  terms: WfmTerminology
  loading: boolean
  dueTodayCount: number
  unassignedCount: number
  overdueCount: number
  inProgressCount: number
  activeTeamCount: number
  needsAttentionJobs: WfmTodayJobCard[]
  unassignedJobs: WfmTodayJobCard[]
  teamCapacity: WfmTeamCapacityRow[]
  recentActivity: string[]
  onCreateWork: () => void
  onGoToWork: () => void
  onGoToTeam: () => void
  statusColor: (status: string) => string
  layout: WorkforceTabLayoutProps
}

export function WfmTodayTab({
  terms,
  loading,
  dueTodayCount,
  unassignedCount,
  overdueCount,
  inProgressCount,
  activeTeamCount,
  needsAttentionJobs,
  unassignedJobs,
  teamCapacity,
  recentActivity,
  onCreateWork,
  onGoToWork,
  onGoToTeam,
  statusColor,
  layout,
}: WfmTodayTabProps) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div data-tour="wfm-today">
      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId): ReactNode => {
          if (widgetId === 'hero') {
            return (
              <div className="relative h-full overflow-hidden rounded-xl border bg-gradient-to-br from-primary/8 via-primary/4 to-background p-6">
                <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl" />
                <div className="relative flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Sparkles className="h-4 w-4 text-primary" />
                      {today}
                    </div>
                    <h2 className="text-xl font-semibold tracking-tight">Today at a glance</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin inline" />
                      ) : (
                        <>
                          {dueTodayCount} due · {unassignedCount} unassigned
                          {overdueCount > 0 && (
                            <span className="text-red-600 font-medium"> · {overdueCount} overdue</span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <Button onClick={onCreateWork} data-tour="wfm-new-job">
                    <Plus className="h-4 w-4 mr-2" />
                    {terms.newWorkItem}
                  </Button>
                </div>
              </div>
            )
          }

          if (widgetId === 'kpi_strip') {
            return (
              <div className="h-full grid grid-cols-2 md:grid-cols-4 gap-3 content-start">
                <WfmStatCard
                  label="Due today"
                  value={loading ? '–' : dueTodayCount}
                  icon={Calendar}
                  accent="primary"
                />
                <WfmStatCard
                  label="In progress"
                  value={loading ? '–' : inProgressCount}
                  icon={Briefcase}
                  accent="blue"
                />
                <WfmStatCard
                  label={`Active ${terms.teamMemberPlural.toLowerCase()}`}
                  value={loading ? '–' : activeTeamCount}
                  icon={Users}
                />
                <WfmStatCard
                  label="Overdue"
                  value={loading ? '–' : overdueCount}
                  icon={AlertCircle}
                  accent={overdueCount > 0 ? 'danger' : 'default'}
                />
              </div>
            )
          }

          if (widgetId === 'needs_attention') {
            return (
              <Card data-tour="wfm-needs-attention" className="h-full overflow-hidden">
                <CardHeader className="pb-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Needs attention</CardTitle>
                      <CardDescription>Overdue or on hold — assign or update status</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onGoToWork}>
                      View all
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-4 overflow-auto">
                  {loading ? (
                    <p className="text-sm text-muted-foreground py-4">Loading…</p>
                  ) : needsAttentionJobs.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      All clear — nothing urgent right now
                    </div>
                  ) : (
                    needsAttentionJobs.slice(0, 5).map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={onGoToWork}
                        className="w-full flex items-center justify-between gap-2 rounded-lg border p-3 text-sm text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{job.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {job.assignee} · {job.dateLabel}
                          </p>
                        </div>
                        <Badge variant="outline" className={statusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'unassigned') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader className="pb-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Unassigned</CardTitle>
                      <CardDescription>
                        {terms.workItemPlural} waiting for an owner
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onGoToTeam}>
                      {terms.teamMemberPlural}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-4 overflow-auto">
                  {loading ? (
                    <p className="text-sm text-muted-foreground py-4">Loading…</p>
                  ) : unassignedJobs.length === 0 ? (
                    <WfmEmptyState
                      icon={CheckCircle2}
                      title={`All ${terms.workItemPlural.toLowerCase()} assigned`}
                      description="Every open item has an owner."
                      className="py-6 border-0 bg-transparent"
                    />
                  ) : (
                    unassignedJobs.slice(0, 5).map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={onGoToTeam}
                        className="w-full flex items-center justify-between gap-2 rounded-lg border p-3 text-sm text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{job.title}</p>
                          <p className="text-xs text-muted-foreground">{job.dateLabel}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-amber-500/10 text-amber-600 border-amber-500/20"
                        >
                          Unassigned
                        </Badge>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'team_capacity') {
            return (
              <Card data-tour="wfm-quick-stats" className="h-full overflow-auto">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Team capacity</CardTitle>
                  <CardDescription>
                    Active {terms.workItemPlural.toLowerCase()} per person
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : teamCapacity.length === 0 ? (
                    <WfmEmptyState
                      icon={Users}
                      title="No team members yet"
                      description={`Add ${terms.teamMemberPlural.toLowerCase()} to start assigning work.`}
                      actionLabel={`Add ${terms.teamMember.toLowerCase()}`}
                      onAction={onGoToTeam}
                      className="py-6"
                    />
                  ) : (
                    teamCapacity.slice(0, 6).map((row) => {
                      const pct = Math.min(100, row.activeCount * 25)
                      const loadColor =
                        pct >= 75 ? 'bg-red-500' : pct >= 50 ? 'bg-amber-500' : 'bg-primary'
                      return (
                        <div key={row.name} className="space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{row.name}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {row.activeCount} active
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${loadColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'recent_activity') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Recent activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {loading ? (
                      <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : recentActivity.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Activity will appear as your team works.
                      </p>
                    ) : (
                      recentActivity.slice(0, 6).map((activity, index) => (
                        <div key={index} className="text-sm flex items-start gap-3">
                          <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                          <span className="text-muted-foreground">{activity}</span>
                        </div>
                      ))
                    )}
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
