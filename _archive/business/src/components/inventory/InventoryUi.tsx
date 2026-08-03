import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ChevronRight, ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Status badges ───────────────────────────────────────────────────────────

export function inventoryItemStatusClass(status: string): string {
  switch (status) {
    case 'in-stock':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
    case 'low-stock':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25'
    case 'out-of-stock':
      return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

export function inventoryItemStatusLabel(status: string): string {
  switch (status) {
    case 'in-stock':
      return 'In Stock'
    case 'low-stock':
      return 'Low Stock'
    case 'out-of-stock':
      return 'Out of Stock'
    default:
      return status
  }
}

export function poStatusClass(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25'
    case 'open':
      return 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25'
    case 'pending':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25'
    case 'received':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
    case 'cancelled':
      return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

export function InventoryStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium', inventoryItemStatusClass(status), className)}>
      {inventoryItemStatusLabel(status)}
    </Badge>
  )
}

export function PoStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium capitalize', poStatusClass(status), className)}>
      {status}
    </Badge>
  )
}

// ─── Layout shells ───────────────────────────────────────────────────────────

export function InventoryShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-h-screen bg-gradient-to-b from-muted/30 via-background to-background', className)}>
      {children}
    </div>
  )
}

export function InventoryContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-7xl px-4 py-6 sm:px-6', className)}>{children}</div>
}

interface InventoryHubHeaderProps {
  icon: LucideIcon
  title: string
  description: string
  actions?: React.ReactNode
}

export function InventoryHubHeader({ icon: Icon, title, description, actions }: InventoryHubHeaderProps) {
  return (
    <div className="border-b border-border/60 bg-background/80 backdrop-blur-md -mx-4 px-4 sm:-mx-6 sm:px-6 mb-6">
      <div className="py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" data-tour="inventory-header">
          <div>
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
              <Link to="/hub" className="hover:text-foreground transition-colors">
                Hub
              </Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
              <span className="text-foreground font-medium">{title}</span>
            </nav>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/15">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
              </div>
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  )
}

interface InventorySubpageHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
  backTo?: string
  actions?: React.ReactNode
}

export function InventorySubpageHeader({
  title,
  description,
  icon: Icon,
  backTo = '/inventory',
  actions,
}: InventorySubpageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
      <div className="flex items-start gap-3 min-w-0">
        <Link to={backTo}>
          <Button variant="outline" size="icon" className="shrink-0 rounded-xl h-10 w-10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
          </div>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

// ─── Stats ─────────────────────────────────────────────────────────────────

type StatTone = 'default' | 'warning' | 'info' | 'success' | 'value'

const statToneStyles: Record<StatTone, { icon: string; value: string; border: string }> = {
  default: {
    icon: 'bg-muted text-muted-foreground',
    value: 'text-foreground',
    border: 'border-l-muted-foreground/30',
  },
  warning: {
    icon: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    value: 'text-amber-600 dark:text-amber-400',
    border: 'border-l-amber-500/50',
  },
  info: {
    icon: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    value: 'text-sky-600 dark:text-sky-400',
    border: 'border-l-sky-500/50',
  },
  success: {
    icon: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    value: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-l-emerald-500/50',
  },
  value: {
    icon: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
    value: 'text-violet-600 dark:text-violet-400',
    border: 'border-l-violet-500/50',
  },
}

interface InventoryStatCardProps {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  tone?: StatTone
  href?: string
  className?: string
}

export function InventoryStatCard({ icon: Icon, label, value, tone = 'default', href, className }: InventoryStatCardProps) {
  const styles = statToneStyles[tone]
  const inner = (
    <Card
      className={cn(
        'relative overflow-hidden border-border/60 bg-card/80 backdrop-blur-sm p-4 sm:p-5',
        'border-l-[3px] transition-all duration-200',
        styles.border,
        href && 'hover:shadow-md hover:border-border cursor-pointer group',
        className,
      )}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', styles.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground truncate">{label}</p>
          <p className={cn('text-2xl font-bold tabular-nums mt-0.5', styles.value)}>{value}</p>
        </div>
      </div>
    </Card>
  )
  if (href) return <Link to={href} className="block">{inner}</Link>
  return inner
}

export function InventoryStatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4', className)} data-tour="inventory-stats">
      {children}
    </div>
  )
}

// ─── Quick actions ─────────────────────────────────────────────────────────

type QuickActionTone = 'blue' | 'green' | 'orange' | 'purple' | 'slate' | 'violet'

const quickActionTones: Record<QuickActionTone, string> = {
  blue: 'from-sky-500/10 to-sky-500/5 text-sky-600 dark:text-sky-400 ring-sky-500/20 group-hover:ring-sky-500/40',
  green: 'from-emerald-500/10 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20 group-hover:ring-emerald-500/40',
  orange: 'from-orange-500/10 to-orange-500/5 text-orange-600 dark:text-orange-400 ring-orange-500/20 group-hover:ring-orange-500/40',
  purple: 'from-violet-500/10 to-violet-500/5 text-violet-600 dark:text-violet-400 ring-violet-500/20 group-hover:ring-violet-500/40',
  slate: 'from-slate-500/10 to-slate-500/5 text-slate-600 dark:text-slate-400 ring-slate-500/20 group-hover:ring-slate-500/40',
  violet: 'from-indigo-500/10 to-indigo-500/5 text-indigo-600 dark:text-indigo-400 ring-indigo-500/20 group-hover:ring-indigo-500/40',
}

interface InventoryQuickActionProps {
  icon: LucideIcon
  title: string
  description: string
  tone?: QuickActionTone
  onClick?: () => void
  href?: string
  className?: string
  'data-tour'?: string
}

export function InventoryQuickAction({
  icon: Icon,
  title,
  description,
  tone = 'blue',
  onClick,
  href,
  className,
  'data-tour': dataTour,
}: InventoryQuickActionProps) {
  const content = (
    <Card
      className={cn(
        'group relative overflow-hidden p-4 h-full cursor-pointer',
        'border-border/60 bg-card/70 backdrop-blur-sm',
        'hover:shadow-lg hover:border-border hover:-translate-y-0.5 transition-all duration-200',
        className,
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      data-tour={dataTour}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 transition-all',
            quickActionTones[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 text-left">
          <p className="font-semibold text-sm leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
        </div>
      </div>
    </Card>
  )
  if (href) return <Link to={href} className="block h-full">{content}</Link>
  return content
}

export function InventoryQuickActionsGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3', className)}>
      {children}
    </div>
  )
}

// ─── Sections & tables ─────────────────────────────────────────────────────

interface InventorySectionProps {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  'data-tour'?: string
}

export function InventorySection({ title, description, actions, children, className, 'data-tour': dataTour }: InventorySectionProps) {
  return (
    <Card className={cn('border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden', className)} data-tour={dataTour}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-border/50 bg-muted/20">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  )
}

export function InventoryTableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border/60 overflow-hidden', className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

export function InventoryTable({ children, className }: { children: React.ReactNode; className?: string }) {
  return <table className={cn('w-full text-sm', className)}>{children}</table>
}

export function InventoryTableHead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-muted/40 border-b border-border/50">{children}</thead>
}

export function InventoryTableTh({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn('text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground', className)}>
      {children}
    </th>
  )
}

export function InventoryTableRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <tr className={cn('border-t border-border/40 hover:bg-muted/25 transition-colors', className)}>
      {children}
    </tr>
  )
}

export function InventoryTableTd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3.5 align-middle', className)}>{children}</td>
}

// ─── Utilities ─────────────────────────────────────────────────────────────

export function InventorySearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 h-9 bg-background/80 border-border/60 rounded-lg w-full sm:w-72"
      />
    </div>
  )
}

export function InventoryFilterToolbar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 p-3 rounded-xl border border-border/50 bg-muted/15',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function InventoryViewToggle({
  value,
  onChange,
}: {
  value: 'active' | 'archived'
  onChange: (value: 'active' | 'archived') => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-border/60 bg-background/80 p-0.5 shadow-sm">
      <button
        type="button"
        onClick={() => onChange('active')}
        className={cn(
          'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
          value === 'active'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Active
      </button>
      <button
        type="button"
        onClick={() => onChange('archived')}
        className={cn(
          'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
          value === 'archived'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Archived
      </button>
    </div>
  )
}

export function InventoryEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 mb-4">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function InventoryNotConfigured({ title = 'Database Not Configured' }: { title?: string }) {
  return (
    <InventoryShell>
      <InventoryContent>
        <Card className="p-10 text-center border-dashed">
          <p className="text-lg font-semibold mb-2">{title}</p>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Set <code className="bg-muted px-1.5 py-0.5 rounded text-xs">VITE_SUPABASE_URL</code> and{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs">VITE_SUPABASE_ANON_KEY</code> in your environment.
          </p>
        </Card>
      </InventoryContent>
    </InventoryShell>
  )
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}
