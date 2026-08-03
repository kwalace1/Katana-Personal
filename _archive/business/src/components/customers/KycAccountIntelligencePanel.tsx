import type { Client } from '@/lib/customer-success-api'
import type { ClientIntelligenceResult } from '@/lib/kyc-client-scoring'
import { KycSignalBadges } from '@/components/customers/KycSignalBadges'
import { KycSignalPlaysPanel } from '@/components/customers/KycSignalPlaysPanel'
import { KycExternalEnrichmentPanel } from '@/components/customers/KycExternalEnrichmentPanel'
import { KycClientIntelEditor } from '@/components/customers/KycClientIntelEditor'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Brain, ThumbsDown, ThumbsUp } from 'lucide-react'

interface KycAccountIntelligencePanelProps {
  client: Client
  intel: ClientIntelligenceResult
  onRefreshed?: () => void
}

export function KycAccountIntelligencePanel({ client, intel, onRefreshed }: KycAccountIntelligencePanelProps) {
  const externalPlays = intel.signal_plays.filter((p) => p.category === 'external')
  const internalPlays = intel.signal_plays.filter((p) => p.category === 'internal')

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Active internal signals</CardTitle>
        </CardHeader>
        <CardContent>
          {intel.top_signals.length > 0 ? (
            <KycSignalBadges keys={intel.top_signals} />
          ) : (
            <p className="text-sm text-muted-foreground">No risk or opportunity signals active.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-green-600">
              <ThumbsUp className="h-4 w-4" />
              Positive factors
            </CardTitle>
          </CardHeader>
          <CardContent>
            {intel.health_reasoning.positive.length > 0 ? (
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {intel.health_reasoning.positive.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No strong positive factors detected yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-600">
              <ThumbsDown className="h-4 w-4" />
              Negative factors
            </CardTitle>
          </CardHeader>
          <CardContent>
            {intel.health_reasoning.negative.length > 0 ? (
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {intel.health_reasoning.negative.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No negative health factors flagged.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          Internal signal plays
        </h3>
        <KycSignalPlaysPanel plays={internalPlays} compact />
      </div>

      {externalPlays.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">External signal plays</h3>
          <KycSignalPlaysPanel plays={externalPlays} compact />
        </div>
      )}

      <KycExternalEnrichmentPanel client={client} embedded onRefreshed={onRefreshed} />
      <KycClientIntelEditor clientId={client.id} embedded />
    </div>
  )
}
