/**
 * CRM workflow automation — runs actions when pipeline events occur
 */
import { getOrganizationId } from './auth-helpers'
import { supabase } from './supabase'
import type { CrmDeal, CrmLead } from './customer-crm-api'
import { createTask, createMilestone } from './customer-success-api'
import { resolveKycActionIdFromWorkflowTitle } from './kyc-workflow-map'
import { syncClientOutreachStatus, outreachStatusFromLifecycle } from './kyc-outreach-sync'
import {
  notifyCrmDealLost,
  notifyCrmDealWon,
} from './cs-integration-notifications'

export type WorkflowTrigger = 'deal_won' | 'deal_lost' | 'lead_created' | 'lead_converted'

export interface WorkflowAction {
  type: 'create_task' | 'create_milestone' | 'update_lifecycle' | 'create_work_order'
  title?: string
  due_days?: number
  lifecycle_stage?: 'prospect' | 'customer'
  kyc_action_id?: string
}

export interface CrmWorkflowRule {
  id: string
  organization_id: string
  name: string
  trigger_event: WorkflowTrigger
  enabled: boolean
  actions: WorkflowAction[]
}

const DEFAULT_DEAL_WON_ACTIONS: WorkflowAction[] = [
  { type: 'update_lifecycle', lifecycle_stage: 'customer' },
  { type: 'create_work_order', title: 'Kickoff work order', due_days: 7 },
  { type: 'create_task', title: 'Send welcome / kickoff email', due_days: 1, kyc_action_id: 'check-in' },
  { type: 'create_task', title: 'Schedule onboarding call', due_days: 3, kyc_action_id: 'check-in' },
  { type: 'create_milestone', title: 'Onboarding complete', due_days: 14 },
]

const DEFAULT_LEAD_CONVERTED_ACTIONS: WorkflowAction[] = [
  { type: 'create_task', title: 'Schedule check-in', due_days: 3, kyc_action_id: 'check-in' },
]

export async function getWorkflowRules(trigger: WorkflowTrigger): Promise<CrmWorkflowRule[]> {
  try {
    const orgId = await getOrganizationId()
    const { data, error } = await supabase
      .from('cs_crm_workflows')
      .select('*')
      .eq('organization_id', orgId)
      .eq('trigger_event', trigger)
      .eq('enabled', true)
    if (error || !data?.length) return []
    return data.map((row) => ({
      ...row,
      actions: Array.isArray(row.actions) ? (row.actions as WorkflowAction[]) : [],
    })) as CrmWorkflowRule[]
  } catch {
    return []
  }
}

async function ensureDefaultDealWonWorkflow(): Promise<WorkflowAction[]> {
  const rules = await getWorkflowRules('deal_won')
  if (rules.length > 0) {
    return rules.flatMap((r) => r.actions)
  }
  return DEFAULT_DEAL_WON_ACTIONS
}

async function ensureLeadConvertedWorkflow(): Promise<WorkflowAction[]> {
  const rules = await getWorkflowRules('lead_converted')
  if (rules.length > 0) {
    return rules.flatMap((r) => r.actions)
  }
  return DEFAULT_LEAD_CONVERTED_ACTIONS
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

async function runWorkflowActions(
  clientId: string,
  actions: WorkflowAction[],
  context: { assignedTo?: string | null; dealTitle?: string },
): Promise<void> {
  for (const action of actions) {
    if (action.type === 'update_lifecycle' && action.lifecycle_stage) {
      await supabase
        .from('cs_clients')
        .update({ lifecycle_stage: action.lifecycle_stage })
        .eq('id', clientId)
      const outreach = outreachStatusFromLifecycle(action.lifecycle_stage)
      if (outreach) await syncClientOutreachStatus(clientId, outreach)
    }
    if (action.type === 'create_task' && action.title) {
      const kycActionId =
        action.kyc_action_id ?? resolveKycActionIdFromWorkflowTitle(action.title)
      await createTask({
        client_id: clientId,
        title: action.title,
        status: 'active',
        due_date: addDays(action.due_days ?? 7),
        priority: 'high',
        assigned_to: context.assignedTo ?? null,
        kyc_action_id: kycActionId,
      })
    }
    if (action.type === 'create_milestone' && action.title) {
      await createMilestone({
        client_id: clientId,
        title: action.title,
        description: context.dealTitle
          ? `Auto-created when deal "${context.dealTitle}" was won`
          : 'Auto-created by CRM workflow',
        status: 'upcoming',
        target_date: addDays(action.due_days ?? 30),
      })
    }
    if (action.type === 'create_work_order') {
      const { createWorkOrderFromClient } = await import('./wfm-integrations')
      const title =
        action.title ??
        (context.dealTitle ? `Deliver: ${context.dealTitle}` : 'New work order')
      await createWorkOrderFromClient({
        clientId,
        title,
        description: context.dealTitle
          ? `Auto-created when deal "${context.dealTitle}" was won`
          : 'Auto-created by CRM workflow',
        endDate: addDays(action.due_days ?? 14),
      })
    }
  }
}

export async function runDealWonWorkflow(deal: CrmDeal): Promise<void> {
  if (!deal.client_id) return
  const actions = await ensureDefaultDealWonWorkflow()
  await runWorkflowActions(deal.client_id, actions, {
    assignedTo: deal.assigned_to,
    dealTitle: deal.title,
  })
  await createInteractionForDeal(deal, 'won')
  void notifyCrmDealWon({ deal })
}

export async function runDealLostWorkflow(deal: CrmDeal): Promise<void> {
  await createInteractionForDeal(deal, 'lost')
  void notifyCrmDealLost({ deal })
}

export async function runLeadConvertedWorkflow(options: {
  clientId: string
  lead: CrmLead
}): Promise<void> {
  const actions = await ensureLeadConvertedWorkflow()
  await runWorkflowActions(options.clientId, actions, {
    assignedTo: options.lead.assigned_to,
  })
}

async function createInteractionForDeal(deal: CrmDeal, outcome: 'won' | 'lost'): Promise<void> {
  if (!deal.client_id) return

  const { createInteraction } = await import('./customer-success-api')
  await createInteraction({
    client_id: deal.client_id,
    type: 'note',
    subject: outcome === 'won' ? `Deal won: ${deal.title}` : `Deal lost: ${deal.title}`,
    description:
      outcome === 'won'
        ? `Pipeline automation logged a won deal for $${deal.amount.toLocaleString()}.`
        : `Deal marked lost${deal.lost_reason ? `: ${deal.lost_reason}` : '.'}`,
    csm_id: deal.assigned_to,
    interaction_date: new Date().toISOString(),
  })
}

export async function seedDefaultWorkflowsIfEmpty(): Promise<void> {
  try {
    const orgId = await getOrganizationId()
    const { count } = await supabase
      .from('cs_crm_workflows')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
    if ((count ?? 0) > 0) return

    await supabase.from('cs_crm_workflows').insert([
      {
        organization_id: orgId,
        name: 'Deal won onboarding',
        trigger_event: 'deal_won',
        enabled: true,
        actions: DEFAULT_DEAL_WON_ACTIONS,
      },
      {
        organization_id: orgId,
        name: 'Lead converted follow-up',
        trigger_event: 'lead_converted',
        enabled: true,
        actions: DEFAULT_LEAD_CONVERTED_ACTIONS,
      },
    ])
  } catch {
    // non-blocking
  }
}
