import { formatStoredDate } from '@/lib/due-date-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Eye } from 'lucide-react'
import {
  SUBMISSION_CATEGORY_LABELS,
  SUBMISSION_PRIORITY_LABELS,
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_TYPE_LABELS,
  MODULE_CONTEXT_OPTIONS,
  type SubmissionStatus,
  type SubmissionPriority,
  type SupportSubmission,
} from '@/lib/support-api'

interface SubmissionsTableProps {
  submissions: SupportSubmission[]
  onView: (submission: SupportSubmission) => void
  showSubmitter?: boolean
  showOrganization?: boolean
  emptyMessage?: string
}

function statusBadgeVariant(status: SubmissionStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'open') return 'destructive'
  if (status === 'in_progress') return 'default'
  if (status === 'resolved') return 'secondary'
  return 'outline'
}

function priorityBadgeVariant(priority: SubmissionPriority): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (priority === 'critical' || priority === 'high') return 'destructive'
  if (priority === 'medium') return 'default'
  return 'secondary'
}

function formatDate(iso: string): string {
  return formatStoredDate(iso, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function SubmissionsTable({
  submissions,
  onView,
  showSubmitter = false,
  showOrganization = false,
  emptyMessage = 'No submissions yet.',
}: SubmissionsTableProps) {
  if (submissions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Subject</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Module</TableHead>
            {showSubmitter && <TableHead>Submitter</TableHead>}
            {showOrganization && <TableHead>Organization</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((s) => {
            const moduleLabel =
              MODULE_CONTEXT_OPTIONS.find((m) => m.value === s.module_context)?.label ??
              s.module_context ??
              '—'
            return (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => onView(s)}>
                <TableCell className="font-medium max-w-[200px] truncate">{s.subject}</TableCell>
                <TableCell>
                  <Badge variant="outline">{SUBMISSION_TYPE_LABELS[s.submission_type]}</Badge>
                </TableCell>
                <TableCell>{SUBMISSION_CATEGORY_LABELS[s.category]}</TableCell>
                <TableCell className="text-muted-foreground">{moduleLabel}</TableCell>
                {showSubmitter && (
                  <TableCell className="text-muted-foreground">{s.submitter_name}</TableCell>
                )}
                {showOrganization && (
                  <TableCell className="text-muted-foreground max-w-[140px] truncate">
                    {s.organization_name ?? '—'}
                  </TableCell>
                )}
                <TableCell>
                  <Badge variant={statusBadgeVariant(s.status)}>
                    {SUBMISSION_STATUS_LABELS[s.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={priorityBadgeVariant(s.priority)}>
                    {SUBMISSION_PRIORITY_LABELS[s.priority]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(s.created_at)}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      onView(s)
                    }}
                    aria-label="View submission"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
