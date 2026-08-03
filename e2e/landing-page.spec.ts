import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('renders the hero section with headline and CTAs', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /one intelligent hub/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /request a demo/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /launch the hub/i }).first()).toBeVisible()
  })

  test('top nav contains all navigation links', async ({ page }) => {
    const nav = page.locator('nav').first()
    await expect(nav).toBeVisible()
    await expect(nav.getByText('Katana Technologies')).toBeVisible()
    await expect(nav.getByText('Features')).toBeVisible()
    await expect(nav.getByText('Use Cases')).toBeVisible()
    await expect(nav.getByText('Pricing')).toBeVisible()
    await expect(nav.getByText('FAQ')).toBeVisible()
  })

  test('features section shows all six module cards', async ({ page }) => {
    const featuresSection = page.locator('#features')
    await featuresSection.scrollIntoViewIfNeeded()
    await expect(featuresSection.getByText('Projects & Tasks')).toBeVisible()
    await expect(featuresSection.getByText('Katana Customers')).toBeVisible()
    await expect(featuresSection.getByText('Inventory & Assets')).toBeVisible()
    await expect(featuresSection.getByText('Workforce & Scheduling')).toBeVisible()
    await expect(featuresSection.getByText('People & HR')).toBeVisible()
    await expect(featuresSection.getByText('Dashboards & Analytics')).toBeVisible()
  })

  test('use case cards open detail dialogs', async ({ page }) => {
    const useCases = page.locator('#usecases')
    await useCases.scrollIntoViewIfNeeded()

    // Click "See example" for Agencies
    await useCases.getByRole('button', { name: /see example/i }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('For Agencies')).toBeVisible()

    // Close dialog
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('pricing section shows three tiers', async ({ page }) => {
    const pricing = page.locator('#pricing')
    await pricing.scrollIntoViewIfNeeded()
    await expect(pricing.getByText('Starter')).toBeVisible()
    await expect(pricing.getByText('Growth')).toBeVisible()
    await expect(pricing.getByText('Enterprise')).toBeVisible()
    await expect(pricing.getByText('$29').first()).toBeVisible()
    await expect(pricing.getByText('$49').first()).toBeVisible()
    await expect(pricing.getByText('Custom').first()).toBeVisible()
  })

  test('FAQ accordion expands and collapses', async ({ page }) => {
    const faq = page.locator('#faq')
    await faq.scrollIntoViewIfNeeded()

    const firstTrigger = faq.getByRole('button', { name: /how long does setup take/i })
    await expect(firstTrigger).toBeVisible()
    await firstTrigger.click()
    await expect(page.getByText(/most teams are up and running within 24 hours/i)).toBeVisible()

    // Click again to collapse
    await firstTrigger.click()
    await expect(page.getByText(/most teams are up and running within 24 hours/i)).toBeHidden()
  })

  test('demo booking dialog opens and has required fields', async ({ page }) => {
    await page.getByRole('button', { name: /request a demo/i }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Schedule Your Demo')).toBeVisible()

    // Calendar should be visible
    await expect(dialog.locator('.rdp, [role="grid"]')).toBeVisible()

    // Contact fields
    await expect(dialog.getByLabel(/name/i)).toBeVisible()
    await expect(dialog.getByLabel(/email/i).first()).toBeVisible()

    // Submit button should be disabled without date/time/name/email
    await expect(dialog.getByRole('button', { name: /schedule demo/i })).toBeDisabled()
  })

  test('footer contains expected links', async ({ page }) => {
    const footer = page.locator('footer')
    await footer.scrollIntoViewIfNeeded()
    await expect(footer.getByText('Katana Technologies').first()).toBeVisible()
    await expect(footer.getByText('Product').first()).toBeVisible()
    await expect(footer.getByText('Resources').first()).toBeVisible()
    await expect(footer.getByText('Company').first()).toBeVisible()
  })

  test('auth section is visible (sign-in buttons, avatar, or loading)', async ({ page }) => {
    const nav = page.locator('nav').first()
    // Auth area can be: loading spinner, sign-in buttons, or user avatar
    const signInMicrosoft = nav.getByRole('button', { name: /sign in with microsoft/i })
    const avatarButton = nav.locator('button.rounded-full')
    const loadingSpinner = nav.locator('.animate-spin')

    // Wait a moment for auth to settle
    await page.waitForTimeout(1000)

    const isSignedOut = await signInMicrosoft.isVisible().catch(() => false)
    const isSignedIn = await avatarButton.first().isVisible().catch(() => false)
    const isLoading = await loadingSpinner.first().isVisible().catch(() => false)
    expect(isSignedOut || isSignedIn || isLoading).toBeTruthy()
  })

  test('social proof section scrolls company logos', async ({ page }) => {
    const socialProof = page.getByText('Trusted by teams across industries')
    await socialProof.scrollIntoViewIfNeeded()
    await expect(socialProof).toBeVisible()

    // At least some company names should be visible
    await expect(page.getByText('TechCorp').first()).toBeVisible()
  })

  test('page has no accessibility violations on heading hierarchy', async ({ page }) => {
    const h1 = page.locator('h1')
    await expect(h1).toHaveCount(1)
    const h2s = page.locator('h2')
    expect(await h2s.count()).toBeGreaterThanOrEqual(4)
  })
})
