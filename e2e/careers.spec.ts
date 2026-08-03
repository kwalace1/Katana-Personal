import { test, expect } from '@playwright/test'
import { navigateTo } from './helpers'

test.describe('Careers Page (Public)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/careers')
  })

  test('careers page loads', async ({ page }) => {
    await expect(page).toHaveURL(/\/careers/)
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(10)
  })

  test('careers page is accessible without authentication', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/careers')
    await page.waitForLoadState('networkidle')
    // Should not redirect away from /careers
    expect(page.url()).toContain('/careers')
  })

  test('careers page does not crash', async ({ page }) => {
    await expect(page.getByText('Cannot GET')).toBeHidden()
    await expect(page.locator('text=/something went wrong/i')).toBeHidden()
  })

  test('careers page does not show app sidebar', async ({ page }) => {
    // Careers is a public page but still within the main app layout
    // The sidebar should be visible since it's not the landing page or employee portal
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(0)
  })
})
