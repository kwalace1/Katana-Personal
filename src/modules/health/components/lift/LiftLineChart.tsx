/** Shared SVG line chart for lift progress / bodyweight (tracker parity). */
export function LiftLineChart({
  data,
  label,
  unit = 'lb',
}: {
  data: { date: string; value: number; target?: number | null }[]
  label: string
  unit?: string
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground">
        No data yet for this selection.
      </div>
    )
  }

  const width = 900
  const height = 270
  const pad = { left: 48, right: 20, top: 20, bottom: 36 }
  const values = data.flatMap((item) => [item.value, item.target].filter((value): value is number => Number.isFinite(value)))
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) {
    min = min * 0.9 || 0
    max = max * 1.1 || 1
  }
  const range = max - min
  min = Math.max(0, min - range * 0.12)
  max += range * 0.12
  const innerWidth = width - pad.left - pad.right
  const innerHeight = height - pad.top - pad.bottom
  const x = (index: number) =>
    pad.left + (data.length === 1 ? innerWidth / 2 : (index * innerWidth) / (data.length - 1))
  const y = (value: number) => pad.top + ((max - value) * innerHeight) / (max - min)
  const points = data.map((item, index) => `${x(index)},${y(item.value)}`).join(' ')
  const areaPoints = `${pad.left},${height - pad.bottom} ${points} ${x(data.length - 1)},${height - pad.bottom}`
  const goalPoints = data
    .map((item, index) => (Number.isFinite(item.target) ? `${x(index)},${y(Number(item.target))}` : null))
    .filter((point): point is string => Boolean(point))
    .join(' ')

  return (
    <div className="w-full overflow-x-auto" aria-label={`${label} graph`}>
      <svg className="h-auto w-full min-w-[280px]" viewBox={`0 0 ${width} ${height}`} role="img">
        <defs>
          <linearGradient id="liftChartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((step) => {
          const gridY = pad.top + (innerHeight * step) / 4
          const value = max - ((max - min) * step) / 4
          return (
            <g key={step}>
              <line
                x1={pad.left}
                y1={gridY}
                x2={width - pad.right}
                y2={gridY}
                stroke="hsl(var(--border))"
                strokeWidth={1}
              />
              <text x={4} y={gridY + 4} className="fill-muted-foreground" style={{ fontSize: 11 }}>
                {Math.round(value).toLocaleString()}
              </text>
            </g>
          )
        })}
        <polygon points={areaPoints} fill="url(#liftChartGradient)" />
        {goalPoints ? (
          <polyline
            points={goalPoints}
            fill="none"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={2}
            strokeDasharray="7 6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        <polyline
          points={points}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((item, index) => {
          const show =
            data.length <= 6 ||
            index === 0 ||
            index === data.length - 1 ||
            index % Math.ceil(data.length / 5) === 0
          return (
            <g key={`${item.date}-${index}`}>
              <circle cx={x(index)} cy={y(item.value)} r={5} fill="hsl(var(--primary))">
                <title>
                  {formatChartDate(item.date)}: {Math.round(item.value)} {unit}
                </title>
              </circle>
              {show ? (
                <text
                  textAnchor="middle"
                  x={x(index)}
                  y={height - 10}
                  className="fill-muted-foreground"
                  style={{ fontSize: 11 }}
                >
                  {formatChartDate(item.date)}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function formatChartDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatLiftDate(iso: string) {
  if (!iso) return '—'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
