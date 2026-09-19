import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { APPLE_SUBSCRIPTIONS_URL, type StorePackageLike } from '@/lib/billing/catalog'
import {
  loadPlusOffering,
  purchasePlusPackage,
  restorePlusPurchases,
  revenueCatConfigured,
} from '@/lib/billing/revenuecat'
import type { PurchasesPackage } from '@revenuecat/purchases-capacitor'
import { Link } from 'react-router-dom'

type Props = {
  plus: boolean
}

function packageLabel(pkg: StorePackageLike) {
  const type = (pkg.packageType || '').toUpperCase()
  if (type === 'ANNUAL') return 'Yearly'
  if (type === 'MONTHLY') return 'Monthly'
  return pkg.product.title || pkg.identifier
}

export function NativePlusBilling({ plus }: Props) {
  const [packages, setPackages] = useState<PurchasesPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const configured = revenueCatConfigured()

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!configured) {
        setLoading(false)
        return
      }
      try {
        const offering = await loadPlusOffering()
        if (cancelled) return
        setPackages(offering?.availablePackages ?? [])
      } catch (err) {
        if (!cancelled) {
          console.warn('RevenueCat offerings failed', err)
          setPackages([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [configured])

  async function buy(pkg: PurchasesPackage) {
    setBusy(pkg.identifier)
    const result = await purchasePlusPackage(pkg)
    setBusy(null)
    if (result.cancelled) return
    if (result.ok) {
      toast.success('Welcome to Katana Plus')
      return
    }
    toast.error(result.error || 'Purchase failed')
  }

  async function restore() {
    setBusy('restore')
    const result = await restorePlusPurchases()
    setBusy(null)
    if (!result.ok) {
      toast.error(result.error || 'Restore failed')
      return
    }
    if (result.plus) toast.success('Plus restored')
    else toast.message('No Plus subscription found for this Apple ID')
  }

  if (!configured) {
    return (
      <p className="text-xs text-muted-foreground">
        App Store billing isn’t in this binary yet. Set{' '}
        <code className="text-[11px]">VITE_REVENUECAT_APPLE_API_KEY</code> and rebuild with{' '}
        <code className="text-[11px]">npm run build:ios</code>. See docs/APP_STORE.md.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {!plus ? (
        loading ? (
          <p className="text-xs text-muted-foreground">Loading App Store prices…</p>
        ) : packages.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Plus products aren’t live in App Store Connect yet. Create{' '}
            <code className="text-[11px]">katana_plus_monthly</code> and{' '}
            <code className="text-[11px]">katana_plus_yearly</code>, attach them to the{' '}
            <code className="text-[11px]">plus</code> entitlement in RevenueCat, then rebuild.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {packages.map((pkg) => (
              <Button
                key={pkg.identifier}
                type="button"
                className="min-h-11 w-full justify-between"
                disabled={Boolean(busy)}
                onClick={() => void buy(pkg)}
              >
                <span>Subscribe {packageLabel(pkg)}</span>
                <span>{pkg.product.priceString}</span>
              </Button>
            ))}
          </div>
        )
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" disabled={Boolean(busy)} onClick={() => void restore()}>
          Restore purchases
        </Button>
        {plus ? (
          <Button type="button" variant="outline" className="min-h-11" asChild>
            <a href={APPLE_SUBSCRIPTIONS_URL} target="_blank" rel="noreferrer">
              Manage subscription
            </a>
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Payment is charged to your Apple ID. Plus auto-renews unless you turn off auto-renew at least 24 hours
        before the current period ends. Manage or cancel in iPhone Settings → Apple ID → Subscriptions.
      </p>
      <p className="text-xs text-muted-foreground">
        <Link to="/settings/legal/privacy" className="text-primary underline-offset-2 hover:underline">
          Privacy Policy
        </Link>
        {' · '}
        <Link to="/settings/legal/terms" className="text-primary underline-offset-2 hover:underline">
          Terms
        </Link>
      </p>
    </div>
  )
}
