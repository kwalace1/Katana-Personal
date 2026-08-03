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

interface EsignCreateTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (templateId: string) => void
  onCreate: (input: {
    name: string
    description?: string
    defaultTitle?: string
    defaultSignerCount: number
  }) => Promise<{ id: string }>
}

export function EsignCreateTemplateDialog({
  open,
  onOpenChange,
  onCreated,
  onCreate,
}: EsignCreateTemplateDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [defaultTitle, setDefaultTitle] = useState('')
  const [signerCount, setSignerCount] = useState('1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName('')
    setDescription('')
    setDefaultTitle('')
    setSignerCount('1')
    setError(null)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Give the template a name')
      return
    }
    const count = Math.max(1, Math.min(20, Number(signerCount) || 1))
    setSaving(true)
    setError(null)
    try {
      const created = await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        defaultTitle: defaultTitle.trim() || undefined,
        defaultSignerCount: count,
      })
      reset()
      onOpenChange(false)
      onCreated(created.id)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not create template. Run supabase-esign-v2-migration.sql if tables are missing.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Create template</DialogTitle>
          <DialogDescription>
            Name the template, then upload a sample document and place signature boxes. Those
            boxes become the reusable layout.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-tpl-name">Template name</Label>
            <Input
              id="new-tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Standard NDA"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-tpl-title">Default document title (optional)</Label>
            <Input
              id="new-tpl-title"
              value={defaultTitle}
              onChange={(e) => setDefaultTitle(e.target.value)}
              placeholder="Mutual NDA"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-tpl-signers">Number of signers</Label>
            <Input
              id="new-tpl-signers"
              type="number"
              min={1}
              max={20}
              value={signerCount}
              onChange={(e) => setSignerCount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-tpl-desc">Notes (optional)</Label>
            <Textarea
              id="new-tpl-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Creating…' : 'Create & set up fields'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
