import { test, expect } from '@playwright/test'
import { navigateTo } from './helpers'

test.describe('Automation module', () => {
  test('automation page loads with workspace chrome', async ({ page }) => {
    await navigateTo(page, '/automation')
    await expect(page.locator('body')).toContainText(/automation|documents|katana/i)
    await expect(page.getByRole('button', { name: /ask agent/i })).toBeVisible()
  })
})
