import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { computeTrialBanner } from '@/lib/trial-check'

export function TrialExpirationBanner() {
  const { organization } = useAuth()
  const banner = useMemo(() => computeTrialBanner(organization), [organization])

  if (!banner.show) return null

  return (
    <div
      role="status"
      className={
        banner.variant === 'destructive'
          ? 'border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive'
          : 'border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-100'
      }
    >
      {banner.message}
    </div>
  )
}
