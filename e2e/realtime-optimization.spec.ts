import { test, expect } from '@playwright/test'
import { navigateTo, collectConsoleErrors } from './helpers'

test.describe('Backend Optimization & Realtime', () => {
  test('Inventory page loads (realtime subscription active)', async ({ page }) => {
    await navigateTo(page, '/inventory')
    await expect(page).toHaveURL(/\/inventory/)
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(10)
    await expect(page.getByText('Cannot GET')).toBeHidden()
  })

  test('Inventory page does not produce excessive console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await navigateTo(page, '/inventory')
    await page.waitForTimeout(3000)
    const critical = errors.filter(
      (e) =>
        !e.includes('supabase') &&
        !e.includes('403') &&
        !e.includes('Failed to fetch') &&
        !e.includes('realtime'),
    )
    expect(critical.length).toBeLessThanOrEqual(5)
  })

  test('Workforce page loads (realtime subscription active)', async ({ page }) => {
    await navigateTo(page, '/workforce')
    await expect(page).toHaveURL(/\/workforce/)
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(10)
    await expect(page.getByText('Cannot GET')).toBeHidden()
  })

  test('Workforce page does not produce excessive console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await navigateTo(page, '/workforce')
    await page.waitForTimeout(3000)
    const critical = errors.filter(
      (e) =>
        !e.includes('supabase') &&
        !e.includes('403') &&
        !e.includes('Failed to fetch') &&
        !e.includes('realtime') &&
        !e.includes('WebSocket') &&
        !e.includes('wfm'),
    )
    expect(critical.length).toBeLessThanOrEqual(15)
  })

  test('KYI Company page loads with reduced polling', async ({ page }) => {
    await navigateTo(page, '/kyi/companies')
    await expect(page).toHaveURL(/\/kyi/)
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(10)
  })

  test('KYI Company page does not produce excessive console errors from polling', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await navigateTo(page, '/kyi/companies')
    await page.waitForTimeout(5000)
    const critical = errors.filter(
      (e) =>
        !e.includes('supabase') &&
        !e.includes('403') &&
        !e.includes('Failed to fetch') &&
        !e.includes('geocod'),
    )
    expect(critical.length).toBeLessThanOrEqual(5)
  })
})
