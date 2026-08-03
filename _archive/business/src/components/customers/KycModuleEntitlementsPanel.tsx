/**
 * Manage Katana product module entitlements per customer account.
 */

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getClientModuleEntitlements,
  listProductModules,
  setClientModuleEntitlement,
  syncInferredModuleEntitlements,
} from '@/lib/kyc-api'
import type { Client } from '@/lib/customer-success-api'
import type { ClientIntelligenceResult } from '@/lib/kyc-client-scoring'
import { Loader2, Package } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface KycModuleEntitlementsPanelProps {
  client: Client
  intel?: ClientIntelligenceResult | null
}

export function KycModuleEntitlementsPanel({ client, intel }: KycModuleEntitlementsPanelProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modules, setModules] = useState<{ id: string; label: string; monthly_price: number }[]>([])
  const [entitled, setEntitled] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const [catalog, rows] = await Promise.all([
      listProductModules(),
      getClientModuleEntitlements(client.id),
    ])
    setModules(catalog)
    setEntitled(
      new Set(rows.filter((r) => r.status === 'active' || r.status === 'trial').map((r) => r.module_id)),
    )
    setLoading(false)
  }, [client.id])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = async (moduleId: string) => {
    setSaving(true)
    const next = new Set(entitled)
    if (next.has(moduleId)) next.delete(moduleId)
    else next.add(moduleId)
    setEntitled(next)
    const ok = await setClientModuleEntitlement(
      client.id,
      moduleId,
      next.has(moduleId) ? 'active' : 'churned',
    )
    setSaving(false)
    if (!ok) {
      toast({ title: 'Could not update module', variant: 'destructive' })
      void load()
    }
  }

  const inferFromUsage = async () => {
    if (!intel) return
    setSaving(true)
    const count = await syncInferredModuleEntitlements(client.id, intel)
    await load()
    setSaving(false)
    toast({
      title: count > 0 ? 'Modules synced from usage' : 'No new modules detected',
      description:
        count > 0
          ? `${count} entitlement${count === 1 ? '' : 's'} updated from account activity.`
          : 'Entitlements already match detected usage.',
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Product modules
          </CardTitle>
          {intel && (
            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void inferFromUsage()}>
              Sync from usage
            </Button>
          )}
        </div>
        <CardDescription>Track purchased modules for expansion estimates and adoption intel.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {modules.length === 0 ? (
          <p className="text-sm text-muted-foreground">Module catalog not available. Run intelligence expansion migration.</p>
        ) : (
          modules.map((mod) => {
            const active = entitled.has(mod.id)
            return (
              <button
                key={mod.id}
                type="button"
                disabled={saving}
                onClick={() => void toggle(mod.id)}
                className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50 disabled:opacity-60"
              >
                <span>{mod.label}</span>
                <Badge variant={active ? 'default' : 'outline'}>{active ? 'Active' : 'Not purchased'}</Badge>
              </button>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
