import type { FeedActivity } from '@/components/shared/recent-activity-feed'
import type {
  Activity,
  Employee,
  Goal,
  LearningPath,
  Mentorship,
  PerformanceReview,
  Recognition,
} from './hr-api'
import type { JobApplication } from './recruitment-db'
import type { Client, ClientInteraction, ClientMilestone, ClientTask } from './customer-success-api'
import type { CrmDeal, CrmLead } from './customer-crm-api'
import { customerSuccessClientPath, customerSuccessTabPath } from './cs-deep-links'
import type {
  InventoryMovement,
  InventoryTransaction,
  PurchaseOrder,
} from './inventory-api'
import type { Job, Technician, Timesheet } from './wfm-api'
import type { SupportSubmission, SupportSubmissionActivity } from './support-api'
import {
  buildHrDashboardActivities,
  formatRelativeTime,
  mergeHrDashboardActivities,
} from './hr-dashboard-activity'

export type HubProjectActivity = {
  id: string
  project_id: string
  type: string
  description: string
  user: string
  created_at: string
}

export type HubKyiCompanyActivity = {
  id: number
  name: string
  created_at: string
  updated_at?: string | null
}

export type HubActivityInput = {
  hrActivities: Activity[]
  projectActivities: HubProjectActivity[]
  employees: Employee[]
  reviews: PerformanceReview[]
  goals: Goal[]
  applications: JobApplication[]
  recognitions: Recognition[]
  learningPaths: LearningPath[]
  mentorships: Mentorship[]
  csClients: Client[]
  csInteractions: ClientInteraction[]
  csTasks: ClientTask[]
  csMilestones?: ClientMilestone[]
  csDeals?: CrmDeal[]
  csLeads?: CrmLead[]
  wfmJobs: Job[]
  wfmTechnicians: Technician[]
  wfmTimesheets: Timesheet[]
  inventoryMovements: InventoryMovement[]
  inventoryTransactions: InventoryTransaction[]
  purchaseOrders: PurchaseOrder[]
  supportSubmissions: SupportSubmission[]
  supportActivity: SupportSubmissionActivity[]
  kyiCompanies: HubKyiCompanyActivity[]
}

function parseTime(value: string | null | undefined): number {
  if (!value) return 0
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function toFeedActivity(item: {
  type: FeedActivity['type']
  module: string
  message: string
  sortAt: number
  href?: string
}): FeedActivity {
  return {
    type: item.type,
    module: item.module,
    message: item.message,
    sortAt: item.sortAt,
    href: item.href,
    time: formatRelativeTime(new Date(item.sortAt).toISOString()),
  }
}

function mergeAndLimit(items: FeedActivity[], limit: number): FeedActivity[] {
  const seen = new Set<string>()
  return items
    .filter((item) => {
      const key = `${item.module}|${item.message}|${item.sortAt}`
      if (seen.has(key)) return false
      seen.add(key)
      return item.sortAt > 0
    })
    .sort((a, b) => b.sortAt - a.sortAt)
    .slice(0, limit)
}

function buildCustomerSuccessActivities(
  clients: Client[],
  interactions: ClientInteraction[],
  tasks: ClientTask[],
  milestones: ClientMilestone[] = [],
  deals: CrmDeal[] = [],
  leads: CrmLead[] = [],
): FeedActivity[] {
  const items: FeedActivity[] = []

  for (const interaction of interactions) {
    const sortAt = parseTime(interaction.interaction_date || interaction.created_at)
    if (!sortAt) continue
    const clientName = interaction.client?.name ?? 'Client'
    items.push(
      toFeedActivity({
        type: 'info',
        module: 'Customers',
        message: `${capitalize(interaction.type)} logged for ${clientName}: ${interaction.subject}`,
        sortAt,
        href: customerSuccessClientPath(interaction.client_id, 'interactions'),
      }),
    )
  }

  for (const task of tasks) {
    const clientName = task.client?.name ?? 'Client'
    const completed = task.status === 'completed'
    const sortAt = parseTime(completed ? task.updated_at : task.created_at)
    if (!sortAt) continue
    const kycSuffix = task.kyc_action_id ? ' (KYC action)' : ''
    items.push(
      toFeedActivity({
        type: completed ? 'success' : 'info',
        module: 'Customers',
        message: completed
          ? `Task completed for ${clientName}: ${task.title}${kycSuffix}`
          : `Task created for ${clientName}: ${task.title}${kycSuffix}`,
        sortAt,
        href: customerSuccessClientPath(task.client_id, 'tasks'),
      }),
    )
  }

  for (const milestone of milestones) {
    const sortAt = parseTime(milestone.completed_date || milestone.target_date || milestone.created_at)
    if (!sortAt) continue
    const clientName = milestone.client?.name ?? 'Client'
    items.push(
      toFeedActivity({
        type: milestone.status === 'completed' ? 'success' : 'info',
        module: 'Customers',
        message: `Milestone ${milestone.status}: ${milestone.title} (${clientName})`,
        sortAt,
        href: customerSuccessClientPath(milestone.client_id, 'milestones'),
      }),
    )
  }

  for (const deal of deals) {
    const sortAt = parseTime(deal.updated_at || deal.created_at)
    if (!sortAt) continue
    const clientId = deal.client_id
    if (deal.status === 'won') {
      items.push(
        toFeedActivity({
          type: 'success',
          module: 'Customers',
          message: `Deal won: ${deal.title} ($${deal.amount.toLocaleString()})`,
          sortAt,
          href: clientId ? customerSuccessClientPath(clientId, 'pipeline') : customerSuccessTabPath('pipeline'),
        }),
      )
    } else if (deal.status === 'lost') {
      items.push(
        toFeedActivity({
          type: 'warning',
          module: 'Customers',
          message: `Deal lost: ${deal.title}`,
          sortAt,
          href: clientId ? customerSuccessClientPath(clientId, 'pipeline') : customerSuccessTabPath('pipeline'),
        }),
      )
    }
  }

  for (const lead of leads) {
    const sortAt = parseTime(lead.created_at)
    if (!sortAt) continue
    if (lead.status === 'converted' && lead.converted_client_id) {
      items.push(
        toFeedActivity({
          type: 'success',
          module: 'Customers',
          message: `Lead converted to customer account`,
          sortAt: parseTime(lead.updated_at) || sortAt,
          href: customerSuccessClientPath(lead.converted_client_id),
        }),
      )
    } else {
      const name = lead.company_name || `${lead.first_name} ${lead.last_name}`.trim() || 'Lead'
      items.push(
        toFeedActivity({
          type: 'info',
          module: 'Customers',
          message: `New lead: ${name}`,
          sortAt,
          href: customerSuccessTabPath('leads'),
        }),
      )
    }
  }

  for (const client of clients) {
    const createdAt = parseTime(client.created_at)
    if (createdAt) {
      items.push(
        toFeedActivity({
          type: 'success',
          module: 'Customers',
          message: `New client added: ${client.name}`,
          sortAt: createdAt,
          href: customerSuccessClientPath(client.id),
        }),
      )
    }

    const updatedAt = parseTime(client.updated_at)
    if (updatedAt && updatedAt > createdAt + 60_000) {
      items.push(
        toFeedActivity({
          type: 'info',
          module: 'Customers',
          message: `Client updated: ${client.name}`,
          sortAt: updatedAt,
        }),
      )
    }
  }

  return items
}

function buildWfmActivities(jobs: Job[], technicians: Technician[], timesheets: Timesheet[]): FeedActivity[] {
  const items: FeedActivity[] = []
  const technicianNameById = new Map(technicians.map((tech) => [tech.id, tech.name]))

  for (const job of jobs) {
    const sortAt = parseTime(job.updated_at)
    if (!sortAt) continue
    const jobLabel = job.job_number || job.title || job.id
    const techName =
      job.technician?.name ??
      (job.technician_id ? technicianNameById.get(job.technician_id) : undefined) ??
      'Unassigned'

    let message = `Job ${jobLabel} updated`
    let type: FeedActivity['type'] = 'info'
    if (job.status === 'completed') {
      message = `Job ${jobLabel} completed by ${techName}`
      type = 'success'
    } else if (job.status === 'in-progress') {
      message = `${techName} started job ${jobLabel}`
    } else if (job.status === 'assigned') {
      message = `Job ${jobLabel} assigned to ${techName}`
    } else if (job.status === 'on-hold') {
      message = `Job ${jobLabel} put on hold`
      type = 'warning'
    } else if (job.status === 'cancelled') {
      message = `Job ${jobLabel} cancelled`
      type = 'warning'
    }

    items.push(toFeedActivity({ type, module: 'WFM', message, sortAt }))
  }

  for (const timesheet of timesheets) {
    const sortAt = parseTime(timesheet.clock_out || timesheet.clock_in)
    if (!sortAt) continue
    const techName = timesheet.technician?.name ?? technicianNameById.get(timesheet.technician_id) ?? 'Technician'
    const jobLabel = timesheet.job?.job_number ?? timesheet.job?.title
    const jobSuffix = jobLabel ? ` on job ${jobLabel}` : ''
    const message = timesheet.clock_out
      ? `${techName} clocked out${jobSuffix}`
      : `${techName} clocked in${jobSuffix}`

    items.push(
      toFeedActivity({
        type: timesheet.status === 'approved' ? 'success' : 'info',
        module: 'WFM',
        message,
        sortAt,
      }),
    )
  }

  return items
}

function buildInventoryActivities(
  movements: InventoryMovement[],
  transactions: InventoryTransaction[],
  purchaseOrders: PurchaseOrder[],
): FeedActivity[] {
  const items: FeedActivity[] = []

  for (const movement of movements) {
    const sortAt = parseTime(movement.movement_date || movement.created_at)
    if (!sortAt) continue
    const sign = movement.change_qty > 0 ? '+' : ''
    items.push(
      toFeedActivity({
        type: movement.change_qty < 0 ? 'warning' : 'info',
        module: 'Inventory',
        message: `Stock ${sign}${movement.change_qty}: ${movement.reason}${movement.reference ? ` (${movement.reference})` : ''}`,
        sortAt,
      }),
    )
  }

  for (const transaction of transactions) {
    const sortAt = parseTime(transaction.transaction_date || transaction.created_at)
    if (!sortAt) continue
    const action = transaction.type === 'scan-in' ? 'Scan in' : 'Check out'
    items.push(
      toFeedActivity({
        type: 'info',
        module: 'Inventory',
        message: `${action}: ${transaction.quantity} × ${transaction.product_name}`,
        sortAt,
      }),
    )
  }

  for (const po of purchaseOrders) {
    const sortAt = parseTime(po.updated_at || po.created_at)
    if (!sortAt) continue
    const statusLabel = po.status.replace('-', ' ')
    items.push(
      toFeedActivity({
        type: po.status === 'received' ? 'success' : po.status === 'cancelled' ? 'warning' : 'info',
        module: 'Inventory',
        message: `PO ${po.po_number} ${statusLabel} (${po.supplier_name})`,
        sortAt,
      }),
    )
  }

  return items
}

function buildSupportActivities(
  submissions: SupportSubmission[],
  activity: SupportSubmissionActivity[],
): FeedActivity[] {
  const items: FeedActivity[] = []
  const submissionSubjectById = new Map(submissions.map((s) => [s.id, s.subject]))

  for (const submission of submissions) {
    const sortAt = parseTime(submission.created_at)
    if (!sortAt) continue
    const kind = submission.submission_type === 'issue' ? 'Issue' : 'Feedback'
    items.push(
      toFeedActivity({
        type: 'info',
        module: 'Support',
        message: `${kind} submitted: ${submission.subject}`,
        sortAt,
      }),
    )

    const updatedAt = parseTime(submission.updated_at)
    if (updatedAt && updatedAt > sortAt + 60_000) {
      items.push(
        toFeedActivity({
          type: submission.status === 'resolved' || submission.status === 'closed' ? 'success' : 'info',
          module: 'Support',
          message: `Support ticket updated: ${submission.subject} (${submission.status.replace('_', ' ')})`,
          sortAt: updatedAt,
        }),
      )
    }
  }

  for (const entry of activity) {
    const sortAt = parseTime(entry.created_at)
    if (!sortAt) continue
    const subject = submissionSubjectById.get(entry.submission_id) ?? 'Support ticket'
    let message = `Support ticket updated: ${subject}`

    if (entry.action_type === 'status_changed' && entry.to_status) {
      message = `Support status changed for ${subject}: ${entry.from_status ?? 'unknown'} → ${entry.to_status}`
    } else if (entry.action_type === 'priority_changed' && entry.to_priority) {
      message = `Support priority changed for ${subject}: ${entry.from_priority ?? 'unknown'} → ${entry.to_priority}`
    } else if (entry.action_type === 'notes_updated') {
      message = `Support notes updated for ${subject}`
    }

    items.push(
      toFeedActivity({
        type: entry.to_status === 'resolved' || entry.to_status === 'closed' ? 'success' : 'info',
        module: 'Support',
        message,
        sortAt,
      }),
    )
  }

  return items
}

function buildKyiActivities(companies: HubKyiCompanyActivity[]): FeedActivity[] {
  const items: FeedActivity[] = []

  for (const company of companies) {
    const createdAt = parseTime(company.created_at)
    if (createdAt) {
      items.push(
        toFeedActivity({
          type: 'success',
          module: 'KYI',
          message: `Company added to KYI: ${company.name}`,
          sortAt: createdAt,
        }),
      )
    }

    const updatedAt = parseTime(company.updated_at)
    if (updatedAt && updatedAt > createdAt + 60_000) {
      items.push(
        toFeedActivity({
          type: 'info',
          module: 'KYI',
          message: `KYI company updated: ${company.name}`,
          sortAt: updatedAt,
        }),
      )
    }
  }

  return items
}

/** Build unified hub activity feed from logged events and module data. */
export function buildHubActivityFeed(input: HubActivityInput, limit = 100): FeedActivity[] {
  const synthesized = buildHrDashboardActivities({
    employees: input.employees,
    reviews: input.reviews,
    goals: input.goals,
    applications: input.applications,
    recognitions: input.recognitions,
    learningPaths: input.learningPaths,
    mentorships: input.mentorships,
  })
  const hrItems = mergeHrDashboardActivities(input.hrActivities, synthesized, limit * 2).map((item) =>
    toFeedActivity({
      type: item.variant,
      module: item.category === 'Recruitment' ? 'Recruitment' : 'HR',
      message: item.message,
      sortAt: item.sortAt,
    }),
  )

  const pmItems = input.projectActivities
    .map((activity) => {
      const sortAt = parseTime(activity.created_at)
      if (!sortAt) return null
      return toFeedActivity({
        type: 'info',
        module: 'PM',
        message: activity.description,
        sortAt,
      })
    })
    .filter((item): item is FeedActivity => item !== null)

  return mergeAndLimit(
    [
      ...hrItems,
      ...pmItems,
      ...buildCustomerSuccessActivities(
        input.csClients,
        input.csInteractions,
        input.csTasks,
        input.csMilestones ?? [],
        input.csDeals ?? [],
        input.csLeads ?? [],
      ),
      ...buildWfmActivities(input.wfmJobs, input.wfmTechnicians, input.wfmTimesheets),
      ...buildInventoryActivities(
        input.inventoryMovements,
        input.inventoryTransactions,
        input.purchaseOrders,
      ),
      ...buildSupportActivities(input.supportSubmissions, input.supportActivity),
      ...buildKyiActivities(input.kyiCompanies),
    ],
    limit,
  )
}
