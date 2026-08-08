import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { formatShortDate } from '@/lib/dates'

export function relativeWhen(iso: string) {
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return ''
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return formatShortDate(iso)
}

export function FeedAvatar({
  name,
  size = 'md',
  to,
  className,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  to?: string
  className?: string
}) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const initials =
    parts.length === 0
      ? '?'
      : parts.length === 1
        ? parts[0]!.slice(0, 2).toUpperCase()
        : `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()

  const node = (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/90 to-[hsl(200_40%_32%)] font-semibold text-primary-foreground',
        size === 'sm' && 'h-8 w-8 text-[0.65rem]',
        size === 'md' && 'h-10 w-10 text-[0.7rem]',
        size === 'lg' && 'h-12 w-12 text-sm',
        to && 'transition hover:opacity-90',
        className,
      )}
    >
      {initials}
    </div>
  )
  return to ? (
    <Link to={to} aria-label={`${name} profile`} onClick={(e) => e.stopPropagation()}>
      {node}
    </Link>
  ) : (
    node
  )
}

export function profilePath(uid: string) {
  return `/feed/u/${encodeURIComponent(uid)}`
}
