import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { KYC_CLIENT_OUTREACH_LABELS, KYC_LEAD_OUTREACH_LABELS } from '@/lib/kyc-client-scoring'
import type { KycLeadOutreachStatus, KycOutreachStatus } from '@/lib/kyc-api'

interface KycOutreachSelectorProps {
  mode: 'client' | 'lead'
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  compact?: boolean
}

export function KycOutreachSelector({ mode, value, onChange, disabled, compact }: KycOutreachSelectorProps) {
  const labels = mode === 'client' ? KYC_CLIENT_OUTREACH_LABELS : KYC_LEAD_OUTREACH_LABELS
  const options = Object.keys(labels)

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <Label className={compact ? 'text-xs' : undefined}>
        {mode === 'client' ? 'Renewal / expansion play' : 'Outreach status'}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full" size={compact ? 'sm' : 'default'}>
          <SelectValue placeholder="Select status" />
        </SelectTrigger>
        <SelectContent>
          {options.map((key) => (
            <SelectItem key={key} value={key}>
              {labels[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function outreachLabel(mode: 'client' | 'lead', status: string): string {
  const labels = mode === 'client' ? KYC_CLIENT_OUTREACH_LABELS : KYC_LEAD_OUTREACH_LABELS
  return labels[status] ?? status
}

export type { KycOutreachStatus, KycLeadOutreachStatus }
