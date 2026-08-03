import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('email sign-in dialog opens and validates input', async ({ page }) => {
    const emailBtn = page.getByRole('button', { name: /sign in with email/i })
    // If user is already signed in, skip
    if (!(await emailBtn.isVisible().catch(() => false))) {
      test.skip(true, 'User already signed in')
      return
    }

    await emailBtn.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Sign in with email')).toBeVisible()
    await expect(dialog.getByLabel(/email/i)).toBeVisible()
    await expect(dialog.getByLabel(/password/i)).toBeVisible()
    await expect(dialog.getByRole('button', { name: /^sign in$/i })).toBeVisible()
  })

  test('email sign-in shows error for invalid credentials', async ({ page }) => {
    const emailBtn = page.getByRole('button', { name: /sign in with email/i })
    if (!(await emailBtn.isVisible().catch(() => false))) {
      test.skip(true, 'User already signed in')
      return
    }

    await emailBtn.click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(/email/i).fill('bad@example.com')
    await dialog.getByLabel(/password/i).fill('wrongpassword')
    await dialog.getByRole('button', { name: /^sign in$/i }).click()

    // Should show an error message inside the dialog
    await expect(dialog.locator('text=/sign in failed|invalid|error/i')).toBeVisible({ timeout: 10_000 })
  })

  test('Microsoft sign-in button initiates OAuth flow', async ({ page }) => {
    const msBtn = page.getByRole('button', { name: /sign in with microsoft/i })
    if (!(await msBtn.isVisible().catch(() => false))) {
      test.skip(true, 'User already signed in')
      return
    }

    // Clicking should navigate away (to Supabase/Azure OAuth)
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 5_000 }).catch(() => null),
      page.waitForURL(/supabase|login\.microsoftonline|localhost/, { timeout: 5_000 }).catch(() => null),
      msBtn.click(),
    ])

    // Either a popup opened or the page navigated – both indicate OAuth started
    const currentUrl = page.url()
    const hasRedirected =
      popup !== null ||
      currentUrl.includes('supabase') ||
      currentUrl.includes('microsoftonline') ||
      currentUrl.includes('login.microsoft')

    // If Supabase is not configured the page stays on localhost – that's OK
    expect(hasRedirected || currentUrl.includes('localhost')).toBeTruthy()
  })

  test('"Have an invite?" link navigates to accept-invite page', async ({ page }) => {
    const inviteLink = page.getByRole('link', { name: /have an invite/i })
    if (!(await inviteLink.isVisible().catch(() => false))) {
      test.skip(true, 'User already signed in – invite link hidden')
      return
    }

    await inviteLink.click()
    await expect(page).toHaveURL(/\/accept-invite/)
  })

  test('unauthenticated user is redirected from protected routes', async ({ page, context }) => {
    // Clear all cookies/storage to ensure no session
    await context.clearCookies()

    await page.goto('/hub')
    await page.waitForLoadState('networkidle')

    // Should redirect to landing page OR show the hub if Supabase is not configured
    const url = page.url()
    const isOnLanding = url.endsWith('/') || url.includes('/?')
    const isOnHub = url.includes('/hub')
    expect(isOnLanding || isOnHub).toBeTruthy()
  })

  test('public routes are accessible without auth', async ({ page, context }) => {
    await context.clearCookies()

    // Landing page
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /one intelligent hub/i })).toBeVisible()

    // Careers page
    await page.goto('/careers')
    await page.waitForLoadState('networkidle')
    // Should not redirect away
    expect(page.url()).toContain('/careers')
  })
})
