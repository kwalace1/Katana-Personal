import { useState } from 'react'
import { toast } from 'sonner'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { completeFinanceSetup } from '@/lib/finance-api'
import {
  ENTITY_TYPE_LABELS,
  TAX_BASIS_LABELS,
  INDUSTRY_TEMPLATE_OPTIONS,
  type EntityType,
  type TaxBasis,
} from '@/lib/finance-types'

interface FinanceSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

export function FinanceSetupDialog({ open, onOpenChange, onComplete }: FinanceSetupDialogProps) {
  const [saving, setSaving] = useState(false)
  const [entityType, setEntityType] = useState<EntityType>('sole_prop')
  const [taxBasis, setTaxBasis] = useState<TaxBasis>('cash')
  const [industryTemplate, setIndustryTemplate] = useState('services')
  const [stateOfFormation, setStateOfFormation] = useState('')
  const [ein, setEin] = useState('')

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await completeFinanceSetup({
        entity_type: entityType,
        tax_basis: taxBasis,
        industry_template: industryTemplate,
        state_of_formation: stateOfFormation.trim() || null,
        ein: ein.trim() || null,
        ui_mode: 'simple',
        complete_setup: true,
      })
      toast.success('Finance module configured', {
        description: 'Your chart of accounts has been created. Add a bank account to get started.',
      })
      onComplete()
      onOpenChange(false)
    } catch (err) {
      toast.error('Setup failed', {
        description: err instanceof Error ? err.message : 'Could not save finance settings',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-tour="finance-setup">
        <DialogHeader>
          <DialogTitle>Set up Katana Finance</DialogTitle>
          <DialogDescription>
            Tell us about your business so we can create the right chart of accounts. Katana organizes
            your books and prepares data for tax season — it does not file returns or provide tax advice.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Legal structure</Label>
            <Select value={entityType} onValueChange={(v) => setEntityType(v as EntityType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ENTITY_TYPE_LABELS) as [EntityType, string][]).map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Accounting method</Label>
            <Select value={taxBasis} onValueChange={(v) => setTaxBasis(v as TaxBasis)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(TAX_BASIS_LABELS) as [TaxBasis, string][]).map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Industry</Label>
            <Select value={industryTemplate} onValueChange={setIndustryTemplate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_TEMPLATE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fin-state">State of formation</Label>
              <Input
                id="fin-state"
                placeholder="e.g. DE"
                value={stateOfFormation}
                onChange={(e) => setStateOfFormation(e.target.value)}
                maxLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fin-ein">EIN (optional)</Label>
              <Input
                id="fin-ein"
                placeholder="XX-XXXXXXX"
                value={ein}
                onChange={(e) => setEin(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create chart of accounts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
