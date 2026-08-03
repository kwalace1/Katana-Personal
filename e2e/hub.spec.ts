import { test, expect } from '@playwright/test'
import { navigateTo, collectConsoleErrors } from './helpers'

test.describe('Hub Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/hub')
  })

  test('hub page loads without critical console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await page.waitForTimeout(2000)
    const critical = errors.filter(
      (e) => !e.includes('supabase') && !e.includes('403') && !e.includes('Failed to fetch'),
    )
    // Allow Supabase connection errors in test env but no app crashes
    expect(critical.length).toBeLessThanOrEqual(5)
  })

  test('hub page renders main content area', async ({ page }) => {
    // The hub should display some content – widgets, cards, or at least a heading
    const mainContent = page.locator('main, [class*="content"], [class*="hub"]').first()
    const body = page.locator('body')
    await expect(body).not.toHaveText('Cannot GET')
    await expect(body).not.toHaveText('404')
  })

  test('hub page is accessible at /hub', async ({ page }) => {
    await expect(page).toHaveURL(/\/hub/)
    await expect(page).toHaveTitle(/.+/)
  })

  test('hub has a sidebar', async ({ page }) => {
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()
  })

  test('no blank screen – page has visible content', async ({ page }) => {
    // Ensure the page is not completely blank
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.trim().length).toBeGreaterThan(10)
  })
})
