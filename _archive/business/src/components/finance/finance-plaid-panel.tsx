import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { usePlaidLink } from 'react-plaid-link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Link2, RefreshCw } from 'lucide-react'
import {
  exchangePlaidPublicToken,
  fetchPlaidLinkToken,
  getPlaidStatus,
  syncPlaidTransactions,
  type PlaidStatusResponse,
} from '@/lib/finance-plaid-client'

interface FinancePlaidPanelProps {
  onConnected: () => void
}

export function FinancePlaidPanel({ onConnected }: FinancePlaidPanelProps) {
  const [status, setStatus] = useState<PlaidStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const s = await getPlaidStatus()
      setStatus(s)
    } catch {
      setStatus({ configured: false, items: [] })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const prepareLink = async () => {
    try {
      const token = await fetchPlaidLinkToken()
      setLinkToken(token)
    } catch (err) {
      toast.error('Could not start bank linking', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const onSuccess = useCallback(
    async (publicToken: string) => {
      try {
        const result = await exchangePlaidPublicToken(publicToken)
        toast.success(`Linked ${result.accounts_linked} account(s)`)
        setLinkToken(null)
        await loadStatus()
        onConnected()
      } catch (err) {
        toast.error('Link failed', {
          description: err instanceof Error ? err.message : undefined,
        })
      }
    },
    [loadStatus, onConnected],
  )

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token) => void onSuccess(public_token),
    onExit: () => setLinkToken(null),
  })

  useEffect(() => {
    if (linkToken && ready) open()
  }, [linkToken, ready, open])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await syncPlaidTransactions()
      toast.success(`Synced ${result.added} new transaction(s)`, {
        description: result.skipped > 0 ? `${result.skipped} duplicates skipped` : undefined,
      })
      await loadStatus()
      onConnected()
    } catch (err) {
      toast.error('Sync failed', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!status?.configured) {
    return (
      <Card data-tour="finance-plaid">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Live bank feeds (Plaid)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Plaid is not configured on the server. Add <code className="text-xs">PLAID_CLIENT_ID</code>{' '}
            and <code className="text-xs">PLAID_SECRET</code> to your environment to enable live bank
            syncing. You can still import CSV/PDF statements manually.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-tour="finance-plaid">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          Live bank feeds (Plaid)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Securely connect your bank for automatic transaction sync. Credentials are never stored in
          Katana — only encrypted tokens via Plaid.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void prepareLink()} disabled={Boolean(linkToken)}>
            {linkToken ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
            Connect bank
          </Button>
          <Button variant="outline" onClick={handleSync} disabled={syncing || status.items.length === 0}>
            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sync now
          </Button>
        </div>
        {status.items.length > 0 && (
          <ul className="space-y-2 text-sm">
            {status.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 border rounded-lg p-3">
                <span>{item.institution_name ?? 'Connected institution'}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{item.status}</Badge>
                  {item.last_synced_at && (
                    <span className="text-xs text-muted-foreground">
                      Last sync {new Date(item.last_synced_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
