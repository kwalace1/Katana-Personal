import { test, expect } from '@playwright/test'

/**
 * Smoke tests – fast sanity checks that every route renders without crashing.
 * These run first to catch build/routing regressions quickly.
 */

const ALL_ROUTES = [
  '/',
  '/hub',
  '/projects',
  '/inventory',
  '/inventory/check-out',
  '/inventory/scan-in',
  '/inventory/purchase-orders',
  '/inventory/suppliers',
  '/inventory/transactions',
  '/customer-success',
  '/workforce',
  '/hr',
  '/automation',
  '/kyi',
  '/kyi/cross-reference',
  '/careers',
  '/employee',
  '/employee/directory',
  '/employee/performance',
  '/employee/goals',
  '/employee/development',
  '/employee/profile',
  '/employee/jobs',
  '/settings/organization',
  '/onboarding',
  '/accept-invite',
]

test.describe('Smoke Tests – All Routes', () => {
  for (const route of ALL_ROUTES) {
    test(`${route} does not crash`, async ({ page }) => {
      const response = await page.goto(route)

      // Vite dev server should return 200 for all routes (SPA)
      expect(response?.status()).toBeLessThan(500)

      await page.waitForLoadState('domcontentloaded')

      // Page should not be blank
      const bodyText = await page.locator('body').innerText()
      expect(bodyText.length).toBeGreaterThan(0)

      // No uncaught React error boundary
      await expect(page.locator('text=/something went wrong/i')).toBeHidden()
      await expect(page.locator('text=/cannot read properties/i')).toBeHidden()
    })
  }
})

test.describe('Smoke Tests – Page Performance', () => {
  test('landing page loads within 5 seconds', async ({ page }) => {
    const start = Date.now()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(5000)
  })

  test('hub page loads within 8 seconds', async ({ page }) => {
    const start = Date.now()
    await page.goto('/hub')
    await page.waitForLoadState('networkidle')
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(8000)
  })
})

test.describe('Smoke Tests – No JavaScript Errors', () => {
  test('landing page has no uncaught JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Filter out known benign errors (Supabase connection, third-party)
    const real = errors.filter(
      (e) =>
        !e.includes('supabase') &&
        !e.includes('Failed to fetch') &&
        !e.includes('NetworkError') &&
        !e.includes('AbortError'),
    )
    expect(real).toEqual([])
  })

  test('hub page has no uncaught JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/hub')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const real = errors.filter(
      (e) =>
        !e.includes('supabase') &&
        !e.includes('Failed to fetch') &&
        !e.includes('NetworkError') &&
        !e.includes('AbortError'),
    )
    expect(real).toEqual([])
  })
})
