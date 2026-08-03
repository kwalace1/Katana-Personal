/**
 * Agent Office Phase 2 — action proposals (propose-only, Level 0).
 *
 * The engine's pm_* action tools never write; they return a structured
 * `katana_action_proposal` JSON as the tool result. Tool events still stream
 * to the client (they're just not rendered as raw tool cards), so the chat UI
 * lifts proposals out of tool outputs and renders them as inline cards.
 */

export interface KatanaActionProposal {
  type: 'katana_action_proposal'
  requestId: string
  /** Namespaced action key, e.g. 'pm.create_task' */
  action: string
  /** One-sentence human description produced after live-data validation. */
  summary: string
  args: Record<string, unknown>
  resolved: Record<string, unknown>
  execution: { level: number; executed: boolean; rpc: string }
  /**
   * Present when the engine registered a durable approval (Level 1+). The card
   * uses it to execute the org-stamped RPC on Approve and to post the decision
   * back to the engine so the paused agent resumes and confirms.
   */
  approvalId?: string
  note?: string
}

/** Minimal structural shape shared by MessageToolEvent and the store's ToolEvent. */
interface ToolEventLike {
  name?: string
  output?: string
}

const ACTION_LABELS: Record<string, string> = {
  'pm.create_task': 'Create task',
  'pm.set_task_status': 'Change task status',
  'pm.assign_task': 'Assign task',
  'pm.add_subtask': 'Add subtask',
  'support.set_status': 'Change ticket status',
  'support.set_priority': 'Change ticket priority',
  'support.add_note': 'Add ticket note',
  'inventory.set_po_status': 'Change PO status',
  'inventory.set_supplier_active': 'Set supplier active',
  'inventory.set_allocation_status': 'Change allocation status',
  'hr.set_time_off_status': 'Time-off decision',
  'hr.set_goal_status': 'Change goal status',
  'hr.set_employee_status': 'Change employee status',
  'customer.set_task_status': 'Change CS task status',
  'customer.set_milestone_status': 'Change milestone status',
  'customer.set_client_status': 'Change client status',
  'careers.set_application_status': 'Change application status',
  'wfm.set_job_status': 'Change job status',
  'wfm.set_timesheet_status': 'Timesheet decision',
  'wfm.set_technician_status': 'Change technician status',
  'kyi.set_investor_outreach': 'Change investor outreach',
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] || action
}

function isProposal(value: unknown): value is KatanaActionProposal {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    v.type === 'katana_action_proposal'
    && typeof v.requestId === 'string'
    && typeof v.action === 'string'
    && typeof v.summary === 'string'
  )
}

/** Extract action proposals from a message's tool events (dedup by requestId). */
export function extractActionProposals(events?: ToolEventLike[] | null): KatanaActionProposal[] {
  if (!events?.length) return []
  const seen = new Set<string>()
  const proposals: KatanaActionProposal[] = []
  for (const event of events) {
    const output = event?.output
    if (typeof output !== 'string' || !output.includes('katana_action_proposal')) continue
    try {
      const parsed: unknown = JSON.parse(output)
      if (isProposal(parsed) && !seen.has(parsed.requestId)) {
        seen.add(parsed.requestId)
        proposals.push(parsed)
      }
    } catch {
      // Not JSON — some other tool's output. Ignore.
    }
  }
  return proposals
}

function str(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

/** Flatten a proposal into label/value display rows for the card. */
export function proposalFields(p: KatanaActionProposal): Array<{ label: string; value: string }> {
  const fields: Array<{ label: string; value: string }> = []
  const add = (label: string, value: string) => {
    if (value) fields.push({ label, value })
  }
  const args = rec(p.args)
  const project = rec(rec(p.resolved).project)
  const task = rec(rec(p.resolved).task)
  const assignee = rec(rec(p.resolved).assignee)
  const submission = rec(rec(p.resolved).submission)
  const po = rec(rec(p.resolved).purchase_order)
  const supplier = rec(rec(p.resolved).supplier)
  const allocation = rec(rec(p.resolved).allocation)

  switch (p.action) {
    case 'pm.create_task':
      add('Project', str(project.name))
      add('Title', str(args.title))
      add('Due', str(args.deadline))
      add('Status', str(args.status))
      add('Priority', str(args.priority))
      add('Assignee', str(assignee.name))
      add('Description', str(args.description).slice(0, 140))
      break
    case 'pm.set_task_status':
      add('Task', str(task.title))
      add('Project', str(task.project_name))
      add('Change', `${str(task.status)} → ${str(args.status)}`)
      break
    case 'pm.assign_task':
      add('Task', str(task.title))
      add('Project', str(task.project_name))
      add('Assign to', str(assignee.name))
      add('Currently', str(task.assignee_name) || 'Unassigned')
      break
    case 'pm.add_subtask':
      add('Task', str(task.title))
      add('Project', str(task.project_name))
      add('Subtask', str(args.title))
      break
    case 'support.set_status':
      add('Ticket', str(submission.subject))
      add('Change', `${str(submission.status)} → ${str(args.status)}`)
      break
    case 'support.set_priority':
      add('Ticket', str(submission.subject))
      add('Change', `${str(submission.priority)} → ${str(args.priority)}`)
      break
    case 'support.add_note':
      add('Ticket', str(submission.subject))
      add('Note', str(args.note).slice(0, 140))
      break
    case 'inventory.set_po_status':
      add('PO', str(po.po_number))
      add('Supplier', str(po.supplier_name))
      add('Change', `${str(po.status)} → ${str(args.status)}`)
      break
    case 'inventory.set_supplier_active':
      add('Supplier', str(supplier.name))
      add('Set', args.active ? 'Active' : 'Inactive')
      break
    case 'inventory.set_allocation_status':
      add('Allocation', str(allocation.reference_label) || str(allocation.id))
      add('Change', `${str(allocation.status)} → ${str(args.status)}`)
      break
    default: {
      // Wave-2 status actions carry a single resolved entity + a target status.
      const entity = rec(Object.values(rec(p.resolved))[0])
      const status = str(args.status)
      if (Object.keys(entity).length > 0 && status) {
        const name = str(entity.name) || str(entity.title) || str(entity.goal)
          || str(entity.full_name) || str(entity.candidate) || str(entity.subject) || str(entity.type)
        const current = str(entity.status) || str(entity.outreach_status)
        if (name) add('Item', name)
        if (current) add('Change', `${current} → ${status}`)
        else add('New status', status)
      } else {
        for (const [key, value] of Object.entries(args)) add(key, str(value))
      }
    }
  }
  return fields
}
