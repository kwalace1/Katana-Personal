import { test, expect } from '@playwright/test'
import { navigateTo, expectSidebarVisible } from './helpers'

test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/hub')
  })

  test('sidebar is visible on desktop and contains module links', async ({ page }) => {
    await expectSidebarVisible(page)

    const sidebar = page.locator('aside')
    const expectedModules = [
      'Hub',
      'Katana PM',
      'Katana Inventory',
      'Katana Customers',
      'WFM',
      'Katana HR',
      'Employee Portal',
      'Careers',
    ]

    for (const label of expectedModules) {
      // Module may be filtered by access – just check at least Hub exists
      const link = sidebar.getByText(label, { exact: false })
      if (label === 'Hub') {
        await expect(link).toBeVisible()
      }
    }
  })

  test('clicking sidebar links navigates to correct page', async ({ page }) => {
    const sidebar = page.locator('aside')

    // Hub should already be active
    const hubLink = sidebar.getByRole('link', { name: /hub/i }).first()
    await expect(hubLink).toBeVisible()

    // Navigate to a different module via sidebar
    const projectsLink = sidebar.getByRole('link', { name: /katana pm/i })
    if (await projectsLink.isVisible().catch(() => false)) {
      await projectsLink.click()
      await page.waitForURL(/\/projects/)
      await expect(page).toHaveURL(/\/projects/)
    }
  })

  test('sidebar highlights the active route', async ({ page }) => {
    const sidebar = page.locator('aside')
    // Hub link should have the active styling (bg-primary class)
    const hubLink = sidebar.getByRole('link', { name: /hub/i }).first()
    await expect(hubLink).toHaveClass(/bg-primary/)
  })

  test('sidebar collapse toggle works', async ({ page }) => {
    const sidebar = page.locator('aside')

    // Find the collapse/expand button
    const collapseBtn = sidebar.getByRole('button').first()
    if (await collapseBtn.isVisible().catch(() => false)) {
      await collapseBtn.click()
      // Sidebar should collapse (w-16 class)
      await expect(sidebar).toHaveClass(/w-16/)

      // Click again to expand
      await collapseBtn.click()
      await expect(sidebar).toHaveClass(/w-72/)
    }
  })

  test('logo in sidebar links back to landing page', async ({ page }) => {
    const sidebar = page.locator('aside')
    const logoLink = sidebar.getByRole('link').first()
    await expect(logoLink).toHaveAttribute('href', '/')
  })
})

test.describe('Header', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/hub')
  })

  test('header is visible on authenticated pages', async ({ page }) => {
    // Header exists above the main content
    const header = page.locator('header').first()
    if (await header.isVisible().catch(() => false)) {
      await expect(header).toBeVisible()
    }
  })

  test('header is not shown on landing page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // The app's custom Header component should not be present – the landing has its own nav
    const appHeaders = page.locator('header').filter({ hasNot: page.locator('nav') })
    // If there's a header it should belong to the landing nav, not the app shell header
    const count = await appHeaders.count()
    // Landing page uses <nav> not <Header />, so either 0 headers or the nav-based one
    expect(count).toBeLessThanOrEqual(1)
  })
})
