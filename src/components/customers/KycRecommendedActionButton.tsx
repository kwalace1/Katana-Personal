import { useEffect, useState } from 'react'
import { Check, CheckSquare, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { KycSuggestedAction } from '@/lib/kyc-client-scoring'
import type { KycActionTaskStatus } from '@/lib/kyc-action-resolution'
import { createTask } from '@/lib/customer-success-api'
import { useToast } from '@/hooks/use-toast'

interface KycRecommendedActionButtonProps {
  clientId: string
  action: KycSuggestedAction
  assignedTo?: string | null
  taskStatus?: KycActionTaskStatus | null
  onCreated?: (taskId: string) => void
}

function dueDateForPriority(priority: KycSuggestedAction['priority']): string {
  const days = priority === 'high' ? 2 : priority === 'medium' ? 7 : 14
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function KycRecommendedActionButton({
  clientId,
  action,
  assignedTo = null,
  taskStatus = null,
  onCreated,
}: KycRecommendedActionButtonProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [localOpen, setLocalOpen] = useState(false)

  useEffect(() => {
    setLocalOpen(false)
  }, [action.id, taskStatus])

  const resolvedStatus: KycActionTaskStatus | 'none' =
    taskStatus ?? (localOpen ? 'open' : 'none')
  const isCompleted = resolvedStatus === 'completed'
  const isOpen = resolvedStatus === 'open'

  const handleCreate = async () => {
    if (isCompleted || isOpen || saving) return
    setSaving(true)
    try {
      const task = await createTask({
        client_id: clientId,
        title: action.label,
        status: 'active',
        due_date: dueDateForPriority(action.priority),
        priority: action.priority === 'low' ? 'medium' : action.priority,
        assigned_to: assignedTo,
        kyc_action_id: action.id,
      })
      if (task) {
        setLocalOpen(true)
        const assigneeName = task.csm?.name?.trim()
        toast({
          title: 'Task created',
          description: assigneeName
            ? `"${action.label}" is open and assigned to ${assigneeName}. Mark it complete when done to update this account's score.`
            : `"${action.label}" is open on this account. Mark it complete when done to update the score.`,
        })
        onCreated?.(task.id)
      } else {
        toast({
          title: 'Could not create task',
          description: 'Check your connection and try again.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Could not create task',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (isCompleted) {
    return (
      <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled>
        <Check className="h-3.5 w-3.5 text-green-600" />
        Completed
      </Button>
    )
  }

  if (isOpen) {
    return (
      <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled>
        <Clock className="h-3.5 w-3.5 text-amber-600" />
        Task in progress
      </Button>
    )
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="gap-1.5"
      onClick={() => void handleCreate()}
      disabled={saving}
    >
      {saving ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CheckSquare className="h-3.5 w-3.5" />
      )}
      Create task
    </Button>
  )
}
