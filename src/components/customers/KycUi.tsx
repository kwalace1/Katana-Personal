import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function healthScoreColor(score: number): string {
  if (score >= 70) return 'text-green-600 dark:text-green-400'
  if (score >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export function healthScoreRingColor(score: number): string {
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

export function attentionTierClass(score: number): string {
  if (score >= 40) return 'border-l-red-500 bg-red-500/5'
  if (score >= 20) return 'border-l-amber-500 bg-amber-500/5'
  return 'border-l-blue-500 bg-blue-500/5'
}

interface KycHealthGaugeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

export function KycHealthGauge({ score, size = 'md', label, className }: KycHealthGaugeProps) {
  const clamped = Math.min(100, Math.max(0, score))
  const dims = size === 'sm' ? 56 : size === 'lg' ? 96 : 72
  const stroke = size === 'sm' ? 4 : size === 'lg' ? 7 : 5
  const radius = (dims - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 22 : 16

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div className="relative" style={{ width: dims, height: dims }}>
        <svg width={dims} height={dims} className="-rotate-90">
          <circle
            cx={dims / 2}
            cy={dims / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted/40"
          />
          <circle
            cx={dims / 2}
            cy={dims / 2}
            r={radius}
            fill="none"
            stroke={healthScoreRingColor(clamped)}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center font-bold tabular-nums',
            healthScoreColor(clamped),
          )}
          style={{ fontSize }}
        >
          {clamped}
        </div>
      </div>
      {label && <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>}
    </div>
  )
}

interface KycStatTileProps {
  icon: LucideIcon
  label: string
  value: string | number
  subtitle?: string
  variant?: 'default' | 'danger' | 'warning' | 'success'
  className?: string
}

const TILE_VARIANTS = {
  default: 'bg-muted text-muted-foreground',
  danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  success: 'bg-green-500/10 text-green-600 dark:text-green-400',
}

export function KycStatTile({ icon: Icon, label, value, subtitle, variant = 'default', className }: KycStatTileProps) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border bg-card/80 p-4', className)}>
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', TILE_VARIANTS[variant])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
        <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      </div>
    </div>
  )
}

interface KycEmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  className?: string
}

export function KycEmptyState({ icon: Icon, title, description, className }: KycEmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-10 px-4 text-center', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>}
    </div>
  )
}

export function clientStatusBadgeClass(status: string): string {
  switch (status) {
    case 'at-risk':
      return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
    case 'moderate':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    case 'healthy':
      return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

export function kycRiskLevelBadgeClass(level: string): string {
  switch (level) {
    case 'high':
      return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
    case 'medium':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    case 'low':
      return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

export function kycPriorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'high':
      return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
    case 'medium':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    case 'low':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}
