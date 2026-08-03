import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  actions,
  className,
  eyebrow,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
  eyebrow?: string
}) {
  return (
    <div className={cn('mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-2xl">
        {eyebrow ? <p className="kp-section-label mb-2">{eyebrow}</p> : null}
        <h1 className="font-display text-[2rem] leading-[1.1] tracking-tight sm:text-4xl kp-text-balance">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
