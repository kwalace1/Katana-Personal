import { memo } from 'react'
import { Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Agent } from '@/lib/office/types'
import { AgentAvatar } from '../chat/AgentAvatar'

export const NODE_W = 210
export const NODE_H = 96

export type DelegationTone = 'indigo' | 'emerald' | 'red' | null

const TONE_VAR: Record<Exclude<DelegationTone, null>, string> = {
  indigo: 'var(--primary)',
  emerald: 'var(--office-success)',
  red: 'var(--destructive)',
}

/** A single agent card on the org chart canvas. */
export const OrgChartNode = memo(function OrgChartNode({
  agent,
  x,
  y,
  running,
  selected,
  dragging,
  dropTarget,
  dropInvalid,
  delegationTone,
  onPointerDown,
  onClick,
  onDoubleClick,
}: {
  agent: Agent
  x: number
  y: number
  running: boolean
  selected: boolean
  dragging: boolean
  dropTarget: boolean
  dropInvalid: boolean
  delegationTone: DelegationTone
  onPointerDown: (e: React.PointerEvent) => void
  onClick: () => void
  onDoubleClick: () => void
}) {
  const glow = delegationTone
    ? {
        boxShadow: `0 0 0 1.5px hsl(${TONE_VAR[delegationTone]} / 0.55), 0 0 22px 2px hsl(${TONE_VAR[delegationTone]} / 0.35)`,
        animation: 'delegation-glow-pulse 1.6s ease-in-out infinite',
      }
    : undefined

  return (
    <div
      className={cn(
        'absolute select-none rounded-xl border bg-card p-3 transition-shadow duration-150',
        'border-border/60 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing',
        selected && 'ring-2 ring-primary border-primary/50',
        dragging && 'z-30 scale-105 shadow-xl opacity-90',
        dropTarget && !dropInvalid && 'ring-2 ring-success border-success/50',
        dropTarget && dropInvalid && 'ring-2 ring-destructive border-destructive/50',
      )}
      style={{
        left: 0,
        top: 0,
        width: NODE_W,
        height: NODE_H,
        transform: `translate(${x}px, ${y}px)${dragging ? ' scale(1.05)' : ''}`,
        ...glow,
      }}
      onPointerDown={onPointerDown}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
    >
      <div className="flex items-start gap-2.5">
        <div className="relative">
          <AgentAvatar agent={agent} size="md" />
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card',
              running ? 'bg-success animate-pulse' : 'bg-muted-foreground/40',
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-xs font-semibold">{agent.name}</span>
            {agent.role === 'coordinator' && (
              <Crown className="h-3 w-3 shrink-0 text-warning" aria-label="Coordinator" />
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
            {agent.description || agent.model}
          </p>
        </div>
      </div>
      <div className="absolute bottom-2 left-3 right-3 flex items-center gap-1.5">
        <span className="truncate rounded bg-muted/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
          {agent.model}
        </span>
        {(agent.delegationTargetAgentIds?.length ?? 0) > 0 && (
          <span className="ml-auto shrink-0 text-[9px] text-muted-foreground">
            →{agent.delegationTargetAgentIds!.length}
          </span>
        )}
      </div>
    </div>
  )
})
