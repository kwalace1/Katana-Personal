import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface EsignSaveTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultName: string
  defaultDescription?: string | null
  fieldCount: number
  signerCount: number
  onSave: (input: { name: string; description?: string }) => Promise<void>
}

export function EsignSaveTemplateDialog({
  open,
  onOpenChange,
  defaultName,
  defaultDescription,
  fieldCount,
  signerCount,
  onSave,
}: EsignSaveTemplateDialogProps) {
  const [name, setName] = useState(defaultName)
  const [description, setDescription] = useState(defaultDescription ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpen = (next: boolean) => {
    if (next) {
      setName(defaultName)
      setDescription(defaultDescription ?? '')
      setError(null)
    }
    onOpenChange(next)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Give this template a name')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ name: name.trim(), description: description.trim() || undefined })
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save template')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Save as template</DialogTitle>
          <DialogDescription>
            Reuse this field layout on the next document. Saves {fieldCount} field
            {fieldCount === 1 ? '' : 's'} for {signerCount} signer
            {signerCount === 1 ? '' : 's'}.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tpl-name">Template name</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="NDA — standard signature block"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-desc">Notes (optional)</Label>
            <Textarea
              id="tpl-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Where boxes go, who usually signs…"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
