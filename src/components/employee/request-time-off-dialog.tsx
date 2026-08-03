import { useState } from 'react'
import { Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { submitEmployeeTimeOffRequest, TIME_OFF_TYPES, type TimeOffRequest } from '@/lib/hr-api'

interface RequestTimeOffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeId: string
  onSubmitted?: (request: TimeOffRequest) => void
}

export function RequestTimeOffDialog({
  open,
  onOpenChange,
  employeeId,
  onSubmitted,
}: RequestTimeOffDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [type, setType] = useState<TimeOffRequest['type']>('Vacation')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const resetForm = () => {
    setType('Vacation')
    setStartDate('')
    setEndDate('')
    setReason('')
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm()
    onOpenChange(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate || !endDate) {
      toast({
        title: 'Missing dates',
        description: 'Please select a start and end date.',
        variant: 'destructive',
      })
      return
    }
    if (endDate < startDate) {
      toast({
        title: 'Invalid dates',
        description: 'End date must be on or after the start date.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const result = await submitEmployeeTimeOffRequest({
        employeeId,
        type,
        start_date: startDate,
        end_date: endDate,
        reason,
      })
      if (result) {
        toast({
          title: 'Request submitted',
          description: 'HR will review your time off request. Check HR notices for updates.',
        })
        handleOpenChange(false)
        onSubmitted?.(result)
      } else {
        toast({
          title: 'Could not submit',
          description: 'Failed to submit your request. Please try again or contact HR.',
          variant: 'destructive',
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Request time off</DialogTitle>
            <DialogDescription>
              Submit a request to HR. You will see status updates under HR notices on your feed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="time-off-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as TimeOffRequest['type'])}>
                <SelectTrigger id="time-off-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OFF_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="time-off-start">Start date</Label>
                <Input
                  id="time-off-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="time-off-end">End date</Label>
                <Input
                  id="time-off-end"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="time-off-reason">Reason (optional)</Label>
              <Textarea
                id="time-off-reason"
                placeholder="Brief reason or notes for HR..."
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Calendar className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Submitting...' : 'Submit request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
