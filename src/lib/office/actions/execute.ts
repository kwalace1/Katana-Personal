/**
 * Agent Office Phase 2.1 — client-side execution of an approved action.
 *
 * When the user approves an action card, the browser executes the action itself
 * by calling the org-stamping `ai_act_*` RPC through the app's Supabase client —
 * i.e. AS THE SIGNED-IN USER, with a fresh JWT and RLS enforced. The RPC does the
 * one mutation, re-checks the caller's org on every row, and writes the audit
 * row. Then we POST the decision to the engine so the paused agent resumes and
 * confirms in chat.
 *
 * Why the client executes (not the engine): the RPCs are `security invoker`, so
 * they need a live user JWT. Executing here uses the same authenticated Supabase
 * client the rest of the Katana data layer uses — no stale/stored token, and the
 * write can never escape the acting user's tenant.
 */
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/office/app/api-client'
import { safeStorageGet, safeStorageSet } from '@/lib/office/app/safe-storage'
import type { KatanaActionProposal } from './proposals'

export interface ActionExecContext {
  /** Acting agent id/name and chat session id — recorded on the audit row. */
  agentId?: string | null
  agentName?: string | null
  sessionId?: string | null
}

export type ActionExecResult =
  | { ok: true; result: Record<string, unknown> }
  | { ok: false; error: string }

type ArgMapper = (args: Record<string, unknown>) => Record<string, unknown>

/**
 * The only actions the client will execute, each pinned to its RPC and an
 * explicit camelCase-arg → `p_*`-param mapping. Keyed by the proposal's action
 * key so a malformed or injected `execution.rpc` string is never used to pick
 * the function — the client decides which door to open.
 */
const ACTION_EXECUTORS: Record<string, { rpc: string; mapArgs: ArgMapper }> = {
  'pm.create_task': {
    rpc: 'ai_act_pm_create_task',
    mapArgs: (a) => ({
      p_project_id: a.projectId,
      p_title: a.title,
      p_deadline: a.deadline,
      p_description: a.description ?? null,
      p_status: a.status ?? 'todo',
      p_priority: a.priority ?? 'medium',
      p_assignee_employee_id: a.assigneeEmployeeId ?? null,
    }),
  },
  'pm.set_task_status': {
    rpc: 'ai_act_pm_set_task_status',
    mapArgs: (a) => ({ p_task_id: a.taskId, p_status: a.status }),
  },
  'pm.assign_task': {
    rpc: 'ai_act_pm_assign_task',
    mapArgs: (a) => ({ p_task_id: a.taskId, p_employee_id: a.employeeId }),
  },
  'pm.add_subtask': {
    rpc: 'ai_act_pm_add_subtask',
    mapArgs: (a) => ({ p_task_id: a.taskId, p_title: a.title }),
  },
  'support.set_status': {
    rpc: 'ai_act_support_set_status',
    mapArgs: (a) => ({ p_submission_id: a.submissionId, p_status: a.status }),
  },
  'support.set_priority': {
    rpc: 'ai_act_support_set_priority',
    mapArgs: (a) => ({ p_submission_id: a.submissionId, p_priority: a.priority }),
  },
  'support.add_note': {
    rpc: 'ai_act_support_add_note',
    mapArgs: (a) => ({ p_submission_id: a.submissionId, p_note: a.note }),
  },
  'inventory.set_po_status': {
    rpc: 'ai_act_inventory_set_po_status',
    mapArgs: (a) => ({ p_po_id: a.poId, p_status: a.status }),
  },
  'inventory.set_supplier_active': {
    rpc: 'ai_act_inventory_set_supplier_active',
    mapArgs: (a) => ({ p_supplier_id: a.supplierId, p_active: a.active }),
  },
  'inventory.set_allocation_status': {
    rpc: 'ai_act_inventory_set_allocation_status',
    mapArgs: (a) => ({ p_allocation_id: a.allocationId, p_status: a.status }),
  },
  // Wave 2 — uniform { id, status } proposals; each maps id → its p_*_id param.
  'hr.set_time_off_status': { rpc: 'ai_act_hr_set_time_off_status', mapArgs: (a) => ({ p_time_off_id: a.id, p_status: a.status }) },
  'hr.set_goal_status': { rpc: 'ai_act_hr_set_goal_status', mapArgs: (a) => ({ p_goal_id: a.id, p_status: a.status }) },
  'hr.set_employee_status': { rpc: 'ai_act_hr_set_employee_status', mapArgs: (a) => ({ p_employee_id: a.id, p_status: a.status }) },
  'customer.set_task_status': { rpc: 'ai_act_customer_set_task_status', mapArgs: (a) => ({ p_task_id: a.id, p_status: a.status }) },
  'customer.set_milestone_status': { rpc: 'ai_act_customer_set_milestone_status', mapArgs: (a) => ({ p_milestone_id: a.id, p_status: a.status }) },
  'customer.set_client_status': { rpc: 'ai_act_customer_set_client_status', mapArgs: (a) => ({ p_client_id: a.id, p_status: a.status }) },
  'careers.set_application_status': { rpc: 'ai_act_careers_set_application_status', mapArgs: (a) => ({ p_application_id: a.id, p_status: a.status }) },
  'wfm.set_job_status': { rpc: 'ai_act_wfm_set_job_status', mapArgs: (a) => ({ p_job_id: a.id, p_status: a.status }) },
  'wfm.set_timesheet_status': { rpc: 'ai_act_wfm_set_timesheet_status', mapArgs: (a) => ({ p_timesheet_id: a.id, p_status: a.status }) },
  'wfm.set_technician_status': { rpc: 'ai_act_wfm_set_technician_status', mapArgs: (a) => ({ p_technician_id: a.id, p_status: a.status }) },
  'kyi.set_investor_outreach': { rpc: 'ai_act_kyi_set_investor_outreach', mapArgs: (a) => ({ p_investor_id: a.id, p_status: a.status }) },
}

/** True when this proposal is an approvable/executable Level-1 action. */
export function isExecutableAction(proposal: KatanaActionProposal): boolean {
  return proposal.execution.level >= 1
    && typeof proposal.approvalId === 'string'
    && proposal.action in ACTION_EXECUTORS
}

/**
 * Pure mapping from a proposal (+ context) to the RPC name and its named params.
 * Returns null for an unknown action. Exported for unit testing.
 */
export function buildRpcParams(
  proposal: KatanaActionProposal,
  ctx: ActionExecContext,
): { rpc: string; params: Record<string, unknown> } | null {
  const executor = ACTION_EXECUTORS[proposal.action]
  if (!executor) return null
  return {
    rpc: executor.rpc,
    params: {
      ...executor.mapArgs(proposal.args || {}),
      p_agent_id: ctx.agentId ?? null,
      p_agent_name: ctx.agentName ?? null,
      p_session_id: ctx.sessionId ?? null,
      p_request_id: proposal.requestId,
      p_approval_id: proposal.approvalId ?? null,
      p_autonomy_level: 1,
    },
  }
}

/** Execute the approved action as the signed-in user. Never throws — returns a result. */
export async function executeActionProposal(
  proposal: KatanaActionProposal,
  ctx: ActionExecContext,
): Promise<ActionExecResult> {
  const mapped = buildRpcParams(proposal, ctx)
  if (!mapped) return { ok: false, error: `Unsupported action: ${proposal.action}` }
  try {
    const { data, error } = await supabase.rpc(mapped.rpc, mapped.params)
    if (error) return { ok: false, error: error.message || 'The action could not be applied.' }
    // The RPCs return a jsonb envelope: { ok: boolean, ... } — a caught DB error
    // surfaces as { ok: false, error } (and still writes a 'failed' audit row).
    const row = (data ?? null) as { ok?: boolean; error?: string } | null
    if (row && row.ok === false) return { ok: false, error: row.error || 'The action failed.' }
    return { ok: true, result: (row as Record<string, unknown>) ?? {} }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Tell the engine the user's decision so the paused agent resumes and confirms.
 * Best-effort: the write has already happened by the time we call this on
 * approve, so a failure here only means the agent won't post its confirmation.
 */
export async function postApprovalDecision(approvalId: string, approved: boolean): Promise<void> {
  await api('POST', '/approvals', { id: approvalId, approved })
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'unknown'

/** Look up an approval's status by id (any status). 'unknown' if it can't be read. */
export async function getApprovalStatus(approvalId: string): Promise<ApprovalStatus> {
  try {
    const res = await api<{ status?: string }>('GET', `/approvals?id=${encodeURIComponent(approvalId)}`, undefined, { retries: 0 })
    const s = res?.status
    return s === 'pending' || s === 'approved' || s === 'rejected' ? s : 'unknown'
  } catch {
    return 'unknown'
  }
}

// --- local idempotency guard -------------------------------------------------
// A decided action must never re-execute after a reload. The engine is the
// source of truth (getApprovalStatus), but a local marker gives an instant,
// offline-safe guard for the common same-browser reload case.

const RESOLVED_PREFIX = 'katana_action_resolved:'

export type LocalActionOutcome = 'executed' | 'denied'

export function markActionResolved(approvalId: string, outcome: LocalActionOutcome): void {
  safeStorageSet(RESOLVED_PREFIX + approvalId, outcome)
}

/** The remembered outcome for a decided action, or null if not decided in this browser. */
export function getLocalActionOutcome(approvalId: string): LocalActionOutcome | null {
  const v = safeStorageGet(RESOLVED_PREFIX + approvalId)
  return v === 'executed' || v === 'denied' ? v : null
}
