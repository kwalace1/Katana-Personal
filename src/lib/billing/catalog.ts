/** Store product IDs and the Plus entitlement — keep these identical in App Store Connect + RevenueCat. */

export const PLUS_ENTITLEMENT_ID = 'plus'

/** App Store Connect product id (auto-renewable, monthly). */
export const PLUS_PRODUCT_MONTHLY = 'katana_plus_monthly'

/** App Store Connect product id (auto-renewable, yearly). */
export const PLUS_PRODUCT_YEARLY = 'katana_plus_yearly'

/** Subscription group name in App Store Connect. */
export const PLUS_SUBSCRIPTION_GROUP = 'Katana Plus'

export const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions'

export const DEFAULT_NATIVE_APP_URL = 'https://katana-personal.vercel.app'

export type EntitlementInfoLike = {
  entitlements?: {
    active?: Record<string, unknown>
  }
}

export function customerHasPlus(info: EntitlementInfoLike | null | undefined): boolean {
  return Boolean(info?.entitlements?.active?.[PLUS_ENTITLEMENT_ID])
}

export type StorePackageLike = {
  identifier: string
  packageType?: string
  product: {
    identifier: string
    priceString: string
    title?: string
    description?: string
  }
}

export type OfferingLike<T extends StorePackageLike = StorePackageLike> = {
  availablePackages: T[]
  annual?: T | null
  monthly?: T | null
}

/** Prefer yearly, then monthly, then whatever the current offering has. */
export function preferredPlusPackage<T extends StorePackageLike>(
  offering: OfferingLike<T> | null | undefined,
): T | null {
  if (!offering) return null
  if (offering.annual) return offering.annual
  if (offering.monthly) return offering.monthly
  return offering.availablePackages[0] ?? null
}

export function isPurchaseCancelled(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as Record<string, unknown>
  if (e.userCancelled === true) return true
  const code = String(e.code ?? '')
  if (code === '1' || code === 'PURCHASE_CANCELLED_ERROR') return true
  const nested = e.error
  if (nested && typeof nested === 'object') {
    const n = nested as Record<string, unknown>
    if (n.userCancelled === true) return true
    const nestedCode = String(n.code ?? '')
    if (nestedCode === '1' || nestedCode === 'PURCHASE_CANCELLED_ERROR') return true
  }
  const msg = String(e.message ?? e.errorMessage ?? '').toLowerCase()
  return msg.includes('cancelled') || msg.includes('canceled')
}
