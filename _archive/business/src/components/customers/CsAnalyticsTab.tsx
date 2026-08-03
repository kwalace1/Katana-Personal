import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Kanban,
  Megaphone,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CsTabHeader } from '@/components/customers/CsModuleUi'
import { KycStatTile, clientStatusBadgeClass } from '@/components/customers/KycUi'
import { KycPortfolioTopActions } from '@/components/customers/KycPortfolioTopActions'
import { KYC_CLIENT_OUTREACH_LABELS } from '@/lib/kyc-client-scoring'
import type { KycAccountAttentionRow, KycPortfolioSummary } from '@/lib/kyc-api'
import type { Client, ClientInteraction, ClientMilestone, ClientTask, CSMUser } from '@/lib/customer-success-api'
import type { CrmDeal, CrmStats, PipelineStage, CrmCampaign, CrmLead } from '@/lib/customer-crm-api'
import { cn } from '@/lib/utils'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { CustomersTabLayoutProps } from '@/lib/customers/customers-widget-layout'

const HEALTH_COLORS = { healthy: '#22c55e', moderate: '#eab308', atRisk: '#ef4444' }
const INTERACTION_COLORS = { email: '#3b82f6', call: '#22c55e', meeting: '#a855f7', note: '#64748b' }

const OUTREACH_CHIP_COLORS: Record<string, string> = {
  none: 'bg-muted text-muted-foreground',
  planned: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  contacted: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  meeting: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400',
  at_risk: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

type DateRange = '30' | '90' | '365' | 'all'

function inDateRange(dateStr: string, range: DateRange): boolean {
  if (range === 'all') return true
  const days = parseInt(range, 10)
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return new Date(dateStr).getTime() >= cutoff
}

function dateRangeLabel(range: DateRange): string {
  if (range === 'all') return 'all time'
  if (range === '365') return 'the last year'
  return `the last ${range} days`
}

interface CsAnalyticsTabProps {
  clients: Client[]
  tasks: ClientTask[]
  interactions: ClientInteraction[]
  milestones: ClientMilestone[]
  stats: {
    totalClients: number
    atRiskCount: number
    avgHealthScore: number
    totalARR: number
    completedTasks: number
    totalTasks: number
    overdueTasks: number
  }
  kycSummary: KycPortfolioSummary | null
  accountRows: KycAccountAttentionRow[]
  crmStats: CrmStats
  crmDeals: CrmDeal[]
  crmStages: PipelineStage[]
  crmCampaigns?: CrmCampaign[]
  crmLeads?: CrmLead[]
  csmUsers: CSMUser[]
  onOpenClient?: (clientId: string) => void
  layout: CustomersTabLayoutProps
}

export function CsAnalyticsTab({
  clients,
  tasks,
  interactions,
  milestones,
  stats,
  kycSummary,
  accountRows,
  crmStats,
  crmDeals,
  crmStages,
  crmCampaigns = [],
  crmLeads = [],
  csmUsers,
  onOpenClient,
  layout,
}: CsAnalyticsTabProps) {
  const [dateRange, setDateRange] = useState<DateRange>('90')

  const filteredInteractions = useMemo(
    () => interactions.filter((i) => inDateRange(i.interaction_date, dateRange)),
    [interactions, dateRange],
  )

  const filteredTasks = useMemo(
    () => tasks.filter((t) => inDateRange(t.created_at, dateRange)),
    [tasks, dateRange],
  )

  const healthDistribution = useMemo(() => {
    const healthy = kycSummary?.healthy_count ?? clients.filter((c) => c.health_score >= 80).length
    const moderate = kycSummary?.moderate_count ?? clients.filter((c) => c.health_score >= 60 && c.health_score < 80).length
    const atRisk = kycSummary?.at_risk_count ?? clients.filter((c) => c.health_score < 60).length
    return [
      { name: 'Healthy', value: healthy, fill: HEALTH_COLORS.healthy },
      { name: 'Moderate', value: moderate, fill: HEALTH_COLORS.moderate },
      { name: 'At risk', value: atRisk, fill: HEALTH_COLORS.atRisk },
    ].filter((d) => d.value > 0)
  }, [clients, kycSummary])

  const arrBySegment = useMemo(
    () => [
      {
        name: 'Healthy',
        arr: clients.filter((c) => c.health_score >= 80).reduce((sum, c) => sum + c.arr, 0) / 1000,
        fill: HEALTH_COLORS.healthy,
      },
      {
        name: 'Moderate',
        arr: clients.filter((c) => c.health_score >= 60 && c.health_score < 80).reduce((sum, c) => sum + c.arr, 0) / 1000,
        fill: HEALTH_COLORS.moderate,
      },
      {
        name: 'At risk',
        arr: clients.filter((c) => c.health_score < 60).reduce((sum, c) => sum + c.arr, 0) / 1000,
        fill: HEALTH_COLORS.atRisk,
      },
    ],
    [clients],
  )

  const interactionBreakdown = useMemo(() => {
    const types = ['email', 'call', 'meeting', 'note'] as const
    return types.map((type) => ({
      name: type === 'meeting' ? 'Visit' : type.charAt(0).toUpperCase() + type.slice(1),
      count: filteredInteractions.filter((i) => i.type === type).length,
      fill: INTERACTION_COLORS[type],
    }))
  }, [filteredInteractions])

  const taskStatusData = useMemo(() => {
    const completed = filteredTasks.filter((t) => t.status === 'completed').length
    const overdue = filteredTasks.filter((t) => t.status === 'overdue').length
    const active = filteredTasks.length - completed - overdue
    return [
      { name: 'Completed', value: completed, fill: '#22c55e' },
      { name: 'Active', value: active, fill: '#3b82f6' },
      { name: 'Overdue', value: overdue, fill: '#ef4444' },
    ].filter((d) => d.value > 0)
  }, [filteredTasks])

  const pipelineByStage = useMemo(() => {
    const openDeals = crmDeals.filter((d) => d.status === 'open')
    const stageOrder = [...crmStages].sort((a, b) => a.position - b.position)
    if (stageOrder.length === 0) {
      return [{ name: 'Open deals', count: openDeals.length, value: openDeals.reduce((s, d) => s + d.amount, 0) / 1000 }]
    }
    return stageOrder
      .filter((s) => !s.is_lost)
      .map((stage) => {
        const stageDeals = openDeals.filter((d) => d.stage_id === stage.id)
        return {
          name: stage.name,
          count: stageDeals.length,
          value: stageDeals.reduce((sum, d) => sum + d.amount, 0) / 1000,
        }
      })
      .filter((s) => s.count > 0 || s.value > 0)
  }, [crmDeals, crmStages])

  const topAccounts = useMemo(
    () =>
      [...accountRows]
        .sort((a, b) => b.attention_score - a.attention_score || b.arr - a.arr)
        .slice(0, 5),
    [accountRows],
  )

  const kycTaskStats = useMemo(() => {
    const kycTasks = tasks.filter((t) => Boolean((t as ClientTask & { kyc_action_id?: string }).kyc_action_id))
    const completed = kycTasks.filter((t) => t.status === 'completed').length
    const open = kycTasks.filter((t) => t.status !== 'completed').length
    const rate = kycTasks.length > 0 ? Math.round((completed / kycTasks.length) * 100) : 0
    return { total: kycTasks.length, completed, open, rate }
  }, [tasks])

  const campaignStats = useMemo(() => {
    const converted = crmLeads.filter((l) => l.status === 'converted').length
    const attributedClients = clients.filter((c) => Boolean((c as Client & { campaign_id?: string }).campaign_id)).length
    const active = crmCampaigns.filter((c) => c.status === 'active').length
    const conversionRate = crmLeads.length > 0 ? Math.round((converted / crmLeads.length) * 100) : 0
    return { converted, attributedClients, active, conversionRate, totalLeads: crmLeads.length }
  }, [crmLeads, crmCampaigns, clients])

  const supportVolume = useMemo(
    () => clients.reduce((sum, c) => sum + (c.support_tickets ?? 0), 0),
    [clients],
  )

  const portfolioMrr = useMemo(
    () => clients.reduce((sum, c) => sum + (c.arr ?? 0), 0) / 12,
    [clients],
  )

  const healthyPct =
    clients.length > 0
      ? Math.round(((kycSummary?.healthy_count ?? clients.filter((c) => c.health_score >= 80).length) / clients.length) * 100)
      : 0

  const taskCompletionRate =
    filteredTasks.length > 0
      ? Math.round((filteredTasks.filter((t) => t.status === 'completed').length / filteredTasks.length) * 100)
      : stats.totalTasks > 0
        ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
        : 0

  return (
    <div className="space-y-6">
      <CsTabHeader
        icon={BarChart3}
        title="Customer Analytics"
        description="Portfolio health, revenue exposure, engagement activity, and pipeline performance — all in one view."
        actions={
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId) => {
          if (widgetId === 'portfolio_snapshot') {
            return kycSummary ? (
              <div className="h-full overflow-auto grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <KycStatTile
                  icon={Users}
                  label="Total customers"
                  value={kycSummary.total_customers}
                  subtitle={`${kycSummary.b2b_count} B2B · ${kycSummary.b2c_count} B2C`}
                />
                <KycStatTile
                  icon={AlertTriangle}
                  label="At risk"
                  value={kycSummary.at_risk_count}
                  subtitle={`$${(kycSummary.arr_at_risk / 1000).toFixed(0)}K ARR exposed`}
                  variant="danger"
                />
                <KycStatTile
                  icon={ShieldAlert}
                  label="Renewal risk"
                  value={kycSummary.renewal_risk_high_count}
                  subtitle={`${kycSummary.renewals_within_90d} renewals ≤90d`}
                  variant="warning"
                />
                <KycStatTile
                  icon={TrendingUp}
                  label="Expansion ready"
                  value={kycSummary.expansion_high_count}
                  subtitle="High expansion likelihood"
                  variant="success"
                />
                <KycStatTile
                  icon={DollarSign}
                  label="Total ARR"
                  value={`$${(stats.totalARR / 1000).toFixed(0)}K`}
                  subtitle={
                    clients.length > 0
                      ? `$${Math.round(stats.totalARR / clients.length / 1000)}K avg per account`
                      : 'No accounts yet'
                  }
                />
                <KycStatTile
                  icon={Target}
                  label="Avg health"
                  value={`${kycSummary.avg_health_score}%`}
                  subtitle={`${healthyPct}% healthy · ${kycSummary.high_attention_count} need action`}
                  variant={
                    kycSummary.avg_health_score >= 70 ? 'success' : kycSummary.avg_health_score >= 40 ? 'warning' : 'danger'
                  }
                />
              </div>
            ) : (
              <EmptyChart message="Portfolio intelligence loading…" />
            )
          }

          if (widgetId === 'activity_pipeline_kpis') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Activity & pipeline</CardTitle>
                  <CardDescription>Engagement and CRM metrics for {dateRangeLabel(dateRange)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <KycStatTile
                      icon={MessageSquare}
                      label="Interactions"
                      value={filteredInteractions.length}
                      subtitle={`${interactions.length} total logged`}
                    />
                    <KycStatTile
                      icon={CheckCircle2}
                      label="Task completion"
                      value={`${taskCompletionRate}%`}
                      subtitle={`${filteredTasks.filter((t) => t.status === 'completed').length} completed in period`}
                      variant={taskCompletionRate >= 70 ? 'success' : taskCompletionRate >= 40 ? 'warning' : 'danger'}
                    />
                    <KycStatTile
                      icon={Kanban}
                      label="Pipeline value"
                      value={`$${(crmStats.pipelineValue / 1000).toFixed(0)}K`}
                      subtitle={`${crmStats.openDeals} open deals`}
                    />
                    <KycStatTile
                      icon={Megaphone}
                      label="New leads"
                      value={crmStats.newLeads}
                      subtitle={`${crmStats.activeCampaigns} active campaigns`}
                    />
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'kyc_action_tasks') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">KYC action tasks</CardTitle>
                  <CardDescription>Intelligence-recommended plays booked as customer tasks</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  <KycStatTile icon={Target} label="Linked tasks" value={kycTaskStats.total} subtitle={`${kycTaskStats.open} open`} />
                  <KycStatTile
                    icon={CheckCircle2}
                    label="Completion rate"
                    value={`${kycTaskStats.rate}%`}
                    subtitle={`${kycTaskStats.completed} completed`}
                    variant={kycTaskStats.rate >= 60 ? 'success' : 'warning'}
                  />
                  <KycStatTile icon={Sparkles} label="Open plays" value={kycTaskStats.open} subtitle="Awaiting CSM action" />
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'campaign_attribution') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Campaign attribution</CardTitle>
                  <CardDescription>Lead source through conversion to customer accounts</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  <KycStatTile icon={Megaphone} label="Active campaigns" value={campaignStats.active} subtitle={`${campaignStats.totalLeads} leads`} />
                  <KycStatTile icon={Users} label="Lead conversion" value={`${campaignStats.conversionRate}%`} subtitle={`${campaignStats.converted} converted`} />
                  <KycStatTile icon={BarChart3} label="Attributed accounts" value={campaignStats.attributedClients} subtitle="Customers with campaign_id" />
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'revenue_support') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Revenue & support signals</CardTitle>
                  <CardDescription>Portfolio MRR estimate and open support load across accounts</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <KycStatTile icon={DollarSign} label="Portfolio MRR" value={`$${(portfolioMrr / 1000).toFixed(1)}K`} subtitle={`$${(stats.totalARR / 1000).toFixed(0)}K ARR`} />
                  <KycStatTile icon={Activity} label="Open support tickets" value={supportVolume} subtitle="Across linked accounts" variant={supportVolume > 10 ? 'warning' : 'default'} />
                  <KycStatTile icon={ShieldAlert} label="ARR at risk" value={`$${((kycSummary?.arr_at_risk ?? 0) / 1000).toFixed(0)}K`} subtitle={`${kycSummary?.at_risk_count ?? 0} at-risk accounts`} variant="danger" />
                  <KycStatTile icon={TrendingUp} label="High attention" value={kycSummary?.high_attention_count ?? 0} subtitle="Accounts flagged by KYC" />
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'chart_health_distribution') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <CardTitle className="text-base">Health distribution</CardTitle>
                  <CardDescription>Accounts by engagement score tier</CardDescription>
                </CardHeader>
                <CardContent>
                  {healthDistribution.length === 0 ? (
                    <EmptyChart message="Add customers to see health distribution" />
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={healthDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                          >
                            {healthDistribution.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={chartTooltipStyle} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="mt-4 rounded-lg bg-muted/60 p-3 text-sm">
                        <span className="font-medium">Goal: 80% healthy</span>
                        <span className="text-muted-foreground"> · Current: {healthyPct}%</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'chart_arr_by_health') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <CardTitle className="text-base">ARR by health tier</CardTitle>
                  <CardDescription>Revenue concentration across portfolio segments</CardDescription>
                </CardHeader>
                <CardContent>
                  {clients.length === 0 ? (
                    <EmptyChart message="No revenue data yet" />
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={arrBySegment}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" />
                        <YAxis label={{ value: 'ARR ($K)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip
                          formatter={(value) => [`$${(Number(value) || 0).toFixed(0)}K`, 'ARR']}
                          contentStyle={chartTooltipStyle}
                        />
                        <Bar dataKey="arr" radius={[8, 8, 0, 0]}>
                          {arrBySegment.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'chart_interactions') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <CardTitle className="text-base">Interaction activity</CardTitle>
                  <CardDescription>Touchpoints logged in {dateRangeLabel(dateRange)}</CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredInteractions.length === 0 ? (
                    <EmptyChart message="No interactions in this period" />
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={interactionBreakdown} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={60} />
                        <Tooltip
                          formatter={(value) => [Number(value) || 0, 'Interactions']}
                          contentStyle={chartTooltipStyle}
                        />
                        <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                          {interactionBreakdown.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'chart_task_performance') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <CardTitle className="text-base">Task performance</CardTitle>
                  <CardDescription>Tasks created in {dateRangeLabel(dateRange)}</CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredTasks.length === 0 && stats.totalTasks === 0 ? (
                    <EmptyChart message="No tasks yet" />
                  ) : (
                    <div className="space-y-4">
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={
                              taskStatusData.length > 0
                                ? taskStatusData
                                : [
                                    { name: 'Completed', value: stats.completedTasks, fill: '#22c55e' },
                                    {
                                      name: 'Active',
                                      value: stats.totalTasks - stats.completedTasks - stats.overdueTasks,
                                      fill: '#3b82f6',
                                    },
                                    { name: 'Overdue', value: stats.overdueTasks, fill: '#ef4444' },
                                  ].filter((d) => d.value > 0)
                            }
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={75}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {(taskStatusData.length > 0
                              ? taskStatusData
                              : [
                                  { name: 'Completed', value: stats.completedTasks, fill: '#22c55e' },
                                  {
                                    name: 'Active',
                                    value: stats.totalTasks - stats.completedTasks - stats.overdueTasks,
                                    fill: '#3b82f6',
                                  },
                                  { name: 'Overdue', value: stats.overdueTasks, fill: '#ef4444' },
                                ]
                            ).map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={chartTooltipStyle} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="border-t pt-3">
                        <p className="mb-2 text-sm font-medium">By priority</p>
                        <div className="flex flex-wrap gap-2">
                          {(['high', 'medium', 'low'] as const).map((p) => {
                            const count = (filteredTasks.length > 0 ? filteredTasks : tasks).filter(
                              (t) => t.priority === p,
                            ).length
                            return (
                              <Badge key={p} variant="outline" className="tabular-nums">
                                {p.charAt(0).toUpperCase() + p.slice(1)}: {count}
                              </Badge>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'chart_pipeline_by_stage') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <CardTitle className="text-base">Pipeline by stage</CardTitle>
                  <CardDescription>Open deal value across CRM stages</CardDescription>
                </CardHeader>
                <CardContent>
                  {pipelineByStage.length === 0 ? (
                    <EmptyChart message="No open deals in pipeline" />
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={pipelineByStage}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis label={{ value: 'Value ($K)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip
                          formatter={(value, name) => {
                            if (name === 'value') return [`$${(Number(value) || 0).toFixed(0)}K`, 'Deal value']
                            return [value, 'Deals']
                          }}
                          contentStyle={chartTooltipStyle}
                        />
                        <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} name="value" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'renewal_calendar') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <CardTitle className="text-base">Renewal calendar</CardTitle>
                  <CardDescription>Upcoming contract renewals and outreach status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {kycSummary ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border bg-amber-500/5 p-4 text-center">
                          <Calendar className="mx-auto mb-2 h-5 w-5 text-amber-600" />
                          <p className="text-2xl font-bold tabular-nums">{kycSummary.renewals_within_30d}</p>
                          <p className="text-xs text-muted-foreground">Renewals ≤30 days</p>
                        </div>
                        <div className="rounded-xl border bg-blue-500/5 p-4 text-center">
                          <Calendar className="mx-auto mb-2 h-5 w-5 text-blue-600" />
                          <p className="text-2xl font-bold tabular-nums">{kycSummary.renewals_within_90d}</p>
                          <p className="text-xs text-muted-foreground">Renewals ≤90 days</p>
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-medium">Outreach pipeline</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(kycSummary.outreach_by_status).map(([key, count]) => (
                            <span
                              key={key}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                                OUTREACH_CHIP_COLORS[key] ?? 'bg-muted text-muted-foreground',
                              )}
                            >
                              {KYC_CLIENT_OUTREACH_LABELS[key] ?? key}
                              <span className="font-bold tabular-nums">{count}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <EmptyChart message="Portfolio intelligence loading…" />
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'csm_performance') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <CardTitle className="text-base">CSM performance</CardTitle>
                  <CardDescription>Workload and portfolio health by team member</CardDescription>
                </CardHeader>
                <CardContent>
                  {csmUsers.length === 0 ? (
                    <EmptyChart message="Add team members to track CSM performance" />
                  ) : (
                    <div className="space-y-3">
                      {csmUsers.map((csm) => {
                        const csmClients = clients.filter((c) => c.csm_id === csm.id)
                        const csmTasks = tasks.filter((t) => t.assigned_to === csm.id)
                        const avgHealth =
                          csmClients.length > 0
                            ? Math.round(csmClients.reduce((sum, c) => sum + c.health_score, 0) / csmClients.length)
                            : 0
                        const csmArr = csmClients.reduce((sum, c) => sum + c.arr, 0)

                        return (
                          <div key={csm.id} className="rounded-lg border p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                {csm.avatar && (
                                  <img src={csm.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full" />
                                )}
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{csm.name}</p>
                                  <p className="truncate text-xs text-muted-foreground">{csm.email}</p>
                                </div>
                              </div>
                              <Badge variant="outline" className="shrink-0 tabular-nums">
                                {csmClients.length} accounts
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <p className="text-muted-foreground">Avg health</p>
                                <p className="font-semibold tabular-nums">{avgHealth}%</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Open tasks</p>
                                <p className="font-semibold tabular-nums">{csmTasks.length}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">ARR</p>
                                <p className="font-semibold tabular-nums">${(csmArr / 1000).toFixed(0)}K</p>
                              </div>
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

          if (widgetId === 'milestone_progress') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <CardTitle className="text-base">Milestone progress</CardTitle>
                  <CardDescription>Customer success milestone tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  {milestones.length === 0 ? (
                    <EmptyChart message="No milestones tracked yet" />
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 text-center">
                          <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-green-600" />
                          <p className="text-xl font-bold tabular-nums">
                            {milestones.filter((m) => m.status === 'completed').length}
                          </p>
                          <p className="text-xs text-muted-foreground">Completed</p>
                        </div>
                        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-center">
                          <Activity className="mx-auto mb-1 h-5 w-5 text-blue-600" />
                          <p className="text-xl font-bold tabular-nums">
                            {milestones.filter((m) => m.status === 'in-progress').length}
                          </p>
                          <p className="text-xs text-muted-foreground">In progress</p>
                        </div>
                        <div className="rounded-xl border p-3 text-center">
                          <Clock className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
                          <p className="text-xl font-bold tabular-nums">
                            {milestones.filter((m) => m.status === 'upcoming').length}
                          </p>
                          <p className="text-xs text-muted-foreground">Upcoming</p>
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-medium">Completion rate</span>
                          <span className="font-bold tabular-nums">
                            {Math.round(
                              (milestones.filter((m) => m.status === 'completed').length / milestones.length) * 100,
                            )}
                            %
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-green-500 transition-all"
                            style={{
                              width: `${(milestones.filter((m) => m.status === 'completed').length / milestones.length) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-muted/60 p-3 text-sm">
                        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                        <span>
                          <span className="font-medium">
                            {
                              milestones.filter((m) => {
                                const target = new Date(m.target_date)
                                const thirtyDays = new Date()
                                thirtyDays.setDate(thirtyDays.getDate() + 30)
                                return target <= thirtyDays && target >= new Date() && m.status !== 'completed'
                              }).length
                            }
                          </span>
                          <span className="text-muted-foreground"> milestones due in the next 30 days</span>
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'top_actions') {
            return accountRows.length > 0 ? (
              <div className="h-full overflow-auto">
                <KycPortfolioTopActions rows={accountRows} onOpenClient={onOpenClient} limit={5} />
              </div>
            ) : (
              <EmptyChart message="No priority accounts yet" />
            )
          }

          if (widgetId === 'top_accounts') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <CardTitle className="text-base">Top accounts by attention</CardTitle>
                  <CardDescription>Highest-priority accounts in your portfolio</CardDescription>
                </CardHeader>
                <CardContent>
                  {topAccounts.length === 0 ? (
                    <EmptyChart message="No priority accounts yet" />
                  ) : (
                    <div className="space-y-2">
                      {topAccounts.map((row, index) => (
                        <button
                          key={row.client_id}
                          type="button"
                          onClick={() => onOpenClient?.(row.client_id)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{row.client_name}</p>
                              <p className="truncate text-xs text-muted-foreground">{row.industry}</p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold tabular-nums">${(row.arr / 1000).toFixed(0)}K</p>
                            <span
                              className={cn(
                                'mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize',
                                clientStatusBadgeClass(row.status),
                              )}
                            >
                              {row.status.replace('-', ' ')}
                            </span>
                          </div>
                        </button>
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

const chartTooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center text-center text-muted-foreground">
      <BarChart3 className="mb-2 h-8 w-8 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
