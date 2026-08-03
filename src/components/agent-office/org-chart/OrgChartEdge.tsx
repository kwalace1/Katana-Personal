import { memo } from 'react'
import type { EdgeLiveState } from '@/hooks/office/use-delegation-edge-state'

const TONE_VAR: Record<EdgeLiveState['color'], string> = {
  indigo: 'var(--primary)',
  emerald: 'var(--office-success)',
  red: 'var(--destructive)',
}

/**
 * Bezier edge between a parent's bottom anchor and a child's top anchor.
 * During an active delegation the stroke brightens and dots travel along the
 * path (downstream while running, upstream when results come back).
 */
export const OrgChartEdge = memo(function OrgChartEdge({
  x1,
  y1,
  x2,
  y2,
  live,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  live: EdgeLiveState | null
}) {
  const midY = (y1 + y2) / 2
  const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
  const tone = live ? TONE_VAR[live.color] : null
  // Dots run parent→child while delegating, child→parent when reporting back.
  const reverse = live?.direction === 'up'

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={tone ? `hsl(${tone} / 0.8)` : 'hsl(var(--border))'}
        strokeWidth={live ? 2 : 1.5}
        style={live ? { filter: `drop-shadow(0 0 4px hsl(${tone} / 0.5))` } : undefined}
      />
      {live && (
        <>
          {[0, 1, 2].map((i) => (
            <circle key={i} r={3} fill={`hsl(${tone})`}>
              <animateMotion
                dur="1.8s"
                begin={`${i * 0.6}s`}
                repeatCount="indefinite"
                path={d}
                keyPoints={reverse ? '1;0' : '0;1'}
                keyTimes="0;1"
                calcMode="linear"
              />
            </circle>
          ))}
          {live.snippet && (
            <foreignObject
              x={(x1 + x2) / 2 - 90}
              y={midY - 14}
              width={180}
              height={30}
              style={{ overflow: 'visible', pointerEvents: 'none' }}
            >
              <div
                className="mx-auto w-fit max-w-[180px] truncate rounded-full border px-2 py-0.5 text-[9px] shadow-sm"
                style={{
                  animation: 'fadeInHold 6s ease-in-out forwards',
                  background: 'hsl(var(--card))',
                  borderColor: `hsl(${tone} / 0.4)`,
                  color: `hsl(${tone})`,
                }}
              >
                {live.snippet}
              </div>
            </foreignObject>
          )}
        </>
      )}
    </g>
  )
})
