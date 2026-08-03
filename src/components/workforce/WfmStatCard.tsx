import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type WfmStatAccent = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'blue'

const accentStyles: Record<WfmStatAccent, { icon: string; value?: string }> = {
  default: { icon: 'bg-muted text-muted-foreground' },
  primary: { icon: 'bg-primary/10 text-primary', value: 'text-primary' },
  success: { icon: 'bg-green-500/10 text-green-600', value: 'text-green-600' },
  warning: { icon: 'bg-amber-500/10 text-amber-600', value: 'text-amber-600' },
  danger: { icon: 'bg-red-500/10 text-red-600', value: 'text-red-600' },
  blue: { icon: 'bg-blue-500/10 text-blue-600', value: 'text-blue-600' },
}

interface WfmStatCardProps {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  accent?: WfmStatAccent
  hint?: string
  className?: string
}

export function WfmStatCard({
  label,
  value,
  icon: Icon,
  accent = 'default',
  hint,
  className,
}: WfmStatCardProps) {
  const styles = accentStyles[accent]

  return (
    <div
      className={cn(
        'rounded-xl border bg-card/80 p-4 transition-colors hover:bg-card',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={cn('rounded-lg p-2 shrink-0', styles.icon)}>
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn('text-2xl font-bold tabular-nums mt-0.5', styles.value)}>{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1 truncate">{hint}</p>}
        </div>
      </div>
    </div>
  )
}
