import { Loader2, History } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  SUBMISSION_PRIORITY_LABELS,
  SUBMISSION_STATUS_LABELS,
  type SupportSubmissionActivity,
} from '@/lib/support-api'

interface SubmissionActivityLogProps {
  activity: SupportSubmissionActivity[]
  loading?: boolean
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function describeActivity(entry: SupportSubmissionActivity): string {
  const who = entry.actor_name?.trim() || entry.actor_email
  switch (entry.action_type) {
    case 'status_changed':
      return `${who} changed status from ${SUBMISSION_STATUS_LABELS[entry.from_status as keyof typeof SUBMISSION_STATUS_LABELS] ?? entry.from_status} to ${SUBMISSION_STATUS_LABELS[entry.to_status as keyof typeof SUBMISSION_STATUS_LABELS] ?? entry.to_status}`
    case 'priority_changed':
      return `${who} changed priority from ${SUBMISSION_PRIORITY_LABELS[entry.from_priority as keyof typeof SUBMISSION_PRIORITY_LABELS] ?? entry.from_priority} to ${SUBMISSION_PRIORITY_LABELS[entry.to_priority as keyof typeof SUBMISSION_PRIORITY_LABELS] ?? entry.to_priority}`
    case 'notes_updated':
      return `${who} updated internal notes`
    default:
      return `${who} updated this ticket`
  }
}

export function SubmissionActivityLog({
  activity,
  loading = false,
}: SubmissionActivityLogProps) {
  const latest = activity[0]
  const lastLabel = latest?.actor_name?.trim() || latest?.actor_email

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-foreground">
        <History className="h-4 w-4" />
        Team activity
      </Label>

      {lastLabel && (
        <p className="text-sm text-muted-foreground">
          Last updated by <strong className="text-foreground">{lastLabel}</strong>
          {latest?.actor_email && latest?.actor_name && <> ({latest.actor_email})</>}
          {latest?.created_at && <> · {formatWhen(latest.created_at)}</>}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading activity…
        </div>
      ) : activity.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
          No status changes recorded yet. Updates appear here when your team saves changes.
        </p>
      ) : (
        <ul className="rounded-md border divide-y max-h-48 overflow-y-auto">
          {activity.map((entry) => (
            <li key={entry.id} className="px-3 py-2.5 text-sm">
              <p className="text-foreground">{describeActivity(entry)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {entry.actor_email} · {formatWhen(entry.created_at)}
              </p>
              {entry.action_type === 'notes_updated' && entry.admin_notes && (
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap border-l-2 pl-2">
                  {entry.admin_notes}
                </p>
              )}
              {entry.action_type === 'status_changed' && entry.admin_notes && (
                <p className="text-xs text-muted-foreground mt-1 italic">
                  Note at time of change: {entry.admin_notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
