export function MiniBars({
  values,
  label,
  maxHint,
}: {
  values: number[]
  label: string
  maxHint?: number
}) {
  const max = Math.max(maxHint ?? 0, ...values, 1)
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex h-16 items-end gap-1">
        {values.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm bg-primary/70 transition-all"
            style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
            title={String(v)}
          />
        ))}
      </div>
    </div>
  )
}

export function MoodSparkline({ moods }: { moods: number[] }) {
  if (moods.length === 0) return null
  const w = 160
  const h = 36
  const max = 4
  const step = moods.length > 1 ? w / (moods.length - 1) : w
  const points = moods
    .map((m, i) => {
      const x = i * step
      const y = h - (m / max) * (h - 4) - 2
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden>
      <polyline
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}
