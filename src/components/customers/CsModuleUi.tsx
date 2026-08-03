import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function isB2CAccount(accountType?: string | null): boolean {
  return (accountType ?? 'business').toLowerCase() === 'individual'
}

export function accountTypeLabel(accountType?: string | null): 'B2B' | 'B2C' {
  return isB2CAccount(accountType) ? 'B2C' : 'B2B'
}

interface CsTabHeaderProps {
  icon: LucideIcon
  title: string
  description: string
  actions?: React.ReactNode
  className?: string
}

export function CsTabHeader({ icon: Icon, title, description, actions, className }: CsTabHeaderProps) {
  return (
    <div className={cn('rounded-xl border bg-gradient-to-br from-primary/5 via-card to-card p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">{description}</p>
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  )
}

interface CsAccountTypeBadgeProps {
  accountType?: string | null
  className?: string
}

export function CsAccountTypeBadge({ accountType, className }: CsAccountTypeBadgeProps) {
  const b2c = isB2CAccount(accountType)
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide',
        b2c
          ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25'
          : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25',
        className,
      )}
    >
      {b2c ? 'B2C' : 'B2B'}
    </span>
  )
}

interface CsSegmentFilterProps<T extends string> {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  className?: string
}

export function CsSegmentFilter<T extends string>({ options, value, onChange, className }: CsSegmentFilterProps<T>) {
  return (
    <div className={cn('inline-flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            value === opt.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/** Subtitle for a customer row — industry for B2B, location for B2C when industry is empty */
export function customerContextLine(client: {
  account_type?: string | null
  industry?: string | null
  state?: string | null
  country?: string | null
}): string {
  if (isB2CAccount(client.account_type)) {
    const loc = [client.state, client.country].filter(Boolean).join(', ')
    return loc || client.industry || 'Consumer account'
  }
  return client.industry || 'No industry'
}
