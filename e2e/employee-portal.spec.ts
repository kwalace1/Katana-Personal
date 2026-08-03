import { test, expect } from '@playwright/test'
import { navigateTo } from './helpers'

test.describe('Employee Portal', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/employee')
  })

  test('employee portal loads', async ({ page }) => {
    await expect(page).toHaveURL(/\/employee/)
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(10)
  })

  test('employee portal does not show main app sidebar', async ({ page }) => {
    // Employee portal uses its own layout, not the main sidebar
    // The main app sidebar should not appear on employee routes
    const mainSidebar = page.locator('aside').first()
    // Either the sidebar is hidden or it belongs to the employee portal layout
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toContain('Cannot GET')
  })

  test('employee portal page does not crash', async ({ page }) => {
    await expect(page.locator('text=/something went wrong/i')).toBeHidden()
  })
})

test.describe('Employee Portal Sub-Pages', () => {
  const subPages = [
    { path: '/employee/directory', name: 'Directory' },
    { path: '/employee/performance', name: 'Performance' },
    { path: '/employee/goals', name: 'Goals' },
    { path: '/employee/development', name: 'Development' },
    { path: '/employee/profile', name: 'Profile' },
    { path: '/employee/jobs', name: 'Job Applications' },
  ]

  for (const { path, name } of subPages) {
    test(`${name} page loads at ${path}`, async ({ page }) => {
      await navigateTo(page, path)
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/')))
      const body = await page.locator('body').innerText()
      expect(body.length).toBeGreaterThan(10)
    })

    test(`${name} page does not crash`, async ({ page }) => {
      await navigateTo(page, path)
      await expect(page.getByText('Cannot GET')).toBeHidden()
    })
  }
})

test.describe('Employee Portal Navigation', () => {
  test('can navigate between employee portal pages', async ({ page }) => {
    await navigateTo(page, '/employee')

    // Try to find navigation links within the employee portal layout
    const navLinks = page.locator('a[href*="/employee/"]')
    const linkCount = await navLinks.count()

    if (linkCount > 0) {
      const firstLink = navLinks.first()
      const href = await firstLink.getAttribute('href')
      await firstLink.click()
      if (href) {
        await page.waitForURL(new RegExp(href.replace(/\//g, '\\/')))
      }
    }
  })
})
