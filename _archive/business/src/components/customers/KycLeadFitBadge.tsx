interface KycLeadFitBadgeProps {
  fitPercent: number
  className?: string
}

export function KycLeadFitBadge({ fitPercent, className = '' }: KycLeadFitBadgeProps) {
  const clamped = Math.min(100, Math.max(0, fitPercent))
  const color =
    clamped >= 70 ? 'text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10' :
    clamped >= 40 ? 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10' :
    'text-muted-foreground border-border bg-muted/30'

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold tabular-nums ${color} ${className}`}
      title="ICP fit score"
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          clamped >= 70 ? 'bg-green-500' : clamped >= 40 ? 'bg-amber-500' : 'bg-muted-foreground'
        }`}
      />
      {clamped}% fit
    </span>
  )
}

export function KycFitMeter({ fitPercent, size = 'md' }: { fitPercent: number; size?: 'sm' | 'md' }) {
  const clamped = Math.min(100, Math.max(0, fitPercent))
  const barColor = clamped >= 70 ? 'bg-green-500' : clamped >= 40 ? 'bg-amber-500' : 'bg-muted-foreground'
  const height = size === 'sm' ? 'h-1.5' : 'h-2'

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className={`flex-1 rounded-full bg-muted overflow-hidden ${height}`}>
        <div
          className={`${height} rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums w-8">{clamped}%</span>
    </div>
  )
}
