/** RevenueCat / StoreKit billing for the Capacitor iOS shell. */

import {
  customerHasPlus,
  isPurchaseCancelled,
  preferredPlusPackage,
} from '@/lib/billing/catalog'
import { setPlusUnlocked } from '@/lib/plus'
import { isNativeShell } from '@/lib/native/platform'
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from '@revenuecat/purchases-capacitor'

export function revenueCatAppleApiKey(): string {
  return (import.meta.env.VITE_REVENUECAT_APPLE_API_KEY as string | undefined)?.trim() || ''
}

export function revenueCatConfigured(): boolean {
  return isNativeShell() && Boolean(revenueCatAppleApiKey())
}

let configured = false
let listenerId: string | null = null

function applyCustomerInfo(info: CustomerInfo | null | undefined) {
  setPlusUnlocked(customerHasPlus(info))
}

export async function initRevenueCat(): Promise<void> {
  if (!isNativeShell()) return
  const apiKey = revenueCatAppleApiKey()
  if (!apiKey) return
  if (configured) {
    await refreshPlusFromStore()
    return
  }

  const { Purchases, LOG_LEVEL } = await import('@revenuecat/purchases-capacitor')
  if (import.meta.env.DEV) {
    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG })
  }
  await Purchases.configure({ apiKey })
  configured = true

  if (!listenerId) {
    listenerId = await Purchases.addCustomerInfoUpdateListener((info) => {
      applyCustomerInfo(info)
    })
  }

  await refreshPlusFromStore()
}

export async function identifyRevenueCatUser(options: {
  appUserID: string
  email?: string | null
}): Promise<void> {
  if (!revenueCatConfigured()) return
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')
    if (!configured) await initRevenueCat()
    const { customerInfo } = await Purchases.logIn({ appUserID: options.appUserID })
    applyCustomerInfo(customerInfo)
    const email = options.email?.trim()
    if (email) {
      await Purchases.setEmail({ email })
    }
  } catch (err) {
    console.warn('RevenueCat identify failed', err)
  }
}

export async function refreshPlusFromStore(): Promise<boolean> {
  if (!revenueCatConfigured()) return false
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')
    if (!configured) await initRevenueCat()
    const { customerInfo } = await Purchases.getCustomerInfo()
    applyCustomerInfo(customerInfo)
    return customerHasPlus(customerInfo)
  } catch (err) {
    console.warn('RevenueCat customer info failed', err)
    return false
  }
}

function unwrapOfferings(result: unknown): PurchasesOffering | null {
  if (!result || typeof result !== 'object') return null
  const r = result as { current?: PurchasesOffering | null; offerings?: { current?: PurchasesOffering | null } }
  return r.current ?? r.offerings?.current ?? null
}

export async function loadPlusOffering(): Promise<PurchasesOffering | null> {
  if (!revenueCatConfigured()) return null
  const { Purchases } = await import('@revenuecat/purchases-capacitor')
  if (!configured) await initRevenueCat()
  const result = await Purchases.getOfferings()
  return unwrapOfferings(result)
}

export async function purchasePlusPackage(pkg: PurchasesPackage): Promise<{
  ok: boolean
  cancelled?: boolean
  error?: string
}> {
  if (!revenueCatConfigured()) {
    return { ok: false, error: 'App Store billing isn’t configured in this build.' }
  }
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')
    if (!configured) await initRevenueCat()
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg })
    applyCustomerInfo(customerInfo)
    if (!customerHasPlus(customerInfo)) {
      return { ok: false, error: 'Purchase finished, but Plus isn’t active yet. Try Restore purchases.' }
    }
    return { ok: true }
  } catch (err) {
    if (isPurchaseCancelled(err)) return { ok: false, cancelled: true }
    const message = err instanceof Error ? err.message : 'Purchase failed'
    return { ok: false, error: message }
  }
}

export async function purchasePreferredPlus(): Promise<{
  ok: boolean
  cancelled?: boolean
  error?: string
}> {
  try {
    const offering = await loadPlusOffering()
    const pkg = preferredPlusPackage(offering)
    if (!pkg) {
      return {
        ok: false,
        error: 'No Plus products are live yet. Create katana_plus_monthly in App Store Connect, attach them in RevenueCat, then rebuild.',
      }
    }
    return purchasePlusPackage(pkg)
  } catch (err) {
    if (isPurchaseCancelled(err)) return { ok: false, cancelled: true }
    const message = err instanceof Error ? err.message : 'Couldn’t load App Store products'
    return { ok: false, error: message }
  }
}

export async function restorePlusPurchases(): Promise<{ ok: boolean; plus: boolean; error?: string }> {
  if (!revenueCatConfigured()) {
    return { ok: false, plus: false, error: 'App Store billing isn’t configured in this build.' }
  }
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')
    if (!configured) await initRevenueCat()
    const { customerInfo } = await Purchases.restorePurchases()
    applyCustomerInfo(customerInfo)
    return { ok: true, plus: customerHasPlus(customerInfo) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Restore failed'
    return { ok: false, plus: false, error: message }
  }
}
