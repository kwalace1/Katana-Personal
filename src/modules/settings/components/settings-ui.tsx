import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { cn } from '@/lib/utils'

type SettingsDetailProps = {
  title: string
  description?: string
  children: React.ReactNode
  backLabel?: string
  backTo?: string
}

export function SettingsDetail({
  title,
  description,
  children,
  backLabel = 'Settings',
  backTo = '/settings',
}: SettingsDetailProps) {
  return (
    <motion.div {...pageEnterSubtle} className="kp-page max-w-2xl">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 mb-3 gap-1 text-muted-foreground hover:text-foreground"
      >
        <Link to={backTo}>
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      </Button>
      <PageHeader title={title} description={description} eyebrow="Settings" />
      {children}
    </motion.div>
  )
}

type SettingsGroupProps = {
  title?: string
  children: React.ReactNode
  className?: string
}

export function SettingsGroup({ title, children, className }: SettingsGroupProps) {
  return (
    <section className={cn('mb-5', className)}>
      {title ? <p className="kp-section-label mb-2 px-1 uppercase tracking-wide">{title}</p> : null}
      <div className="kp-surface divide-y divide-border/40 overflow-hidden rounded-2xl">{children}</div>
    </section>
  )
}

type SettingsRowProps = {
  to?: string
  href?: string
  icon?: LucideIcon
  iconClassName?: string
  label: string
  detail?: string
  value?: string
  chevron?: boolean
  onClick?: () => void
  destructive?: boolean
}

export function SettingsRow({
  to,
  href,
  icon: Icon,
  iconClassName,
  label,
  detail,
  value,
  chevron = true,
  onClick,
  destructive,
}: SettingsRowProps) {
  const content = (
    <>
      {Icon ? (
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
            iconClassName,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1 text-left">
        <span className={cn('block text-sm font-medium', destructive && 'text-destructive')}>{label}</span>
        {detail ? <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span> : null}
      </span>
      {value ? <span className="shrink-0 text-sm text-muted-foreground">{value}</span> : null}
      {chevron && (to || href || onClick) ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
      ) : null}
    </>
  )

  const className = cn(
    'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors',
    (to || href || onClick) && 'hover:bg-secondary/40 active:bg-secondary/60',
  )

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    )
  }

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    )
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}

export function SettingsPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('kp-surface space-y-4 p-5', className)}>{children}</div>
}
