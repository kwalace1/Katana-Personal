import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Globe, Loader2, RefreshCw, ExternalLink, Newspaper } from 'lucide-react'
import type { Client } from '@/lib/customer-success-api'
import { refreshClientExternalEnrichment, getClientExternalEnrichment } from '@/lib/kyc-enrichment-api'
import { KycSignalBadges } from '@/components/customers/KycSignalBadges'
import { useToast } from '@/hooks/use-toast'

interface KycExternalEnrichmentPanelProps {
  client: Client
  onRefreshed?: () => void
  embedded?: boolean
}

export function KycExternalEnrichmentPanel({ client, onRefreshed, embedded }: KycExternalEnrichmentPanelProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [signals, setSignals] = useState<Record<string, unknown>>({})
  const [enrichment, setEnrichment] = useState<Record<string, unknown>>({})
  const [lastRefresh, setLastRefresh] = useState<string | null>(null)

  const loadStored = async () => {
    setLoading(true)
    const stored = await getClientExternalEnrichment(client.id)
    setSignals(stored.external_signals)
    setEnrichment(stored.enrichment)
    setLastRefresh(stored.last_external_refresh_at)
    setLoading(false)
  }

  useEffect(() => {
    void loadStored()
  }, [client.id])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const result = await refreshClientExternalEnrichment(client)
      setSignals(result.external_signals)
      setEnrichment(result.enrichment)
      setLastRefresh(result.payload.fetched_at)
      onRefreshed?.()
      toast({
        title: 'External enrichment updated',
        description:
          result.payload.errors.length > 0
            ? `Partial refresh: ${result.payload.errors.join('; ')}`
            : `Found ${Object.values(result.external_signals).filter((v) => v === true).length} external signals`,
      })
    } catch (e) {
      toast({
        title: 'Enrichment failed',
        description: e instanceof Error ? e.message : 'Could not fetch external data',
        variant: 'destructive',
      })
    } finally {
      setRefreshing(false)
    }
  }

  const headlines = (enrichment.news_headlines as Array<{ title: string; url?: string; date?: string }>) ?? []
  const registry = enrichment.registry as Record<string, unknown> | null | undefined

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading external intelligence…
      </div>
    )
  }

  const content = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!embedded && (
          <div>
            <p className="text-xs text-muted-foreground">
              OpenCorporates registry + GDELT news ·{' '}
              {lastRefresh ? `Last refresh ${new Date(lastRefresh).toLocaleString()}` : 'Not refreshed yet'}
            </p>
          </div>
        )}
        {embedded && (
          <p className="text-xs text-muted-foreground flex-1">
            OpenCorporates + GDELT ·{' '}
            {lastRefresh ? `Updated ${new Date(lastRefresh).toLocaleDateString()}` : 'Not refreshed yet'}
          </p>
        )}
        <Button size="sm" variant="outline" onClick={() => void handleRefresh()} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
          )}
          Refresh
        </Button>
      </div>

      <KycSignalBadges signals={signals} maxVisible={8} />

      {registry && (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Corporate registry</p>
          <p className="font-medium">{String(registry.company_name ?? '')}</p>
          <p className="text-sm text-muted-foreground">
            {String(registry.jurisdiction ?? '')} · {String(registry.status ?? 'Unknown status')}
          </p>
          {registry.url ? (
            <a
              href={String(registry.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View registry <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      )}

      {headlines.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Newspaper className="h-3.5 w-3.5" />
            Recent headlines
          </p>
          <ul className="space-y-2">
            {headlines.slice(0, 4).map((h, i) => (
              <li key={i} className="rounded-lg border bg-card px-3 py-2 text-sm">
                {h.url ? (
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:text-primary transition-colors line-clamp-2"
                  >
                    {h.title}
                  </a>
                ) : (
                  <span className="line-clamp-2">{h.title}</span>
                )}
                {h.date ? (
                  <Badge variant="outline" className="mt-1.5 text-[10px]">{h.date}</Badge>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {Object.keys(signals).length === 0 && !registry && headlines.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No external signals yet. Refresh to search corporate registry and news for this account.
        </p>
      )}
    </div>
  )

  if (embedded) return content

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          External enrichment
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">{content}</CardContent>
    </Card>
  )
}
