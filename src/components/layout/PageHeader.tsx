import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  actions,
  className,
  eyebrow,
  dense = true,
  reserveDescriptions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
  eyebrow?: string
  /** Tighter title block for everyday list screens. */
  dense?: boolean
  /** Other descriptions that can replace `description`. The line stays as tall as the longest. */
  reserveDescriptions?: readonly string[]
}) {
  return (
    <div className={cn(
      'flex flex-col sm:flex-row sm:items-end sm:justify-between',
      dense ? 'mb-4 gap-3' : 'mb-6 gap-4',
      className,
    )}>
      <div className="max-w-2xl">
        {eyebrow ? <p className="kp-section-label mb-1">{eyebrow}</p> : null}
        <h1 className={cn(
          'font-display tracking-tight kp-text-balance',
          dense ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl',
        )}>
          {title}
        </h1>
        {description ? (
          <Description
            text={description}
            reserve={reserveDescriptions}
            className={cn('max-w-xl text-sm text-muted-foreground', dense ? 'mt-1' : 'mt-1.5 leading-relaxed')}
          />
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

function Description({
  text,
  reserve,
  className,
}: {
  text: string
  reserve?: readonly string[]
  className?: string
}) {
  const lines = reserve?.length ? [...new Set([text, ...reserve])] : [text]
  if (lines.length === 1) {
    return <p className={className}>{text}</p>
  }
  return (
    <div className={cn('grid', className)}>
      {lines.map((line) => (
        <p
          key={line}
          className={cn('col-start-1 row-start-1', line !== text && 'invisible')}
          aria-hidden={line !== text ? true : undefined}
        >
          {line}
        </p>
      ))}
    </div>
  )
}
