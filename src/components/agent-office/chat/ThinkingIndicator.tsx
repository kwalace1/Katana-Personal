import { useState } from 'react'
import { motion } from 'framer-motion'
import { Brain, ChevronRight, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

type Phase = 'queued' | 'connecting' | 'thinking' | 'tool' | 'responding'

const PHASE_LABEL: Record<Exclude<Phase, 'responding'>, string> = {
  queued: 'Queued',
  connecting: 'Connecting',
  thinking: 'Thinking',
  tool: 'Working',
}

function Dots() {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1 w-1 rounded-full bg-primary"
          style={{ animation: `office-dot-bounce 1.2s ${i * 0.15}s infinite ease-in-out` }}
        />
      ))}
    </span>
  )
}

/** Live status row shown while the agent works, before text starts streaming.
 * Deliberately generic — it never surfaces the raw tool name (spawn_subagent,
 * execute_sql, …); the tool phase reads simply as "Working". */
export function ThinkingIndicator({
  phase,
  thinkingText,
}: {
  phase: Phase
  thinkingText?: string
}) {
  const [expanded, setExpanded] = useState(false)
  if (phase === 'responding') return null

  const label = PHASE_LABEL[phase]
  const hasThinking = phase === 'thinking' && Boolean(thinkingText?.trim())

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-1"
    >
      <button
        type="button"
        onClick={() => hasThinking && setExpanded((e) => !e)}
        className={cn(
          'inline-flex items-center gap-2 self-start rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm',
          hasThinking && 'hover:bg-muted/50 cursor-pointer',
        )}
      >
        {phase === 'tool' ? (
          <Wrench className="h-3 w-3 text-info" />
        ) : (
          <Brain className="h-3 w-3 text-primary" />
        )}
        <span>{label}</span>
        <Dots />
        {hasThinking && (
          <ChevronRight className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')} />
        )}
      </button>
      {hasThinking && (
        <div
          className={cn(
            'max-w-xl rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap',
            !expanded && 'line-clamp-2',
          )}
        >
          {thinkingText}
        </div>
      )}
    </motion.div>
  )
}
