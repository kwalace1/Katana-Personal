import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import {
  createSubmission,
  MODULE_CONTEXT_OPTIONS,
  SUBMISSION_CATEGORY_LABELS,
  SUBMISSION_PRIORITY_LABELS,
  type SubmissionCategory,
  type SubmissionPriority,
  type SubmissionType,
  type SupportSubmission,
} from '@/lib/support-api'

interface SubmitSubmissionFormProps {
  submitterName: string
  submitterEmail: string
  organizationName: string
  onSubmitted: (submission: SupportSubmission) => void
}

const ISSUE_CATEGORIES: SubmissionCategory[] = ['bug', 'performance', 'question', 'general']
const FEEDBACK_CATEGORIES: SubmissionCategory[] = ['feature', 'ux', 'general', 'question']

export function SubmitSubmissionForm({
  submitterName,
  submitterEmail,
  organizationName,
  onSubmitted,
}: SubmitSubmissionFormProps) {
  const [submissionType, setSubmissionType] = useState<SubmissionType>('issue')
  const [category, setCategory] = useState<SubmissionCategory>('bug')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [moduleContext, setModuleContext] = useState<string>('')
  const [priority, setPriority] = useState<SubmissionPriority>('medium')
  const [submitting, setSubmitting] = useState(false)

  const categories = submissionType === 'issue' ? ISSUE_CATEGORIES : FEEDBACK_CATEGORIES

  const handleTypeChange = (type: SubmissionType) => {
    setSubmissionType(type)
    setCategory(type === 'issue' ? 'bug' : 'feature')
    setPriority(type === 'issue' ? 'medium' : 'low')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !description.trim()) {
      toast.error('Please fill in subject and description')
      return
    }
    if (!submitterEmail.trim()) {
      toast.error('Your account email is required so the Katana team can reply')
      return
    }

    setSubmitting(true)
    try {
      const created = await createSubmission({
        submission_type: submissionType,
        category,
        subject,
        description,
        module_context: moduleContext || null,
        priority,
        submitter_name: submitterName,
        submitter_email: submitterEmail,
        organization_name: organizationName,
      })
      if (created) {
        toast.success('Submitted successfully', {
          description: `The Katana team will respond to ${submitterEmail}.`,
        })
        setSubject('')
        setDescription('')
        setModuleContext('')
        onSubmitted(created)
      }
    } catch (err) {
      toast.error('Failed to submit', {
        description: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card data-tour="support-submit">
      <CardHeader>
        <CardTitle className="text-lg">Submit a request</CardTitle>
        <p className="text-sm text-muted-foreground">
          Report an issue or share feedback. Requests go directly to the Katana pilot team —
          we will reply to <strong className="text-foreground">{submitterEmail}</strong>.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={submissionType} onValueChange={(v) => handleTypeChange(v as SubmissionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="issue">Issue Report</SelectItem>
                  <SelectItem value="feedback">Feedback</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as SubmissionCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {SUBMISSION_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Related module (optional)</Label>
              <Select value={moduleContext || 'none'} onValueChange={(v) => setModuleContext(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specific to a module</SelectItem>
                  {MODULE_CONTEXT_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {submissionType === 'issue' && (
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
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-subject">Subject</Label>
            <Input
              id="support-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={submissionType === 'issue' ? 'Brief description of the problem' : 'What would you like to share?'}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-description">Details</Label>
            <Textarea
              id="support-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                submissionType === 'issue'
                  ? 'What happened? What did you expect? Steps to reproduce if applicable.'
                  : 'Tell us what you think — ideas, improvements, or general impressions.'
              }
              rows={5}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              {submitterName} · {submitterEmail} · {organizationName}
            </p>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
