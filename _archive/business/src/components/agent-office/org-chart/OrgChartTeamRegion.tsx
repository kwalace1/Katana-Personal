import { memo } from 'react'

/**
 * Translucent rounded region grouping a team's nodes, tinted with the team's
 * stored color (user data — applied via color-mix so it adapts to theme).
 */
export const OrgChartTeamRegion = memo(function OrgChartTeamRegion({
  label,
  color,
  minX,
  minY,
  maxX,
  maxY,
}: {
  label: string
  color: string | null
  minX: number
  minY: number
  maxX: number
  maxY: number
}) {
  const pad = 24
  const tint = color || 'hsl(var(--primary))'
  return (
    <div
      className="absolute rounded-2xl border pointer-events-none"
      style={{
        transform: `translate(${minX - pad}px, ${minY - pad - 14}px)`,
        width: maxX - minX + pad * 2,
        height: maxY - minY + pad * 2 + 14,
        background: `color-mix(in srgb, ${tint} 7%, transparent)`,
        borderColor: `color-mix(in srgb, ${tint} 28%, transparent)`,
      }}
    >
      <span
        className="absolute left-3 top-2 rounded-full border px-2 py-0.5 text-[10px] font-medium"
        style={{
          background: `color-mix(in srgb, ${tint} 14%, hsl(var(--card)))`,
          borderColor: `color-mix(in srgb, ${tint} 35%, transparent)`,
          color: `color-mix(in srgb, ${tint} 80%, hsl(var(--foreground)))`,
        }}
      >
        {label}
      </span>
    </div>
  )
})
