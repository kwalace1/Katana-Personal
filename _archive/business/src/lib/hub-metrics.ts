import type { ComponentType } from 'react'
import {
  FolderKanban,
  Package,
  Users,
  Briefcase,
  UserCheck,
  CheckCircle2,
  BarChart3,
  Bot,
  LifeBuoy,
  LineChart,
  Landmark,
} from 'lucide-react'
import type { ModuleId } from '@/lib/module-access'
import type { Project } from '@/lib/project-data'
import type { Job, Technician, Timesheet } from '@/lib/wfm-api'
import type { PurchaseOrder } from '@/lib/inventory-api'
import type { SupportSubmission } from '@/lib/support-api'
import type { HubKyiCompanyActivity } from '@/lib/hub-activity'
import type { FinDashboardSummary } from '@/lib/finance-types'

export interface HubProjectMetrics {
  completionRate: number
  overdueTasks: number
  totalTasks: number
  completedTasks: number
}

export interface HubCsMetrics {
  avgHealthScore: number
  atRiskClients: number
  upcomingRenewals: number
  avgNPS: number
}

export interface HubHrMetrics {
  activeEmployees: number
  reviewsDue: number
  openPositions: number
  newApplications: number
  avgPerformance: number
}

export interface HubInventoryMetrics {
  totalItems: number
  lowStockItems: number
  outOfStockItems: number
  openPurchaseOrders: number
}

export interface HubWfmMetrics {
  activeJobs: number
  pendingTimesheets: number
  activeTechnicians: number
  unassignedJobs: number
  overdueJobs: number
}

export interface HubSupportMetrics {
  open: number
  inProgress: number
  total: number
}

export interface HubDashboardMetricInput {
  projects: Project[]
  projectMetrics: HubProjectMetrics
  csClients: Array<{ status?: string | null }>
  csMetrics: HubCsMetrics
  hrMetrics: HubHrMetrics
  goals: Array<{ status?: string | null }>
  jobApplications: Array<{ status?: string | null; applied_date?: string }>
  purchaseOrders: PurchaseOrder[]
  supportSubmissions: SupportSubmission[]
  kyiCompanies: HubKyiCompanyActivity[]
  inventoryMetrics: HubInventoryMetrics
  wfmMetrics: HubWfmMetrics
  financeSummary?: FinDashboardSummary | null
}

export interface HubKpiDefinition {
  moduleId: ModuleId
  title: string
  value: string
  trend: string
  trendUp: boolean
  icon: ComponentType<{ className?: string }>
  color: string
}

export interface HubPerformanceMetric {
  moduleId: ModuleId
  label: string
  value: string
  detail?: string
}

export interface HubPerformanceProgress {
  moduleId: ModuleId
  label: string
  value: number
  displayValue: string
}

export interface HubMetricsBundle {
  kpis: HubKpiDefinition[]
  performanceMetrics: HubPerformanceMetric[]
  performanceProgress: HubPerformanceProgress[]
  previewMetrics: HubPerformanceMetric[]
}

export function filterHubMetricsByModules<T extends { moduleId: ModuleId }>(
  items: T[],
  allowedModules: ModuleId[]
): T[] {
  return items.filter((item) => allowedModules.includes(item.moduleId))
}

function openGoalsCount(goals: HubDashboardMetricInput['goals']): number {
  return goals.filter((g) => {
    const s = (g.status ?? '').toLowerCase()
    return s !== 'completed' && s !== 'complete' && s !== 'done' && s !== 'archived'
  }).length
}

function reviewingApplicationsCount(
  applications: HubDashboardMetricInput['jobApplications']
): number {
  return applications.filter((a) => a.status === 'reviewing').length
}

function computeWfmMetrics(
  jobs: Job[],
  technicians: Technician[],
  timesheets: Timesheet[]
): HubWfmMetrics {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return {
    activeJobs: jobs.filter((j) => j.status === 'assigned' || j.status === 'in-progress').length,
    pendingTimesheets: timesheets.filter((t) => t.status === 'pending').length,
    activeTechnicians: technicians.filter((t) => t.status === 'active').length,
    unassignedJobs: jobs.filter(
      (j) =>
        !j.technician_id &&
        j.status !== 'completed' &&
        j.status !== 'cancelled',
    ).length,
    overdueJobs: jobs.filter((j) => {
      if (j.status === 'completed' || j.status === 'cancelled') return false
      if (!j.end_date) return false
      const end = new Date(j.end_date)
      end.setHours(0, 0, 0, 0)
      return end < now
    }).length,
  }
}

function computeInventoryMetrics(
  stats: Omit<HubInventoryMetrics, 'openPurchaseOrders'>,
  purchaseOrders: PurchaseOrder[]
): HubInventoryMetrics {
  const openPurchaseOrders = purchaseOrders.filter((po) => {
    const status = (po.status ?? '').toLowerCase()
    return status === 'open' || status === 'pending'
  }).length
  return { ...stats, openPurchaseOrders }
}

function computeSupportMetrics(submissions: SupportSubmission[]): HubSupportMetrics {
  return {
    total: submissions.length,
    open: submissions.filter((s) => s.status === 'open').length,
    inProgress: submissions.filter((s) => s.status === 'in_progress').length,
  }
}

export function deriveHubWfmMetrics(
  jobs: Job[],
  technicians: Technician[],
  timesheets: Timesheet[]
): HubWfmMetrics {
  return computeWfmMetrics(jobs, technicians, timesheets)
}

export function deriveHubInventoryMetrics(
  stats: Omit<HubInventoryMetrics, 'openPurchaseOrders'>,
  purchaseOrders: PurchaseOrder[]
): HubInventoryMetrics {
  return computeInventoryMetrics(stats, purchaseOrders)
}

export function deriveHubSupportMetrics(submissions: SupportSubmission[]): HubSupportMetrics {
  return computeSupportMetrics(submissions)
}

export function buildHubMetricsBundle(
  input: HubDashboardMetricInput,
  allowedModules: ModuleId[]
): HubMetricsBundle {
  const activeProjects = input.projects.filter((p) => p.status === 'active').length
  const openTasks = Math.max(0, input.projectMetrics.totalTasks - input.projectMetrics.completedTasks)
  const healthyCs = input.csClients.filter((c) => c.status !== 'at-risk').length
  const openGoals = openGoalsCount(input.goals)
  const reviewingApps = reviewingApplicationsCount(input.jobApplications)
  const supportMetrics = computeSupportMetrics(input.supportSubmissions)

  const allKpis: HubKpiDefinition[] = [
    {
      moduleId: 'projects',
      title: 'Active Projects',
      value: String(activeProjects),
      trend: `${input.projectMetrics.completionRate}% tasks done`,
      trendUp: input.projectMetrics.completionRate >= 40,
      icon: FolderKanban,
      color: 'text-blue-500',
    },
    {
      moduleId: 'projects',
      title: 'Open Tasks',
      value: String(openTasks),
      trend: input.projectMetrics.overdueTasks
        ? `${input.projectMetrics.overdueTasks} overdue`
        : 'No overdue',
      trendUp: input.projectMetrics.overdueTasks === 0,
      icon: CheckCircle2,
      color: 'text-green-500',
    },
    {
      moduleId: 'customer-success',
      title: 'Healthy clients',
      value: String(healthyCs),
      trend: input.csMetrics.atRiskClients
        ? `${input.csMetrics.atRiskClients} at risk`
        : 'None at risk',
      trendUp: input.csMetrics.atRiskClients === 0,
      icon: Users,
      color: 'text-purple-500',
    },
    {
      moduleId: 'customer-success',
      title: 'Renewals (60d)',
      value: String(input.csMetrics.upcomingRenewals),
      trend: input.csClients.length ? `${input.csClients.length} total clients` : 'No clients yet',
      trendUp: input.csMetrics.upcomingRenewals > 0,
      icon: Users,
      color: 'text-violet-500',
    },
    {
      moduleId: 'hr',
      title: 'Active employees',
      value: String(input.hrMetrics.activeEmployees),
      trend: `${input.hrMetrics.reviewsDue} reviews due (30d)`,
      trendUp: input.hrMetrics.reviewsDue === 0,
      icon: UserCheck,
      color: 'text-orange-500',
    },
    {
      moduleId: 'hr',
      title: 'Open HR goals',
      value: String(openGoals),
      trend: `${input.goals.length} total goals`,
      trendUp: openGoals <= Math.ceil(input.goals.length * 0.7),
      icon: BarChart3,
      color: 'text-emerald-500',
    },
    {
      moduleId: 'careers',
      title: 'Applications (7d)',
      value: String(input.hrMetrics.newApplications),
      trend: `${reviewingApps} in review · ${input.jobApplications.length} total`,
      trendUp: input.hrMetrics.newApplications > 0,
      icon: Briefcase,
      color: 'text-amber-500',
    },
    {
      moduleId: 'inventory',
      title: 'Inventory SKUs',
      value: String(input.inventoryMetrics.totalItems),
      trend: input.inventoryMetrics.lowStockItems
        ? `${input.inventoryMetrics.lowStockItems} low stock`
        : 'Stock levels OK',
      trendUp: input.inventoryMetrics.lowStockItems === 0,
      icon: Package,
      color: 'text-emerald-500',
    },
    {
      moduleId: 'inventory',
      title: 'Open POs',
      value: String(input.inventoryMetrics.openPurchaseOrders),
      trend: input.inventoryMetrics.outOfStockItems
        ? `${input.inventoryMetrics.outOfStockItems} out of stock`
        : 'No stock-outs',
      trendUp: input.inventoryMetrics.outOfStockItems === 0,
      icon: Package,
      color: 'text-teal-500',
    },
    {
      moduleId: 'workforce',
      title: 'Active work',
      value: String(input.wfmMetrics.activeJobs),
      trend: input.wfmMetrics.unassignedJobs
        ? `${input.wfmMetrics.unassignedJobs} unassigned`
        : `${input.wfmMetrics.activeTechnicians} team members`,
      trendUp: input.wfmMetrics.unassignedJobs === 0,
      icon: Briefcase,
      color: 'text-orange-500',
    },
    {
      moduleId: 'workforce',
      title: 'Pending time entries',
      value: String(input.wfmMetrics.pendingTimesheets),
      trend: input.wfmMetrics.overdueJobs
        ? `${input.wfmMetrics.overdueJobs} overdue`
        : input.wfmMetrics.pendingTimesheets
          ? 'Needs approval'
          : 'All caught up',
      trendUp: input.wfmMetrics.pendingTimesheets === 0 && input.wfmMetrics.overdueJobs === 0,
      icon: CheckCircle2,
      color: 'text-blue-500',
    },
    {
      moduleId: 'support',
      title: 'Open support items',
      value: String(supportMetrics.open + supportMetrics.inProgress),
      trend: `${supportMetrics.open} open · ${supportMetrics.inProgress} in progress`,
      trendUp: supportMetrics.open + supportMetrics.inProgress === 0,
      icon: LifeBuoy,
      color: 'text-rose-500',
    },
    {
      moduleId: 'kyi',
      title: 'KYI companies',
      value: String(input.kyiCompanies.length),
      trend: input.kyiCompanies.length ? 'Investor pipeline' : 'Add companies in KYI',
      trendUp: input.kyiCompanies.length > 0,
      icon: LineChart,
      color: 'text-teal-500',
    },
    {
      moduleId: 'automation',
      title: 'Automation',
      value: 'Ready',
      trend: 'Knowledge and tools for agents',
      trendUp: true,
      icon: Bot,
      color: 'text-indigo-500',
    },
    {
      moduleId: 'finance',
      title: 'Uncategorized txns',
      value: String(input.financeSummary?.uncategorizedCount ?? 0),
      trend: input.financeSummary?.setupComplete
        ? input.financeSummary.uncategorizedCount
          ? 'Needs review in Finance'
          : 'All categorized'
        : 'Complete Finance setup',
      trendUp: (input.financeSummary?.uncategorizedCount ?? 0) === 0,
      icon: Landmark,
      color: 'text-emerald-600',
    },
    {
      moduleId: 'finance',
      title: 'Net income (YTD)',
      value: input.financeSummary?.setupComplete
        ? `$${Math.round(input.financeSummary.netIncomeYtd).toLocaleString()}`
        : '—',
      trend: input.financeSummary?.setupComplete
        ? `$${Math.round(input.financeSummary.inflowThisMonth).toLocaleString()} inflow this month`
        : 'Open Finance to configure',
      trendUp: (input.financeSummary?.netIncomeYtd ?? 0) >= 0,
      icon: Landmark,
      color: 'text-green-600',
    },
  ]

  const allPerformance: HubPerformanceMetric[] = [
    {
      moduleId: 'projects',
      label: 'Active projects',
      value: String(activeProjects),
      detail: `${openTasks} open tasks · ${input.projectMetrics.overdueTasks} overdue`,
    },
    {
      moduleId: 'projects',
      label: 'Task completion',
      value:
        input.projectMetrics.totalTasks > 0
          ? `${Math.round((input.projectMetrics.completedTasks / input.projectMetrics.totalTasks) * 100)}%`
          : '—',
      detail:
        input.projectMetrics.totalTasks > 0
          ? `${input.projectMetrics.completedTasks} of ${input.projectMetrics.totalTasks} tasks`
          : 'No PM tasks yet',
    },
    {
      moduleId: 'customer-success',
      label: 'Client health (avg)',
      value: input.csClients.length === 0 ? '—' : `${input.csMetrics.avgHealthScore}%`,
      detail:
        input.csClients.length === 0
          ? 'No CS clients loaded'
          : input.csMetrics.atRiskClients === 0
            ? 'No accounts flagged at-risk'
            : `${input.csMetrics.atRiskClients} at-risk · NPS avg ${input.csMetrics.avgNPS}`,
    },
    {
      moduleId: 'hr',
      label: 'Avg performance',
      value: input.hrMetrics.avgPerformance > 0 ? `${input.hrMetrics.avgPerformance.toFixed(1)}/5` : '—',
      detail: `${input.hrMetrics.reviewsDue} reviews due in 30 days`,
    },
    {
      moduleId: 'hr',
      label: 'Active headcount',
      value: String(input.hrMetrics.activeEmployees),
      detail: `${input.hrMetrics.openPositions} open positions`,
    },
    {
      moduleId: 'careers',
      label: 'New applications (7d)',
      value: String(input.hrMetrics.newApplications),
      detail: `${reviewingApps} in review · ${input.jobApplications.length} total`,
    },
    {
      moduleId: 'inventory',
      label: 'Low stock SKUs',
      value: String(input.inventoryMetrics.lowStockItems),
      detail: `${input.inventoryMetrics.openPurchaseOrders} open POs · ${input.inventoryMetrics.outOfStockItems} out of stock`,
    },
    {
      moduleId: 'workforce',
      label: 'Active field jobs',
      value: String(input.wfmMetrics.activeJobs),
      detail: `${input.wfmMetrics.pendingTimesheets} pending timesheets`,
    },
    {
      moduleId: 'support',
      label: 'Support queue',
      value: String(supportMetrics.open + supportMetrics.inProgress),
      detail: `${supportMetrics.open} open · ${supportMetrics.inProgress} in progress`,
    },
    {
      moduleId: 'kyi',
      label: 'Companies tracked',
      value: String(input.kyiCompanies.length),
      detail: input.kyiCompanies.length ? 'KYI investor pipeline' : 'Add companies in KYI',
    },
    {
      moduleId: 'finance',
      label: 'Bank reconciliation',
      value: input.financeSummary?.setupComplete
        ? String(input.financeSummary.openReconciliationCount)
        : '—',
      detail: input.financeSummary?.setupComplete
        ? `${input.financeSummary.uncategorizedCount} uncategorized · ${input.financeSummary.financialAccountCount} accounts`
        : 'Finance module not configured',
    },
  ]

  const allProgress: HubPerformanceProgress[] = [
    {
      moduleId: 'projects',
      label: 'Task completion (PM)',
      value: input.projectMetrics.completionRate,
      displayValue: input.projectMetrics.totalTasks > 0 ? `${input.projectMetrics.completionRate}%` : '—',
    },
    {
      moduleId: 'customer-success',
      label: 'Client health (CS)',
      value: input.csMetrics.avgHealthScore,
      displayValue: input.csClients.length === 0 ? '—' : `${input.csMetrics.avgHealthScore}%`,
    },
    {
      moduleId: 'hr',
      label: 'Team performance (HR)',
      value: input.hrMetrics.avgPerformance > 0 ? (input.hrMetrics.avgPerformance / 5) * 100 : 0,
      displayValue:
        input.hrMetrics.avgPerformance > 0 ? `${input.hrMetrics.avgPerformance.toFixed(1)}/5` : '—',
    },
  ]

  const kpis = filterHubMetricsByModules(allKpis, allowedModules)
  const performanceMetrics = filterHubMetricsByModules(allPerformance, allowedModules)
  const performanceProgress = filterHubMetricsByModules(allProgress, allowedModules)

  return {
    kpis,
    performanceMetrics,
    performanceProgress,
    previewMetrics: performanceMetrics.slice(0, 2),
  }
}
