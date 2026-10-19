import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'

export function HealthCardHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 max-w-xl">
        {eyebrow ? <p className="kp-section-label">{eyebrow}</p> : null}
        <h3 className="mt-1 font-display text-lg tracking-tight">{title}</h3>
        {description ? (
          <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function HealthStat({
  label,
  value,
  hint,
  valueClassName,
  className,
}: {
  label: string
  value: string
  hint?: string
  valueClassName?: string
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('font-display text-lg tracking-tight', valueClassName)}>{value}</p>
      {hint ? <p className="mt-0.5 text-[0.7rem] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function HealthPill({
  children,
  tone = 'muted',
  className,
}: {
  children: React.ReactNode
  tone?: 'muted' | 'primary'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[0.65rem] font-semibold',
        tone === 'primary' ? 'bg-primary/12 text-primary' : 'bg-secondary text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function HealthSegmented<T extends string>({
  options,
  value,
  onChange,
  className,
  full,
  size = 'sm',
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  className?: string
  full?: boolean
  size?: 'sm' | 'lg'
}) {
  return (
    <Segmented
      options={options}
      value={value}
      onChange={onChange}
      className={className}
      full={full}
      size={size}
    />
  )
}

export function HealthFieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted-foreground">
      {children}
    </label>
  )
}

export function HealthInner({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('border-t border-border pt-3', className)}>{children}</div>
}

export const healthTableHead =
  'border-b border-border/50 text-left kp-section-label'
export const healthTableCell = 'py-2.5 pr-3'
