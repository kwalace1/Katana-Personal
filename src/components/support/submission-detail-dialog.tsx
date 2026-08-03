import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Mail, Trash2 } from 'lucide-react'
import {
  SUBMISSION_CATEGORY_LABELS,
  SUBMISSION_PRIORITY_LABELS,
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_TYPE_LABELS,
  MODULE_CONTEXT_OPTIONS,
  deleteSubmission,
  getSubmissionActivity,
  updateSubmission,
  type SubmissionPriority,
  type SubmissionStatus,
  type SupportSubmission,
  type SupportSubmissionActivity,
  type UpdateSubmissionActor,
} from '@/lib/support-api'
import { SubmissionActivityLog } from '@/components/support/submission-activity-log'
import { CustomerAccountPicker } from '@/components/customers/CustomerAccountPicker'

interface SubmissionDetailDialogProps {
  submission: SupportSubmission | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canManage?: boolean
  currentUserId?: string
  actor?: UpdateSubmissionActor
  onUpdated?: (submission: SupportSubmission) => void
  onDeleted?: (id: string) => void
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

export function SubmissionDetailDialog({
  submission,
  open,
  onOpenChange,
  canManage = false,
  currentUserId,
  actor,
  onUpdated,
  onDeleted,
}: SubmissionDetailDialogProps) {
  const [status, setStatus] = useState<SubmissionStatus>('open')
  const [priority, setPriority] = useState<SubmissionPriority>('medium')
  const [adminNotes, setAdminNotes] = useState('')
  const [clientId, setClientId] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [activity, setActivity] = useState<SupportSubmissionActivity[]>([])
  const [activityLoading, setActivityLoading] = useState(false)

  useEffect(() => {
    if (!submission) return
    setStatus(submission.status)
    setPriority(submission.priority)
    setAdminNotes(submission.admin_notes ?? '')
    setClientId(submission.client_id ?? '')
  }, [submission])

  useEffect(() => {
    if (!open || !submission || !canManage) {
      setActivity([])
      return
    }
    let cancelled = false
    setActivityLoading(true)
    void getSubmissionActivity(submission.id).then((rows) => {
      if (!cancelled) {
        setActivity(rows)
        setActivityLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, submission?.id, canManage])

  if (!submission) return null

  const moduleLabel =
    MODULE_CONTEXT_OPTIONS.find((m) => m.value === submission.module_context)?.label ??
    submission.module_context ??
    '—'

  const isOwner = currentUserId === submission.submitter_user_id
  const canDelete = isOwner || canManage
  const canEdit = canManage

  const handleSave = async () => {
    if (!canEdit || !actor) return
    setSaving(true)
    try {
      const updated = await updateSubmission(
        submission.id,
        {
          status,
          priority,
          admin_notes: adminNotes.trim() || null,
          client_id: clientId || null,
        },
        submission,
        actor
      )
      if (updated) {
        toast.success('Submission updated')
        const rows = await getSubmissionActivity(submission.id)
        setActivity(rows)
        onUpdated?.(updated)
      }
    } catch (err) {
      toast.error('Failed to update', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteSubmission(submission.id)
      toast.success('Submission deleted')
      onDeleted?.(submission.id)
      setDeleteConfirmOpen(false)
      onOpenChange(false)
    } catch (err) {
      toast.error('Failed to delete', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{submission.subject}</DialogTitle>
            <DialogDescription>
              Submitted {new Date(submission.created_at).toLocaleString()} · Ticket{' '}
              {submission.id.slice(0, 8)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{SUBMISSION_TYPE_LABELS[submission.submission_type]}</Badge>
              <Badge variant="outline">{SUBMISSION_CATEGORY_LABELS[submission.category]}</Badge>
              <Badge variant={statusBadgeVariant(submission.status)}>
                {SUBMISSION_STATUS_LABELS[submission.status]}
              </Badge>
              <Badge variant={priorityBadgeVariant(submission.priority)}>
                {SUBMISSION_PRIORITY_LABELS[submission.priority]}
              </Badge>
            </div>

            <div className="rounded-md border bg-primary/5 p-3 flex items-start gap-2">
              <Mail className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm">
                The Katana team responds to <strong>{submission.submitter_email}</strong>
                {submission.organization_name && <> ({submission.organization_name})</>}.
              </p>
            </div>

            {canEdit && (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                <strong className="text-foreground">Status workflow:</strong> Open → In Progress →
                Resolved → Closed. Update after you handle the ticket by email.
              </div>
            )}

            <div className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Submitted by</span>
                <span className="text-right">{submission.submitter_name}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Email</span>
                <span className="text-right">{submission.submitter_email}</span>
              </div>
              {submission.organization_name && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Organization</span>
                  <span className="text-right">{submission.organization_name}</span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Module</span>
                <span className="text-right">{moduleLabel}</span>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground">Description</Label>
              <p className="text-sm whitespace-pre-wrap rounded-md border bg-muted/30 p-3">
                {submission.description}
              </p>
            </div>

            {canEdit && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as SubmissionStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(SUBMISSION_STATUS_LABELS) as SubmissionStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {SUBMISSION_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as SubmissionPriority)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(SUBMISSION_PRIORITY_LABELS) as SubmissionPriority[]).map((p) => (
                          <SelectItem key={p} value={p}>
                            {SUBMISSION_PRIORITY_LABELS[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <CustomerAccountPicker
                  value={clientId}
                  onChange={(id) => setClientId(id)}
                  label="Link to customer account"
                />

                <div className="space-y-2">
                  <Label>Internal notes (optional)</Label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Notes for your team — not emailed to the submitter"
                    rows={3}
                  />
                </div>
              </>
            )}

            {canEdit && (
              <SubmissionActivityLog activity={activity} loading={activityLoading} />
            )}

            {!canEdit && submission.admin_notes && (
              <div className="space-y-1">
                <Label className="text-muted-foreground">Team notes</Label>
                <p className="text-sm whitespace-pre-wrap rounded-md border bg-muted/30 p-3">
                  {submission.admin_notes}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {canDelete && (
              <Button
                type="button"
                variant="destructive"
                className="sm:mr-auto"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {canEdit && (
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save status
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this submission?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes &ldquo;{submission.subject}&rdquo;. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
