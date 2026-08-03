import { test, expect } from '@playwright/test'
import { navigateTo } from './helpers'

/**
 * Tests for Customer Success, HR, Workforce, Manufacturing, Automation, and KYI modules.
 * Each module should load without crashing and render content.
 */

const modules = [
  { path: '/customer-success', name: 'Customer Success' },
  { path: '/workforce', name: 'Workforce Management' },
  { path: '/hr', name: 'HR' },
  { path: '/automation', name: 'Automation' },
  { path: '/kyi', name: 'Know Your Investor' },
]

for (const { path, name } of modules) {
  test.describe(`${name} Module`, () => {
    test(`${name} page loads`, async ({ page }) => {
      await navigateTo(page, path)
      const url = page.url()
      // Should either stay on the module page or redirect to /employee (module access guard)
      const isOnPage = url.includes(path) || url.includes('/employee')
      expect(isOnPage).toBeTruthy()
    })

    test(`${name} page renders content`, async ({ page }) => {
      await navigateTo(page, path)
      const body = await page.locator('body').innerText()
      expect(body.length).toBeGreaterThan(10)
    })

    test(`${name} page does not crash`, async ({ page }) => {
      await navigateTo(page, path)
      await expect(page.getByText('Cannot GET')).toBeHidden()
    })

    test(`${name} page has sidebar`, async ({ page }) => {
      await navigateTo(page, path)
      const url = page.url()
      if (!url.includes('/employee')) {
        const sidebar = page.locator('aside').first()
        await expect(sidebar).toBeVisible()
      }
    })
  })
}

test.describe('KYI Sub-Pages', () => {
  test('KYI company detail handles non-existent ID', async ({ page }) => {
    await navigateTo(page, '/kyi/companies/fake-id')
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(0)
  })

  test('KYI investor detail handles non-existent ID', async ({ page }) => {
    await navigateTo(page, '/kyi/investors/fake-id')
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(0)
  })

  test('KYI cross-reference page loads', async ({ page }) => {
    await navigateTo(page, '/kyi/cross-reference')
    const url = page.url()
    const isOnPage = url.includes('/kyi/cross-reference') || url.includes('/employee')
    expect(isOnPage).toBeTruthy()
  })
})
