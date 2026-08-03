import type { Job } from '@/lib/wfm-api'

/** Display status used in the UI (legacy table/kanban). */
export type WfmDisplayStatus =
  | 'Unassigned'
  | 'Assigned'
  | 'In Progress'
  | 'On Hold'
  | 'Completed'
  | 'Overdue'
  | 'Cancelled'

export const WFM_KANBAN_COLUMNS: { id: WfmDisplayStatus; label: string; color: string }[] = [
  { id: 'Unassigned', label: 'Unassigned', color: 'bg-amber-500/10' },
  { id: 'Assigned', label: 'Assigned', color: 'bg-blue-500/10' },
  { id: 'In Progress', label: 'In Progress', color: 'bg-yellow-500/10' },
  { id: 'On Hold', label: 'On Hold', color: 'bg-slate-500/10' },
  { id: 'Completed', label: 'Completed', color: 'bg-green-500/10' },
]

export function statusToApi(s: string): Job['status'] {
  if (s === 'In Progress') return 'in-progress'
  if (s === 'Completed') return 'completed'
  if (s === 'On Hold') return 'on-hold'
  if (s === 'Cancelled') return 'cancelled'
  if (s === 'Overdue') return 'assigned'
  return 'assigned'
}

export function apiStatusToDisplay(
  status: Job['status'],
  hasTechnician: boolean,
  isOverdue?: boolean,
): WfmDisplayStatus {
  if (status === 'completed') return 'Completed'
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'on-hold') return 'On Hold'
  if (status === 'in-progress') return 'In Progress'
  if (!hasTechnician) return 'Unassigned'
  if (isOverdue) return 'Overdue'
  return 'Assigned'
}

export function getWfmStatusColor(status: string): string {
  switch (status) {
    case 'Assigned':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    case 'Unassigned':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20'
    case 'In Progress':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
    case 'Completed':
      return 'bg-green-500/10 text-green-500 border-green-500/20'
    case 'Overdue':
      return 'bg-red-500/10 text-red-500 border-red-500/20'
    case 'On Hold':
      return 'bg-slate-500/10 text-slate-600 border-slate-500/20'
    case 'Cancelled':
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
  }
}

export interface WfmLegacyJob {
  id: string
  dbId?: string
  title: string
  technician: string
  startDate: string
  endDate: string
  status: string
  technician_id?: string | null
  location_address?: string | null
  client_id?: string | null
  project_id?: string | null
  task_id?: string | null
  invoice_id?: string | null
}

export function kanbanColumnForJob(job: WfmLegacyJob): WfmDisplayStatus {
  if (job.status === 'Overdue') return 'Assigned'
  if (WFM_KANBAN_COLUMNS.some((c) => c.id === job.status)) {
    return job.status as WfmDisplayStatus
  }
  return 'Assigned'
}
