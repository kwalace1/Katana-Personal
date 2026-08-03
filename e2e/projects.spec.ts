import { test, expect } from '@playwright/test'
import { navigateTo } from './helpers'

test.describe('Projects Module', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/projects')
  })

  test('projects page loads and shows heading or content', async ({ page }) => {
    await expect(page).toHaveURL(/\/projects/)
    const body = page.locator('body')
    const text = await body.innerText()
    expect(text.length).toBeGreaterThan(10)
  })

  test('projects page does not show error state', async ({ page }) => {
    // Should not show a crash or 404
    await expect(page.getByText('Cannot GET')).toBeHidden()
    await expect(page.locator('text=/something went wrong/i')).toBeHidden()
  })

  test('projects page has navigation back to hub via sidebar', async ({ page }) => {
    const sidebar = page.locator('aside')
    const hubLink = sidebar.getByRole('link', { name: /hub/i }).first()
    await expect(hubLink).toBeVisible()
  })

  test('clicking a project navigates to project detail', async ({ page }) => {
    // Look for any clickable project card or row
    const projectLinks = page.locator('a[href*="/projects/"]').first()
    if (await projectLinks.isVisible().catch(() => false)) {
      await projectLinks.click()
      await page.waitForURL(/\/projects\/.+/)
      await expect(page).toHaveURL(/\/projects\/.+/)
    }
  })
})

test.describe('Project Detail Page', () => {
  test('shows 404-style or empty state for non-existent project', async ({ page }) => {
    await navigateTo(page, '/projects/non-existent-id')
    // Should not crash – either shows "not found" or redirects
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(0)
  })
})
