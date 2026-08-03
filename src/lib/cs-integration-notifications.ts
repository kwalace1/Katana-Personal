/**
 * KYC intelligence, CRM commerce, and campaign notifications with client deep links.
 */

import type { Client, ClientTask } from '@/lib/customer-success-api'
import type { CrmDeal, CrmInvoice, CrmLead } from '@/lib/customer-crm-api'
import { customerSuccessClientPath, customerSuccessTabPath } from '@/lib/cs-deep-links'
import {
  notifyUsers,
  resolveUserIdFromCsmId,
  resolveModuleStakeholderUserIds,
} from '@/lib/notification-recipients'

async function resolveClientCsmOrStakeholderUserIds(
  client: Pick<Client, 'csm_id'> | null | undefined,
): Promise<string[]> {
  const csm = client?.csm_id ? await resolveUserIdFromCsmId(client.csm_id) : null
  if (csm) return [csm]
  return resolveModuleStakeholderUserIds('customer_success')
}

async function resolveCustomerSuccessStakeholderUserIds(): Promise<string[]> {
  return resolveModuleStakeholderUserIds('customer_success')
}

export async function notifyKycAttentionRequired(options: {
  client: Client
  attentionScore: number
  primaryActionLabel?: string | null
}): Promise<void> {
  const recipients = await resolveClientCsmOrStakeholderUserIds(options.client)
  if (!recipients.length) return

  const body = options.primaryActionLabel
    ? `${options.client.name} needs attention (score ${options.attentionScore}). Suggested: ${options.primaryActionLabel}.`
    : `${options.client.name} needs attention (score ${options.attentionScore}).`

  await notifyUsers({
    recipientUserIds: recipients,
    sourceModule: 'kyc',
    notificationType: 'kyc_attention_required',
    title: 'Account needs attention',
    body,
    linkPath: customerSuccessClientPath(options.client.id),
    dedupeKey: `kyc:client:${options.client.id}:attention:${options.attentionScore}`,
    metadata: {
      client_id: options.client.id,
      attention_score: options.attentionScore,
    },
  })
}

export async function notifyKycActionTaskCompleted(options: {
  client: Client
  task: Pick<ClientTask, 'id' | 'title' | 'kyc_action_id'>
}): Promise<void> {
  const recipients = await resolveClientCsmOrStakeholderUserIds(options.client)
  if (!recipients.length) return

  await notifyUsers({
    recipientUserIds: recipients,
    sourceModule: 'kyc',
    notificationType: 'kyc_action_completed',
    title: 'Intelligence action completed',
    body: `"${options.task.title}" for ${options.client.name} — risk signals updated.`,
    linkPath: customerSuccessClientPath(options.client.id),
    dedupeKey: `kyc:task:${options.task.id}:completed`,
    metadata: {
      client_id: options.client.id,
      task_id: options.task.id,
      kyc_action_id: options.task.kyc_action_id,
    },
  })
}

export async function notifyCrmDealWon(options: { deal: CrmDeal; clientName?: string }): Promise<void> {
  if (!options.deal.client_id) return
  const recipients = await resolveCustomerSuccessStakeholderUserIds()
  if (!recipients.length) return

  const name = options.clientName ?? 'Customer'
  await notifyUsers({
    recipientUserIds: recipients,
    sourceModule: 'customer_success',
    notificationType: 'cs_deal_won',
    title: 'Deal won',
    body: `${options.deal.title} for ${name} — $${options.deal.amount.toLocaleString()}.`,
    linkPath: customerSuccessClientPath(options.deal.client_id, 'pipeline'),
    dedupeKey: `cs:deal:${options.deal.id}:won`,
    metadata: { deal_id: options.deal.id, client_id: options.deal.client_id },
    includeActor: true,
  })
}

export async function notifyCrmDealLost(options: { deal: CrmDeal; clientName?: string }): Promise<void> {
  if (!options.deal.client_id) return
  const recipients = await resolveCustomerSuccessStakeholderUserIds()
  if (!recipients.length) return

  const name = options.clientName ?? 'Customer'
  await notifyUsers({
    recipientUserIds: recipients,
    sourceModule: 'customer_success',
    notificationType: 'cs_deal_lost',
    title: 'Deal lost',
    body: `${options.deal.title} for ${name}${options.deal.lost_reason ? ` — ${options.deal.lost_reason}` : '.'}`,
    linkPath: customerSuccessClientPath(options.deal.client_id, 'pipeline'),
    dedupeKey: `cs:deal:${options.deal.id}:lost`,
    metadata: { deal_id: options.deal.id, client_id: options.deal.client_id },
    includeActor: true,
  })
}

export async function notifyCrmInvoiceOverdue(options: {
  invoice: CrmInvoice
  clientName: string
}): Promise<void> {
  if (!options.invoice.client_id) return
  const recipients = await resolveCustomerSuccessStakeholderUserIds()
  if (!recipients.length) return

  await notifyUsers({
    recipientUserIds: recipients,
    sourceModule: 'customer_success',
    notificationType: 'cs_invoice_overdue',
    title: 'Invoice overdue',
    body: `Invoice ${options.invoice.invoice_number} for ${options.clientName} is overdue.`,
    linkPath: customerSuccessClientPath(options.invoice.client_id, 'commerce'),
    dedupeKey: `cs:invoice:${options.invoice.id}:overdue`,
    metadata: { invoice_id: options.invoice.id, client_id: options.invoice.client_id },
  })
}

export async function notifyCrmLeadCreated(options: { lead: CrmLead }): Promise<void> {
  const recipients = await resolveCustomerSuccessStakeholderUserIds()
  if (!recipients.length) return

  const name =
    options.lead.company_name ||
    `${options.lead.first_name} ${options.lead.last_name}`.trim() ||
    'New lead'

  await notifyUsers({
    recipientUserIds: recipients,
    sourceModule: 'customer_success',
    notificationType: 'cs_lead_created',
    title: 'New lead captured',
    body: `${name}${options.lead.campaign_id ? ' (campaign attributed)' : ''}.`,
    linkPath: customerSuccessTabPath('leads'),
    dedupeKey: `cs:lead:${options.lead.id}:created`,
    metadata: { lead_id: options.lead.id, campaign_id: options.lead.campaign_id },
    includeActor: true,
  })
}

export async function notifyCrmLeadConverted(options: {
  lead: CrmLead
  clientId: string
  clientName: string
}): Promise<void> {
  const recipients = await resolveCustomerSuccessStakeholderUserIds()
  if (!recipients.length) return

  await notifyUsers({
    recipientUserIds: recipients,
    sourceModule: 'customer_success',
    notificationType: 'cs_lead_converted',
    title: 'Lead converted to customer',
    body: `${options.clientName} is now a customer account.`,
    linkPath: customerSuccessClientPath(options.clientId),
    dedupeKey: `cs:lead:${options.lead.id}:converted:${options.clientId}`,
    metadata: { lead_id: options.lead.id, client_id: options.clientId },
    includeActor: true,
  })
}

export async function notifyCrmCampaignLead(options: {
  campaignName: string
  leadCount: number
}): Promise<void> {
  const recipients = await resolveCustomerSuccessStakeholderUserIds()
  if (!recipients.length || options.leadCount <= 0) return

  await notifyUsers({
    recipientUserIds: recipients,
    sourceModule: 'customer_success',
    notificationType: 'cs_campaign_leads',
    title: 'Campaign leads received',
    body: `${options.leadCount} new lead${options.leadCount === 1 ? '' : 's'} for "${options.campaignName}".`,
    linkPath: customerSuccessTabPath('campaigns'),
    dedupeKey: `cs:campaign:leads:${options.campaignName}:${new Date().toISOString().slice(0, 10)}`,
    metadata: { lead_count: options.leadCount },
  })
}
