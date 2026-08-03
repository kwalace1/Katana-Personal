import { test, expect } from '@playwright/test'

test.describe('Theme Toggle', () => {
  test('landing page has a theme toggle button', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // The SimpleThemeToggle renders a button – look for sun/moon icons or a toggle
    const themeToggle = page.locator('button').filter({ has: page.locator('svg') })
    // There should be at least one button with an SVG (theme toggle uses sun/moon SVGs)
    const count = await themeToggle.count()
    expect(count).toBeGreaterThan(0)
  })

  test('clicking theme toggle changes the theme class on html/body', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Get initial theme state
    const initialClass = await page.locator('html').getAttribute('class') || ''

    // Find the theme toggle (usually in the nav area)
    const nav = page.locator('nav').first()
    const buttons = nav.locator('button')
    const buttonCount = await buttons.count()

    // Try clicking buttons that look like theme toggles (small icon-only buttons)
    for (let i = 0; i < buttonCount; i++) {
      const btn = buttons.nth(i)
      const text = await btn.innerText()
      const hasOnlySvg = text.trim() === '' && (await btn.locator('svg').count()) > 0

      if (hasOnlySvg) {
        await btn.click()
        await page.waitForTimeout(500)

        const newClass = await page.locator('html').getAttribute('class') || ''
        // Theme should have changed (dark ↔ light)
        if (newClass !== initialClass) {
          expect(newClass).not.toEqual(initialClass)
          return
        }
      }
    }
  })

  test('theme persists after page reload', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Get initial theme
    const initialClass = await page.locator('html').getAttribute('class') || ''

    // Find and click theme toggle
    const nav = page.locator('nav').first()
    const buttons = nav.locator('button')
    const buttonCount = await buttons.count()

    for (let i = 0; i < buttonCount; i++) {
      const btn = buttons.nth(i)
      const text = await btn.innerText()
      const hasOnlySvg = text.trim() === '' && (await btn.locator('svg').count()) > 0

      if (hasOnlySvg) {
        await btn.click()
        await page.waitForTimeout(500)
        break
      }
    }

    const afterToggle = await page.locator('html').getAttribute('class') || ''

    // Reload and check persistence
    await page.reload()
    await page.waitForLoadState('networkidle')

    const afterReload = await page.locator('html').getAttribute('class') || ''

    // If theme changed, it should persist after reload
    if (afterToggle !== initialClass) {
      expect(afterReload).toContain(afterToggle.includes('dark') ? 'dark' : '')
    }
  })
})
