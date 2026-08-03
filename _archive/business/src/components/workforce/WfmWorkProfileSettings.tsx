import { useState } from 'react'
import { Briefcase, Building2, Wrench, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  WFM_WORK_PROFILE_OPTIONS,
  type WfmWorkProfile,
} from '@/lib/wfm-terminology'
import { cn } from '@/lib/utils'

const PROFILE_ICONS: Record<WfmWorkProfile, typeof Wrench> = {
  field_service: Wrench,
  professional_services: Briefcase,
  general: Building2,
}

interface WfmWorkProfileSettingsProps {
  profile: WfmWorkProfile
  onSave: (profile: WfmWorkProfile) => Promise<void>
}

export function WfmWorkProfileSettings({ profile, onSave }: WfmWorkProfileSettingsProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<WfmWorkProfile>(profile)
  const [saving, setSaving] = useState(false)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) setSelected(profile)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(selected)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-tour="wfm-settings">
          <Settings2 className="h-4 w-4 mr-2" />
          Work profile
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Workforce work profile</DialogTitle>
          <DialogDescription>
            Choose how Workforce labels work and team members. Your data stays the same — only the
            language and field-service features adapt.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>How does your team work?</Label>
          <div className="grid gap-2">
            {WFM_WORK_PROFILE_OPTIONS.map((opt) => {
              const Icon = PROFILE_ICONS[opt.value]
              const isSelected = selected === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelected(opt.value)}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3 text-left transition-all',
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'hover:bg-muted/50',
                  )}
                >
                  <div
                    className={cn(
                      'rounded-lg p-2 shrink-0',
                      isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
