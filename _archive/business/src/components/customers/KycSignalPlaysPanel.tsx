import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Radio } from 'lucide-react'
import type { KycSignalPlay } from '@/lib/kyc-signal-plays'
import { cn } from '@/lib/utils'

interface KycSignalPlaysPanelProps {
  plays: KycSignalPlay[]
  compact?: boolean
}

function sentimentBorder(sentiment: KycSignalPlay['sentiment']): string {
  if (sentiment === 'positive') return 'border-l-green-500'
  if (sentiment === 'negative') return 'border-l-red-500'
  return 'border-l-amber-500'
}

export function KycSignalPlaysPanel({ plays, compact = false }: KycSignalPlaysPanelProps) {
  if (plays.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No active signals with recommended plays — account looks stable from available data.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            Signal → meaning → play
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Each play is tied to a real signal from this account — no invented opportunities.
          </p>
        </div>
      )}
      {plays.map((play) => (
        <Card key={play.id} className={cn('border-l-4', sentimentBorder(play.sentiment))}>
          <CardHeader className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-sm font-medium">{play.signal_label}</CardTitle>
              <Badge variant="outline" className="text-[10px] h-5 capitalize">
                {play.category}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 space-y-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Meaning</p>
              <p className="text-sm text-muted-foreground">{play.meaning}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recommended play</p>
              <p className="text-sm flex items-start gap-2">
                <ArrowRight className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                {play.recommended_play}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
