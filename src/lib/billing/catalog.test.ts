import { describe, expect, it } from 'vitest'
import {
  PLUS_ENTITLEMENT_ID,
  PLUS_PRODUCT_MONTHLY,
  PLUS_PRODUCT_YEARLY,
  customerHasPlus,
  isPurchaseCancelled,
  preferredPlusPackage,
} from './catalog'
import { resolveApiUrl } from '@/lib/api-origin'

describe('Plus store catalog', () => {
  it('uses stable product and entitlement ids for App Store Connect / RevenueCat', () => {
    expect(PLUS_ENTITLEMENT_ID).toBe('plus')
    expect(PLUS_PRODUCT_MONTHLY).toBe('katana_plus_monthly')
    expect(PLUS_PRODUCT_YEARLY).toBe('katana_plus_yearly')
  })

  it('unlocks Plus only when the plus entitlement is active', () => {
    expect(customerHasPlus({ entitlements: { active: { plus: { isActive: true } } } })).toBe(true)
    expect(customerHasPlus({ entitlements: { active: {} } })).toBe(false)
    expect(customerHasPlus(null)).toBe(false)
  })

  it('prefers yearly then monthly packages', () => {
    const monthly = {
      identifier: '$rc_monthly',
      packageType: 'MONTHLY',
      product: { identifier: PLUS_PRODUCT_MONTHLY, priceString: '$4.99' },
    }
    const yearly = {
      identifier: '$rc_annual',
      packageType: 'ANNUAL',
      product: { identifier: PLUS_PRODUCT_YEARLY, priceString: '$39.99' },
    }
    expect(
      preferredPlusPackage({
        availablePackages: [monthly, yearly],
        monthly,
        annual: yearly,
      })?.product.identifier,
    ).toBe(PLUS_PRODUCT_YEARLY)
    expect(
      preferredPlusPackage({
        availablePackages: [monthly],
        monthly,
        annual: null,
      })?.product.identifier,
    ).toBe(PLUS_PRODUCT_MONTHLY)
  })

  it('treats StoreKit cancel as a quiet cancel, not an error', () => {
    expect(isPurchaseCancelled({ userCancelled: true })).toBe(true)
    expect(isPurchaseCancelled({ code: '1' })).toBe(true)
    expect(isPurchaseCancelled({ message: 'Purchase was cancelled.' })).toBe(true)
    expect(isPurchaseCancelled({ message: 'StoreKit timed out' })).toBe(false)
  })
})

describe('native API origin', () => {
  it('rewrites Capacitor /api calls onto the production host', () => {
    expect(resolveApiUrl('/api/ask-llm', 'https://localhost', 'https://katana-personal.vercel.app')).toBe(
      'https://katana-personal.vercel.app/api/ask-llm',
    )
    expect(
      resolveApiUrl(
        'capacitor://localhost/api/food-search?q=oats',
        'capacitor://localhost',
        'https://katana-personal.vercel.app',
      ),
    ).toBe('https://katana-personal.vercel.app/api/food-search?q=oats')
  })

  it('leaves already-absolute production API urls alone', () => {
    const url = 'https://katana-personal.vercel.app/api/ask-llm'
    expect(resolveApiUrl(url, 'https://localhost', 'https://katana-personal.vercel.app')).toBe(url)
  })
})
