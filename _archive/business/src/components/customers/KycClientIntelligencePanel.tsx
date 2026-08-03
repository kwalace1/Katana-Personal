import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Client } from '@/lib/customer-success-api'
import {
  getAccountWorkspaceData,
  updateClientOutreachStatus,
  type ClientIntelligenceResult,
  type KycOutreachStatus,
  type KycAccountWorkspaceData,
} from '@/lib/kyc-api'
import { buildTemplateClientSummary, buildKycSummaryContext, type KycSummarySource } from '@/lib/kyc-client-summary'
import { generateClientExecutiveSummary } from '@/lib/kyc-summary-api'
import { KycAccountWorkspace } from '@/components/customers/KycAccountWorkspace'
import { KycOutreachSelector } from '@/components/customers/KycOutreachSelector'
import { useToast } from '@/hooks/use-toast'

interface KycClientIntelligencePanelProps {
  client: Client
  onClientUpdated?: () => void
}

export function KycClientIntelligencePanel({ client, onClientUpdated }: KycClientIntelligencePanelProps) {
  const { toast } = useToast()
  const [workspace, setWorkspace] = useState<KycAccountWorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [outreachStatus, setOutreachStatus] = useState<KycOutreachStatus>(
    (client.outreach_status as KycOutreachStatus) ?? 'none',
  )
  const [savingOutreach, setSavingOutreach] = useState(false)
  const [summary, setSummary] = useState('')
  const [summarySource, setSummarySource] = useState<KycSummarySource>('template')
  const [summaryGeneratedAt, setSummaryGeneratedAt] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryRefreshing, setSummaryRefreshing] = useState(false)

  const loadWorkspace = useCallback(async () => {
    setLoading(true)
    const data = await getAccountWorkspaceData(client)
    setWorkspace(data)
    setLoading(false)
    return data
  }, [client])

  const loadSummary = useCallback(
    async (intelResult: ClientIntelligenceResult, options?: { force?: boolean }) => {
      setSummaryLoading(!options?.force)
      setSummaryRefreshing(Boolean(options?.force))
      try {
        const result = await generateClientExecutiveSummary(client, intelResult, {
          preferAi: true,
          force: options?.force,
        })
        setSummary(result.summary)
        setSummarySource(result.source)
        setSummaryGeneratedAt(result.generated_at)
      } catch {
        setSummary(buildTemplateClientSummary(buildKycSummaryContext(client, intelResult)))
        setSummarySource('template')
        setSummaryGeneratedAt(null)
      } finally {
        setSummaryLoading(false)
        setSummaryRefreshing(false)
      }
    },
    [client],
  )

  useEffect(() => {
    void (async () => {
      const data = await loadWorkspace()
      const instant = buildTemplateClientSummary(buildKycSummaryContext(client, data.intel))
      setSummary(instant)
      setSummarySource('template')
      void loadSummary(data.intel)
    })()
    setOutreachStatus((client.outreach_status as KycOutreachStatus) ?? 'none')
  }, [client, loadWorkspace, loadSummary])

  const handleOutreachChange = async (value: string) => {
    const next = value as KycOutreachStatus
    setOutreachStatus(next)
    setSavingOutreach(true)
    const ok = await updateClientOutreachStatus(client.id, next)
    setSavingOutreach(false)
    if (ok) {
      toast({ title: 'Outreach play updated' })
      onClientUpdated?.()
    } else {
      toast({
        title: 'Could not update outreach status',
        description: 'Run supabase-kyc-migration.sql if outreach_status column is missing.',
        variant: 'destructive',
      })
      setOutreachStatus((client.outreach_status as KycOutreachStatus) ?? 'none')
    }
  }

  const handleRefresh = () => {
    void loadWorkspace().then((data) => {
      if (data) void loadSummary(data.intel, { force: true })
    })
    onClientUpdated?.()
  }

  if (loading || !workspace) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center rounded-xl border bg-muted/20">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading customer intelligence…
      </div>
    )
  }

  return (
    <KycAccountWorkspace
      client={client}
      intel={workspace.intel}
      briefing={workspace.briefing}
      revenue={workspace.revenue}
      contacts={workspace.contacts}
      onRefresh={handleRefresh}
      onActionTaskCreated={handleRefresh}
      executiveSummary={{
        text: summary,
        source: summarySource,
        loading: summaryLoading && !summary,
        refreshing: summaryRefreshing,
        generatedAt: summaryGeneratedAt,
        onRefresh: () => void loadSummary(workspace.intel, { force: true }),
      }}
      outreachSlot={
        <KycOutreachSelector
          mode="client"
          value={outreachStatus}
          onChange={(v) => void handleOutreachChange(v)}
          disabled={savingOutreach}
        />
      }
    />
  )
}
