import { test, expect } from '@playwright/test'
import { navigateTo } from './helpers'

test.describe('Customer Success analytics', () => {
  test('Analytics tab shows portfolio metrics and health distribution', async ({ page }) => {
    await navigateTo(page, '/customer-success')
    const url = page.url()
    if (url.includes('/employee')) {
      test.skip(true, 'Redirected away from Customer Success module')
    }

    await page.getByRole('tab', { name: /analytics/i }).click()

    await expect(page.getByRole('heading', { name: /customer analytics/i })).toBeVisible()
    await expect(page.getByText('Interactions')).toBeVisible()
    await expect(page.getByText('Health distribution')).toBeVisible()
  })
})
