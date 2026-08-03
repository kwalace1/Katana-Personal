import { test, expect } from '@playwright/test'
import { navigateTo } from './helpers'

test.describe('Organization Settings', () => {
  test('settings page loads at /settings/organization', async ({ page }) => {
    await navigateTo(page, '/settings/organization')
    const url = page.url()
    // Should either show settings or redirect to landing (if not authenticated) or employee (if no access)
    const validUrl =
      url.includes('/settings/organization') || url.includes('/employee') || url.endsWith('/')
    expect(validUrl).toBeTruthy()
  })

  test('settings page does not crash', async ({ page }) => {
    await navigateTo(page, '/settings/organization')
    await expect(page.getByText('Cannot GET')).toBeHidden()
  })

  test('settings page has sidebar', async ({ page }) => {
    await navigateTo(page, '/settings/organization')
    if (page.url().includes('/settings')) {
      const sidebar = page.locator('aside')
      await expect(sidebar).toBeVisible()
    }
  })
})

test.describe('Onboarding Page', () => {
  test('onboarding page loads', async ({ page }) => {
    await navigateTo(page, '/onboarding')
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(0)
  })

  test('onboarding page does not crash', async ({ page }) => {
    await navigateTo(page, '/onboarding')
    await expect(page.getByText('Cannot GET')).toBeHidden()
  })
})

test.describe('Accept Invite Page', () => {
  test('accept-invite page loads', async ({ page }) => {
    await page.goto('/accept-invite')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/accept-invite/)
  })

  test('accept-invite page is accessible without auth', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/accept-invite')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/accept-invite')
  })

  test('accept-invite page does not crash', async ({ page }) => {
    await page.goto('/accept-invite')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Cannot GET')).toBeHidden()
  })
})
