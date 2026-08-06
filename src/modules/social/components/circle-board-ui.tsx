import { Crown, Medal } from 'lucide-react'
import { cn } from '@/lib/utils'

export function circleInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export function CircleAvatar({
  name,
  you,
  size = 'md',
}: {
  name: string
  you?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const dims = size === 'lg' ? 'h-16 w-16 text-lg' : size === 'sm' ? 'h-8 w-8 text-[0.65rem]' : 'h-11 w-11 text-sm'
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight',
        dims,
        you
          ? 'bg-primary text-primary-foreground shadow-[0_0_0_3px_hsl(var(--primary)/0.25)]'
          : 'bg-secondary text-foreground',
      )}
    >
      {circleInitials(name)}
    </div>
  )
}

export function CircleRankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400/90 text-amber-950 shadow-sm">
        <Crown className="h-4 w-4" />
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-300/90 text-slate-800">
        <Medal className="h-4 w-4" />
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-300/80 text-orange-950">
        <Medal className="h-4 w-4" />
      </span>
    )
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold tabular-nums">
      {rank}
    </span>
  )
}
