import { test as setup, expect } from '@playwright/test'

const AUTH_FILE = 'e2e/.auth/user.json'

/**
 * Authenticates via PasswordGate + Microsoft OAuth and saves storage state.
 * Reads ms_login / ms_password (or E2E_USER_EMAIL / E2E_USER_PASSWORD) from .env.
 */
setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL || process.env.ms_login
  const password = (process.env.E2E_USER_PASSWORD || process.env.ms_password || '').replace(/^"|"$/g, '')
  const accessCode = process.env.VITE_ACCESS_PASSWORD || process.env.page_password || ''

  if (!email || !password) {
    console.warn(
      '⚠️  E2E_USER_EMAIL / E2E_USER_PASSWORD not set – saving empty auth state.',
    )
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.context().storageState({ path: AUTH_FILE })
    return
  }

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Step 1: PasswordGate — enter access code if the gate is visible
  const accessInput = page.locator('input[placeholder="Access code"]')
  if (await accessInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await accessInput.fill(accessCode)
    await page.getByRole('button', { name: /continue/i }).click()
    await page.waitForTimeout(2000)
  }

  // Step 2: Click "Sign in with Microsoft"
  const msBtn = page.getByRole('button', { name: /sign in with microsoft/i })
  await expect(msBtn).toBeVisible({ timeout: 15_000 })
  await msBtn.click()

  // Microsoft login page: enter email
  await page.waitForURL(/login\.microsoftonline\.com|supabase/, { timeout: 15_000 })
  const emailInput = page.locator('input[type="email"], input[name="loginfmt"]')
  await expect(emailInput).toBeVisible({ timeout: 10_000 })
  await emailInput.fill(email)
  await page.getByRole('button', { name: /next/i }).click()

  // Microsoft login page: enter password
  const passwordInput = page.locator('input[type="password"], input[name="passwd"]')
  await expect(passwordInput).toBeVisible({ timeout: 10_000 })
  await passwordInput.fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()

  // "Stay signed in?" prompt — click Yes
  const staySignedInYes = page.locator('input[type="submit"][value="Yes"], button:has-text("Yes"), #idSIButton9')
  await staySignedInYes.first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
  if (await staySignedInYes.first().isVisible().catch(() => false)) {
    await staySignedInYes.first().click()
  }

  // Permissions consent prompt — click Accept
  const acceptBtn = page.locator('input[type="submit"][value="Accept"], button:has-text("Accept"), #idBtn_Accept')
  await acceptBtn.first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
  if (await acceptBtn.first().isVisible().catch(() => false)) {
    await acceptBtn.first().click()
  }

  // Wait for redirect back to the app (allow up to 120s for MFA/consent prompts)
  await page.waitForURL(/localhost|127\.0\.0\.1/, { timeout: 120_000 })
  // Post-sign-in default is the employee portal (landing page redirects when already signed in)
  await page.waitForURL(/\/employee/, { timeout: 30_000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000)

  await page.context().storageState({ path: AUTH_FILE })
})
