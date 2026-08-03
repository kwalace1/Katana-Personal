import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { Agent } from '@/lib/office/types'

/** Deterministic hue from a string so each agent gets a stable accent color. */
export function agentHue(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return h
}

export function AgentAvatar({
  agent,
  size = 'md',
  className,
}: {
  agent: Pick<Agent, 'id' | 'name' | 'emoji'> | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const initials = useMemo(() => {
    const name = agent?.name?.trim() || '?'
    const parts = name.split(/\s+/)
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase()
  }, [agent?.name])

  const hue = agentHue(agent?.id || agent?.name || 'agent')
  const sizeClass = size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-9 w-9 text-xs'

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold select-none ring-1',
        sizeClass,
        className,
      )}
      style={{
        backgroundColor: `hsl(${hue} 55% 45% / 0.15)`,
        color: `hsl(${hue} 60% 45%)`,
        borderColor: 'transparent',
        boxShadow: `inset 0 0 0 1px hsl(${hue} 55% 50% / 0.3)`,
      }}
    >
      {agent?.emoji ? <span className="text-sm leading-none">{agent.emoji}</span> : initials}
    </div>
  )
}
