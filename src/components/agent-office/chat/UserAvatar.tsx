import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * The signed-in user's avatar for their own chat messages — the Microsoft
 * profile photo when available, falling back to initials (mirrors AgentAvatar
 * sizing so user and agent rows line up).
 */
export function UserAvatar({
  avatarUrl,
  name,
  size = 'sm',
  className,
}: {
  avatarUrl?: string | null
  name?: string | null
  size?: 'sm' | 'md'
  className?: string
}) {
  const [imgFailed, setImgFailed] = useState(false)

  const initials = useMemo(() => {
    const n = (name || '').trim()
    if (!n) return 'ME'
    const parts = n.split(/\s+/)
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : n.slice(0, 2)).toUpperCase()
  }, [name])

  const sizeClass = size === 'md' ? 'h-9 w-9 text-xs' : 'h-7 w-7 text-[10px]'

  if (avatarUrl && !imgFailed) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'You'}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={cn('shrink-0 rounded-full object-cover ring-1 ring-border/60', sizeClass, className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary select-none ring-1 ring-primary/25',
        sizeClass,
        className,
      )}
    >
      {initials}
    </div>
  )
}
