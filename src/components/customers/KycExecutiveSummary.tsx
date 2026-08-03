import { Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { KycSummarySource } from '@/lib/kyc-client-summary'
import { cn } from '@/lib/utils'

interface KycExecutiveSummaryProps {
  summary: string
  source: KycSummarySource
  loading?: boolean
  refreshing?: boolean
  generatedAt?: string | null
  onRefresh?: () => void
}

function sourceLabel(source: KycSummarySource): string {
  switch (source) {
    case 'ai':
      return 'AI summary'
    case 'cached':
      return 'Cached summary'
    case 'template':
      return 'Data-driven summary'
    default:
      return 'Summary'
  }
}

function sourceBadgeClass(source: KycSummarySource): string {
  switch (source) {
    case 'ai':
      return 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'
    case 'cached':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
    case 'template':
      return 'bg-muted text-muted-foreground border-border'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

export function KycExecutiveSummary({
  summary,
  source,
  loading = false,
  refreshing = false,
  generatedAt,
  onRefresh,
}: KycExecutiveSummaryProps) {
  return (
    <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-card to-card">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            Executive summary
          </CardTitle>
          <div className="flex items-center gap-2">
            {!loading && (
              <Badge variant="outline" className={sourceBadgeClass(source)}>
                {sourceLabel(source)}
              </Badge>
            )}
            {onRefresh && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={onRefresh}
                disabled={loading || refreshing}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating summary from account data…
          </div>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-foreground/90">{summary}</p>
            {generatedAt && (
              <p className="text-[11px] text-muted-foreground mt-3">
                Generated {new Date(generatedAt).toLocaleString()}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
