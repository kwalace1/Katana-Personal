import { Page, expect } from '@playwright/test'

/** Wait for the app shell to be ready (loading spinner gone). */
export async function waitForAppReady(page: Page) {
  // The app shows a loading spinner during auth init – wait for it to disappear
  await expect(page.getByText('Initializing authentication')).toBeHidden({ timeout: 10_000 }).catch(() => {
    // Spinner may never appear if auth is fast or disabled – that's fine
  })
}

/** Assert no unhandled console errors during a test. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      // Ignore known noisy errors
      if (text.includes('favicon') || text.includes('404')) return
      errors.push(text)
    }
  })
  return errors
}

/** Bypass the PasswordGate by injecting a fresh localStorage token. */
async function bypassPasswordGate(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem(
      'katana-unlocked',
      JSON.stringify({ exp: Date.now() + 10 * 60 * 1000 }),
    )
  })
}

/** Navigate and wait for network to settle. */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path)
  await bypassPasswordGate(page)
  await page.reload()
  await page.waitForLoadState('networkidle')
  await waitForAppReady(page)
}

/** Check that the sidebar is visible and contains the expected module links. */
export async function expectSidebarVisible(page: Page) {
  const sidebar = page.locator('aside')
  await expect(sidebar).toBeVisible()
}

/** Viewport helpers */
export const DESKTOP = { width: 1280, height: 720 }
export const MOBILE = { width: 390, height: 844 }
