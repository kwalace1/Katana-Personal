import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sparkles } from 'lucide-react'
import {
  updateJobMatchCriteria,
  type Job,
  type JobMatchCriteria,
} from '@/lib/recruitment-db'
import { deriveMatchCriteriaFromJob } from '@/lib/recruitment-matching'

interface JobMatchCriteriaDialogProps {
  job: Job | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

type CriteriaFormState = JobMatchCriteria & {
  requiredSkillsInput?: string
  preferredSkillsInput?: string
}

const EXPERIENCE_OPTIONS = [
  { value: '0-2', label: '0–2 years' },
  { value: '2-5', label: '2–5 years' },
  { value: '5-10', label: '5–10 years' },
  { value: '10+', label: '10+ years' },
] as const

export function JobMatchCriteriaDialog({
  job,
  open,
  onOpenChange,
  onSaved,
}: JobMatchCriteriaDialogProps) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CriteriaFormState | null>(null)

  useEffect(() => {
    if (job && open) {
      setForm(job.matchCriteria ?? deriveMatchCriteriaFromJob(job))
    }
  }, [job, open])

  if (!job || !form) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      const requiredSkills = form.requiredSkills.length
        ? form.requiredSkills
        : (form.requiredSkillsInput ?? '')
            .split(/[,;]/)
            .map((s: string) => s.trim())
            .filter(Boolean)
      const preferredSkills = form.preferredSkills.length
        ? form.preferredSkills
        : (form.preferredSkillsInput ?? '')
            .split(/[,;]/)
            .map((s: string) => s.trim())
            .filter(Boolean)

      const payload: JobMatchCriteria = {
        position: form.position || job.title,
        requiredSkills,
        preferredSkills,
        minExperience: form.minExperience,
        preferredEducation: form.preferredEducation,
        certifications: form.certifications,
      }

      const ok = await updateJobMatchCriteria(job.id, payload)
      if (ok) {
        onSaved?.()
        onOpenChange(false)
      } else {
        alert(
          'Could not save match criteria. If this is a new feature, run supabase-hr-recruitment-matching-migration.sql in Supabase.',
        )
      }
    } finally {
      setSaving(false)
    }
  }

  const f = form

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Match criteria — {job.title}
          </DialogTitle>
          <DialogDescription>
            Define what you are looking for. Candidates are ranked by fit using their parsed resume
            profile (skills, experience, education) while identity stays hidden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Required skills (comma-separated)</Label>
            <Input
              value={
                f.requiredSkillsInput ??
                f.requiredSkills.join(', ')
              }
              onChange={(e) =>
                setForm({
                  ...f,
                  requiredSkillsInput: e.target.value,
                  requiredSkills: [],
                })
              }
              placeholder="e.g. react, typescript, node"
            />
          </div>
          <div className="space-y-2">
            <Label>Preferred skills (comma-separated)</Label>
            <Input
              value={
                f.preferredSkillsInput ??
                f.preferredSkills.join(', ')
              }
              onChange={(e) =>
                setForm({
                  ...f,
                  preferredSkillsInput: e.target.value,
                  preferredSkills: [],
                })
              }
              placeholder="e.g. aws, docker"
            />
          </div>
          <div className="space-y-2">
            <Label>Minimum experience</Label>
            <Select
              value={f.minExperience}
              onValueChange={(v) =>
                setForm({ ...f, minExperience: v as JobMatchCriteria['minExperience'] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPERIENCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Preferred education (comma-separated)</Label>
            <Input
              value={f.preferredEducation.join(', ')}
              onChange={(e) =>
                setForm({
                  ...f,
                  preferredEducation: e.target.value.split(/[,;]/).map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="Bachelor's Degree, Master's Degree"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setForm(deriveMatchCriteriaFromJob(job))}
          >
            Reset from job posting
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save criteria'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
