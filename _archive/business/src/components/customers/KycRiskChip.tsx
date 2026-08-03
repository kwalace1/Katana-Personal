import { Badge } from '@/components/ui/badge'
import { kycRiskLevelBadgeClass } from '@/components/customers/KycUi'
import type { KycRiskLevel } from '@/lib/kyc-client-scoring'
import { cn } from '@/lib/utils'

interface KycRiskChipProps {
  level: KycRiskLevel | string
  className?: string
}

function label(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1)
}

export function KycRiskChip({ level, className }: KycRiskChipProps) {
  return (
    <Badge variant="outline" className={cn('text-[10px] h-5 font-medium', kycRiskLevelBadgeClass(level), className)}>
      {label(level)}
    </Badge>
  )
}
