/** Shared visual helpers for Katana E-Sign — presentation only. */

export function esignStatusTone(status: string): {
  badge: 'default' | 'secondary' | 'destructive' | 'outline'
  chip: string
  dot: string
} {
  if (status === 'signed') {
    return {
      badge: 'default',
      chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
      dot: 'bg-emerald-500',
    }
  }
  if (status === 'cancelled' || status === 'expired') {
    return {
      badge: 'destructive',
      chip: 'bg-destructive/10 text-destructive border-destructive/25',
      dot: 'bg-destructive',
    }
  }
  if (status === 'partially_signed') {
    return {
      badge: 'secondary',
      chip: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25',
      dot: 'bg-amber-500',
    }
  }
  if (status === 'pending') {
    return {
      badge: 'outline',
      chip: 'bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/25',
      dot: 'bg-sky-500',
    }
  }
  return {
    badge: 'outline',
    chip: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground/50',
  }
}

export const ESIGN_SHELL =
  'relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/30 shadow-sm'

export const ESIGN_INSET =
  'rounded-xl border border-border/60 bg-background/70 backdrop-blur-sm'
