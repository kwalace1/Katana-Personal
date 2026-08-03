/**
 * Know Your Customer — unified account activity timeline.
 * Merges interactions, tasks, milestones, commerce, and account events into one feed.
 */

import type {
  Client,
  ClientInteraction,
  ClientMilestone,
  ClientTask,
  HealthHistory,
} from './customer-success-api'

export type KycTimelineFilter = 'all' | 'meetings' | 'notes' | 'renewals' | 'portal' | 'support'

export type KycTimelineFilterGroup = KycTimelineFilter | 'other'

export interface KycTimelineEvent {
  id: string
  category: 'interaction' | 'task' | 'milestone' | 'renewal' | 'contract' | 'deal' | 'invoice' | 'quote' | 'health' | 'account'
  type: string
  title: string
  description?: string
  occurred_at: string
  filter_group: KycTimelineFilterGroup
}

export interface KycTimelineContractRow {
  id: string
  title: string
  status: string
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
}

export interface KycTimelineDealRow {
  id: string
  title: string
  status: string
  expected_close_date: string | null
  created_at: string
  updated_at: string
}

export interface KycTimelineInvoiceRow {
  id: string
  invoice_number: string
  status: string
  due_date: string | null
  paid_date: string | null
  created_at: string
}

export interface KycTimelineSupportTicketRow {
  id: string
  subject: string
  status: string
  opened_at: string
  closed_at: string | null
}

export interface KycTimelineUsageSnapshotRow {
  id: string
  portal_logins: number
  engagement_score: number
  feature_usage: string
  support_tickets: number
  recorded_at: string
}

export interface KycTimelineQuoteRow {
  id: string
  quote_number: string
  status: string
  created_at: string
  updated_at: string
}

export interface KycTimelineInput {
  interactions: ClientInteraction[]
  tasks: ClientTask[]
  milestones: ClientMilestone[]
  contracts: KycTimelineContractRow[]
  deals: KycTimelineDealRow[]
  invoices: KycTimelineInvoiceRow[]
  quotes?: KycTimelineQuoteRow[]
  healthHistory: HealthHistory[]
  supportTickets?: KycTimelineSupportTicketRow[]
  usageSnapshots?: KycTimelineUsageSnapshotRow[]
  client: Pick<
    Client,
    'id' | 'renewal_date' | 'created_at' | 'last_contact_date' | 'name' | 'portal_logins' | 'support_tickets' | 'feature_usage'
  >
}

const INTERACTION_FILTER: Record<ClientInteraction['type'], KycTimelineFilterGroup> = {
  meeting: 'meetings',
  call: 'meetings',
  email: 'notes',
  note: 'notes',
}

function isValidDate(value: string | null | undefined): value is string {
  if (!value) return false
  return !isNaN(new Date(value).getTime())
}

function pushEvent(events: KycTimelineEvent[], event: Omit<KycTimelineEvent, 'id'> & { id: string }) {
  if (!isValidDate(event.occurred_at)) return
  events.push(event)
}

export function buildClientTimeline(input: KycTimelineInput): KycTimelineEvent[] {
  const events: KycTimelineEvent[] = []

  for (const item of input.interactions) {
    pushEvent(events, {
      id: `interaction-${item.id}`,
      category: 'interaction',
      type: item.type,
      title: item.subject || `${item.type} logged`,
      description: item.description || undefined,
      occurred_at: item.interaction_date,
      filter_group: INTERACTION_FILTER[item.type],
    })
  }

  for (const task of input.tasks) {
    pushEvent(events, {
      id: `task-created-${task.id}`,
      category: 'task',
      type: 'task-created',
      title: `Task created: ${task.title}`,
      description: `Status: ${task.status} · Priority: ${task.priority}`,
      occurred_at: task.created_at,
      filter_group: 'other',
    })

    if (task.status === 'completed') {
      pushEvent(events, {
        id: `task-completed-${task.id}`,
        category: 'task',
        type: 'task-completed',
        title: `Task completed: ${task.title}`,
        occurred_at: task.updated_at || task.due_date,
        filter_group: 'other',
      })
    } else if (isValidDate(task.due_date)) {
      pushEvent(events, {
        id: `task-due-${task.id}`,
        category: 'task',
        type: 'task-due',
        title: `Task due: ${task.title}`,
        description: `Status: ${task.status}`,
        occurred_at: task.due_date,
        filter_group: 'other',
      })
    }
  }

  for (const milestone of input.milestones) {
    const renewalLike = /renewal|contract|go-live|kickoff/i.test(milestone.title)
    const group: KycTimelineFilterGroup = renewalLike ? 'renewals' : 'other'

    pushEvent(events, {
      id: `milestone-target-${milestone.id}`,
      category: 'milestone',
      type: `milestone-${milestone.status}`,
      title: milestone.title,
      description: milestone.description || `Target: ${milestone.status}`,
      occurred_at: milestone.target_date,
      filter_group: group,
    })

    if (isValidDate(milestone.completed_date)) {
      pushEvent(events, {
        id: `milestone-completed-${milestone.id}`,
        category: 'milestone',
        type: 'milestone-completed',
        title: `Milestone completed: ${milestone.title}`,
        occurred_at: milestone.completed_date!,
        filter_group: group,
      })
    }
  }

  for (const contract of input.contracts) {
    pushEvent(events, {
      id: `contract-created-${contract.id}`,
      category: 'contract',
      type: 'contract-created',
      title: `Contract added: ${contract.title}`,
      description: `Status: ${contract.status}`,
      occurred_at: contract.created_at,
      filter_group: 'renewals',
    })

    if (isValidDate(contract.start_date)) {
      pushEvent(events, {
        id: `contract-start-${contract.id}`,
        category: 'contract',
        type: 'contract-start',
        title: `Contract started: ${contract.title}`,
        occurred_at: contract.start_date!,
        filter_group: 'renewals',
      })
    }

    if (isValidDate(contract.end_date)) {
      pushEvent(events, {
        id: `contract-end-${contract.id}`,
        category: 'contract',
        type: 'contract-end',
        title: `Contract ends: ${contract.title}`,
        description: `Status: ${contract.status}`,
        occurred_at: contract.end_date!,
        filter_group: 'renewals',
      })
    }
  }

  for (const deal of input.deals) {
    pushEvent(events, {
      id: `deal-created-${deal.id}`,
      category: 'deal',
      type: 'deal-created',
      title: `Deal opened: ${deal.title}`,
      description: `Status: ${deal.status}`,
      occurred_at: deal.created_at,
      filter_group: 'renewals',
    })

    if (isValidDate(deal.expected_close_date)) {
      pushEvent(events, {
        id: `deal-close-${deal.id}`,
        category: 'deal',
        type: 'deal-expected-close',
        title: `Expected close: ${deal.title}`,
        occurred_at: deal.expected_close_date!,
        filter_group: 'renewals',
      })
    }

    if (deal.status !== 'open' && isValidDate(deal.updated_at) && deal.updated_at !== deal.created_at) {
      pushEvent(events, {
        id: `deal-status-${deal.id}`,
        category: 'deal',
        type: `deal-${deal.status}`,
        title: `Deal ${deal.status}: ${deal.title}`,
        occurred_at: deal.updated_at,
        filter_group: 'renewals',
      })
    }
  }

  for (const quote of input.quotes ?? []) {
    pushEvent(events, {
      id: `quote-created-${quote.id}`,
      category: 'quote',
      type: 'quote-created',
      title: `Quote ${quote.quote_number}`,
      description: `Status: ${quote.status}`,
      occurred_at: quote.created_at,
      filter_group: 'renewals',
    })

    if (quote.status !== 'draft' && isValidDate(quote.updated_at) && quote.updated_at !== quote.created_at) {
      pushEvent(events, {
        id: `quote-status-${quote.id}`,
        category: 'quote',
        type: `quote-${quote.status}`,
        title: `Quote ${quote.status}: ${quote.quote_number}`,
        occurred_at: quote.updated_at,
        filter_group: 'renewals',
      })
    }
  }

  for (const invoice of input.invoices) {
    pushEvent(events, {
      id: `invoice-created-${invoice.id}`,
      category: 'invoice',
      type: 'invoice-created',
      title: `Invoice ${invoice.invoice_number}`,
      description: `Status: ${invoice.status}`,
      occurred_at: invoice.created_at,
      filter_group: 'renewals',
    })

    if (isValidDate(invoice.due_date)) {
      pushEvent(events, {
        id: `invoice-due-${invoice.id}`,
        category: 'invoice',
        type: 'invoice-due',
        title: `Invoice due: ${invoice.invoice_number}`,
        occurred_at: invoice.due_date!,
        filter_group: 'renewals',
      })
    }

    if (isValidDate(invoice.paid_date)) {
      pushEvent(events, {
        id: `invoice-paid-${invoice.id}`,
        category: 'invoice',
        type: 'invoice-paid',
        title: `Invoice paid: ${invoice.invoice_number}`,
        occurred_at: invoice.paid_date!,
        filter_group: 'renewals',
      })
    }
  }

  for (const row of input.healthHistory) {
    pushEvent(events, {
      id: `health-${row.id}`,
      category: 'health',
      type: 'health-snapshot',
      title: `Health score recorded: ${row.health_score}`,
      occurred_at: row.recorded_at,
      filter_group: 'other',
    })
  }

  for (const ticket of input.supportTickets ?? []) {
    pushEvent(events, {
      id: `support-open-${ticket.id}`,
      category: 'account',
      type: 'support-open',
      title: `Support ticket opened: ${ticket.subject}`,
      description: `Status: ${ticket.status}`,
      occurred_at: ticket.opened_at,
      filter_group: 'support',
    })
    if (isValidDate(ticket.closed_at)) {
      pushEvent(events, {
        id: `support-close-${ticket.id}`,
        category: 'account',
        type: 'support-resolved',
        title: `Support ticket resolved: ${ticket.subject}`,
        occurred_at: ticket.closed_at!,
        filter_group: 'support',
      })
    }
  }

  for (const snap of input.usageSnapshots ?? []) {
    pushEvent(events, {
      id: `usage-snapshot-${snap.id}`,
      category: 'account',
      type: 'portal-usage-snapshot',
      title: `Portal usage snapshot: ${snap.portal_logins} logins`,
      description: `Engagement ${snap.engagement_score} · Feature usage ${snap.feature_usage} · ${snap.support_tickets} support tickets`,
      occurred_at: snap.recorded_at,
      filter_group: 'portal',
    })
  }

  if ((input.client.portal_logins ?? 0) > 0) {
    pushEvent(events, {
      id: `portal-current-${input.client.id}`,
      category: 'account',
      type: 'portal-usage-current',
      title: `Current portal logins: ${input.client.portal_logins}`,
      description: `Feature usage: ${input.client.feature_usage ?? 'unknown'}`,
      occurred_at: input.client.created_at,
      filter_group: 'portal',
    })
  }

  if ((input.client.support_tickets ?? 0) > 0) {
    pushEvent(events, {
      id: `support-count-${input.client.id}`,
      category: 'account',
      type: 'support-ticket-count',
      title: `Support tickets on record: ${input.client.support_tickets}`,
      occurred_at: input.client.created_at,
      filter_group: 'support',
    })
  }

  if (isValidDate(input.client.renewal_date)) {
    pushEvent(events, {
      id: `renewal-${input.client.id}`,
      category: 'renewal',
      type: 'renewal-date',
      title: 'Renewal date',
      description: `Account renewal scheduled for ${input.client.name}`,
      occurred_at: input.client.renewal_date,
      filter_group: 'renewals',
    })
  }

  if (isValidDate(input.client.last_contact_date)) {
    pushEvent(events, {
      id: `last-contact-${input.client.id}`,
      category: 'account',
      type: 'last-contact',
      title: 'Last contact logged',
      occurred_at: input.client.last_contact_date,
      filter_group: 'meetings',
    })
  }

  if (isValidDate(input.client.created_at)) {
    pushEvent(events, {
      id: `account-created-${input.client.id}`,
      category: 'account',
      type: 'account-created',
      title: 'Account created',
      occurred_at: input.client.created_at,
      filter_group: 'other',
    })
  }

  const seen = new Set<string>()
  return events
    .filter((event) => {
      if (seen.has(event.id)) return false
      seen.add(event.id)
      return true
    })
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
}

export function filterTimelineEvents(
  events: KycTimelineEvent[],
  filter: KycTimelineFilter,
): KycTimelineEvent[] {
  if (filter === 'all') return events
  return events.filter((event) => event.filter_group === filter)
}
