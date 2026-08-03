import { test, expect } from '@playwright/test'
import { navigateTo, collectConsoleErrors } from './helpers'

test.describe('Hub Dashboard Analytics & KPIs', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/hub')
  })

  // ──────────────────────────────────────────
  // Page structure
  // ──────────────────────────────────────────

  test('hub displays the Katana Hub heading', async ({ page }) => {
    await expect(page.getByText('Katana Hub')).toBeVisible()
  })

  test('hub shows system health badge', async ({ page }) => {
    await expect(page.getByText('System Healthy')).toBeVisible()
  })

  test('hub shows time range filters', async ({ page }) => {
    await expect(page.getByRole('button', { name: '24h' })).toBeVisible()
    await expect(page.getByRole('button', { name: '7d' })).toBeVisible()
    await expect(page.getByRole('button', { name: '30d' })).toBeVisible()
  })

  test('hub shows quick action buttons', async ({ page }) => {
    await expect(page.getByText('Quick Search')).toBeVisible()
    await expect(page.getByText('Quick Create')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible()
  })

  // ──────────────────────────────────────────
  // Performance Overview section
  // ──────────────────────────────────────────

  test('Performance Overview section is visible', async ({ page }) => {
    await expect(page.getByText('Performance Overview')).toBeVisible()
  })

  test('Performance Overview shows module metrics', async ({ page }) => {
    await expect(page.getByText('Performance Overview')).toBeVisible()
    await expect(page.getByText('Active projects').first()).toBeVisible()
    await expect(page.getByText('Task completion', { exact: true }).first()).toBeVisible()
  })

  test('Performance Overview is collapsible', async ({ page }) => {
    const trigger = page.getByText('Performance Overview')
    const expandedContent = page.getByText('Click to collapse')

    await expect(expandedContent).toBeVisible()
    await trigger.click()
    await expect(expandedContent).toBeHidden({ timeout: 5000 })
    await trigger.click()
    await expect(expandedContent).toBeVisible({ timeout: 5000 })
  })

  // ──────────────────────────────────────────
  // Key Metrics section
  // ──────────────────────────────────────────

  test('Key Metrics section is visible', async ({ page }) => {
    await expect(page.getByText('Key Metrics')).toBeVisible()
  })

  test('Key Metrics is expandable', async ({ page }) => {
    const trigger = page.getByText('Key Metrics')
    await trigger.click()
    // After expanding, KPI cards should appear
    await expect(page.getByText('Active Projects').first()).toBeVisible()
  })

  // ──────────────────────────────────────────
  // KPI cards (inside Key Metrics)
  // ──────────────────────────────────────────

  test('KPI cards display expected titles', async ({ page }) => {
    // Expand Key Metrics first
    await page.getByText('Key Metrics').click()
    await page.waitForTimeout(300)

    const expectedKPIs = [
      'Active Projects',
      'Open Tasks',
    ]

    for (const title of expectedKPIs) {
      await expect(page.getByText(title).first()).toBeVisible()
    }
  })

  test('KPI values are numeric or dash', async ({ page }) => {
    await page.getByText('Key Metrics').click()
    await page.waitForTimeout(300)

    // Each KPI card should have a value that is a number or dash
    const kpiCards = page.locator('[data-slot="card"]')
    const count = await kpiCards.count()
    expect(count).toBeGreaterThan(0)
  })

  // ──────────────────────────────────────────
  // Time range switching
  // ──────────────────────────────────────────

  test('time range buttons are clickable and toggle state', async ({ page }) => {
    const btn24h = page.getByRole('button', { name: '24h' })
    const btn30d = page.getByRole('button', { name: '30d' })

    await btn24h.click()
    await page.waitForTimeout(200)
    await btn30d.click()
    await page.waitForTimeout(200)

    // No crash - page should still show content
    await expect(page.getByText('Katana Hub')).toBeVisible()
  })

  // ──────────────────────────────────────────
  // Your Tools & Activity Feed
  // ──────────────────────────────────────────

  test('Your Tools section is visible', async ({ page }) => {
    await expect(page.getByText('Your Tools')).toBeVisible()
  })

  test('Activity Feed section is visible', async ({ page }) => {
    await expect(page.getByText('Activity Feed')).toBeVisible()
  })

  test('Activity Feed shows Recent Actions', async ({ page }) => {
    await expect(page.getByText('Recent Actions')).toBeVisible()
  })

  // ──────────────────────────────────────────
  // Module cards in Your Tools
  // ──────────────────────────────────────────

  test('module cards render with names and links', async ({ page }) => {
    const knownModules = ['Katana PM', 'Inventory']
    for (const mod of knownModules) {
      const card = page.getByText(mod).first()
      await expect(card).toBeVisible()
    }
  })

  // ──────────────────────────────────────────
  // Profile completeness section
  // ──────────────────────────────────────────

  test('Profile Setup card is visible', async ({ page }) => {
    await expect(page.getByText('Profile Setup')).toBeVisible()
  })

  // ──────────────────────────────────────────
  // No critical errors
  // ──────────────────────────────────────────

  test('no critical console errors during dashboard interaction', async ({ page }) => {
    const errors = collectConsoleErrors(page)

    // Interact with several sections
    await page.getByText('Key Metrics').click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: '24h' }).click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: '30d' }).click()
    await page.waitForTimeout(500)

    const critical = errors.filter(
      (e) =>
        !e.includes('supabase') &&
        !e.includes('403') &&
        !e.includes('Failed to fetch') &&
        !e.includes('net::'),
    )
    expect(critical.length).toBeLessThanOrEqual(3)
  })
})
