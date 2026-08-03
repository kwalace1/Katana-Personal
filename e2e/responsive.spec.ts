import { test, expect } from '@playwright/test'
import { navigateTo, DESKTOP, MOBILE } from './helpers'

test.describe('Responsive Layout', () => {
  test('landing page renders correctly on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /one intelligent hub/i })).toBeVisible()
    // CTA button should still be visible
    await expect(page.getByRole('button', { name: /request a demo/i }).first()).toBeVisible()
  })

  test('landing page nav links are hidden on mobile (responsive menu)', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const nav = page.locator('nav').first()
    // The nav anchor links have "hidden md:inline" class, so they should be hidden on mobile
    const featuresLink = nav.getByText('Features')
    // It may be hidden via CSS (display: none) on mobile
    await expect(featuresLink).toBeHidden()
  })

  test('hub page sidebar is hidden on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await navigateTo(page, '/hub')

    const sidebar = page.locator('aside')
    // Sidebar has -translate-x-full lg:translate-x-0, so hidden on mobile
    const isOffscreen = await sidebar.evaluate(
      (el) => window.getComputedStyle(el).transform !== 'none',
    )
    expect(isOffscreen).toBeTruthy()
  })

  test('landing page renders correctly on desktop', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /one intelligent hub/i })).toBeVisible()
    const nav = page.locator('nav').first()
    await expect(nav.getByText('Features')).toBeVisible()
    await expect(nav.getByText('Pricing')).toBeVisible()
  })

  test('hub page sidebar is visible on desktop', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await navigateTo(page, '/hub')

    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()
  })

  test('features section cards stack on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const featuresSection = page.locator('#features')
    await featuresSection.scrollIntoViewIfNeeded()

    // Cards should be visible even on mobile (they stack vertically)
    await expect(featuresSection.getByText('Projects & Tasks')).toBeVisible()
  })

  test('pricing cards stack on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const pricing = page.locator('#pricing')
    await pricing.scrollIntoViewIfNeeded()
    await expect(pricing.getByText('Starter')).toBeVisible()
  })
})
