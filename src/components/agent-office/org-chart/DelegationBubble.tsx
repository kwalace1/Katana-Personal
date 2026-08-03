import { memo } from 'react'
import { ArrowRight } from 'lucide-react'
import type { NodeBubbleState } from '@/hooks/office/use-delegation-edge-state'
import { NODE_W } from './OrgChartNode'

const TONE_VAR: Record<NodeBubbleState['color'], string> = {
  indigo: 'var(--primary)',
  emerald: 'var(--office-success)',
  red: 'var(--destructive)',
}

/**
 * Speech bubble above a worker node while a delegation is in flight —
 * pops in, holds, then fades (delegationBubbleFade keyframe).
 */
export const DelegationBubble = memo(function DelegationBubble({
  bubble,
  x,
  y,
}: {
  bubble: NodeBubbleState
  x: number
  y: number
}) {
  const tone = TONE_VAR[bubble.color]
  const text = bubble.result || bubble.task
  if (!text) return null
  return (
    <div
      className="absolute z-20 pointer-events-none"
      style={{
        transform: `translate(${x + NODE_W / 2}px, ${y}px) translate(-50%, -100%)`,
        animation: 'delegationBubbleFade 6s ease-in-out forwards',
        paddingBottom: 8,
      }}
    >
      <div
        className="w-56 rounded-xl border bg-card px-3 py-2 shadow-lg"
        style={{ borderColor: `hsl(${tone} / 0.4)` }}
      >
        <div className="flex items-center gap-1 text-[9px] font-medium" style={{ color: `hsl(${tone})` }}>
          <span className="truncate">{bubble.senderAgent.name}</span>
          <ArrowRight className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{bubble.receiverAgent.name}</span>
        </div>
        <p className="mt-1 line-clamp-3 text-[10px] leading-snug text-muted-foreground">{text}</p>
      </div>
      <div
        className="mx-auto h-2 w-2 -translate-y-1 rotate-45 border-b border-r bg-card"
        style={{ borderColor: `hsl(${tone} / 0.4)` }}
      />
    </div>
  )
})
