import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { KycHealthGauge, healthScoreColor } from '@/components/customers/KycUi'
import type { HealthBreakdownItem } from '@/lib/kyc-client-scoring'
import { cn } from '@/lib/utils'

interface KycScoreBreakdownProps {
  healthScore: number
  breakdown: HealthBreakdownItem[]
  attentionScore?: number
  compact?: boolean
}

function sentimentClass(sentiment: HealthBreakdownItem['sentiment']): string {
  if (sentiment === 'positive') return 'text-green-600 dark:text-green-400'
  if (sentiment === 'negative') return 'text-red-600 dark:text-red-400'
  return 'text-muted-foreground'
}

function progressIndicatorClass(sentiment: HealthBreakdownItem['sentiment']): string {
  if (sentiment === 'positive') return '[&>div]:bg-green-500'
  if (sentiment === 'negative') return '[&>div]:bg-red-500'
  return '[&>div]:bg-amber-500'
}

export function KycScoreBreakdown({
  healthScore,
  breakdown,
  attentionScore,
  compact = false,
}: KycScoreBreakdownProps) {
  const [expanded, setExpanded] = useState(!compact)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <KycHealthGauge score={healthScore} size={compact ? 'sm' : 'md'} label="Health" />
        {attentionScore != null && (
          <div className="flex-1 rounded-xl border bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">Attention priority</p>
            <p className={cn('text-2xl font-bold tabular-nums', attentionScore >= 30 ? 'text-red-600 dark:text-red-400' : attentionScore >= 15 ? 'text-amber-600 dark:text-amber-400' : healthScoreColor(healthScore))}>
              {attentionScore}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {attentionScore >= 30 ? 'Act now' : attentionScore >= 15 ? 'Monitor closely' : 'Low urgency'}
            </p>
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          className="flex w-full items-center justify-between text-sm font-medium hover:text-primary transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          Score breakdown
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        </button>

        {expanded && (
          <div className="space-y-3 mt-3">
            {breakdown.map((item) => (
              <div key={item.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={`font-medium tabular-nums ${sentimentClass(item.sentiment)}`}>
                    +{item.contribution}
                  </span>
                </div>
                <Progress
                  value={item.component_score}
                  className={cn('h-1.5 bg-muted', progressIndicatorClass(item.sentiment))}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
