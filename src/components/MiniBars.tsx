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
  return <LineSparkline values={moods} fixedMax={4} />
}

/** Simple line chart for progress / body-weight series. */
export function LineSparkline({
  values,
  width = 280,
  height = 72,
  fixedMax,
  target,
}: {
  values: number[]
  width?: number
  height?: number
  fixedMax?: number
  /** Optional horizontal target line */
  target?: number
}) {
  if (values.length === 0) return null
  const min = Math.min(...values, target ?? Infinity)
  const maxRaw = Math.max(...values, target ?? -Infinity, fixedMax ?? 0)
  const span = Math.max(maxRaw - min, 1)
  const pad = 4
  const step = values.length > 1 ? width / (values.length - 1) : width
  const yFor = (v: number) => height - ((v - min) / span) * (height - pad * 2) - pad
  const points = values.map((v, i) => `${i * step},${yFor(v)}`).join(' ')
  return (
    <svg width={width} height={height} className="max-w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {target != null && Number.isFinite(target) ? (
        <line
          x1={0}
          x2={width}
          y1={yFor(target)}
          y2={yFor(target)}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth="1"
          strokeDasharray="4 3"
          opacity={0.5}
        />
      ) : null}
      <polyline
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {values.map((v, i) => (
        <circle key={i} cx={i * step} cy={yFor(v)} r={2.5} fill="hsl(var(--primary))" />
      ))}
    </svg>
  )
}
