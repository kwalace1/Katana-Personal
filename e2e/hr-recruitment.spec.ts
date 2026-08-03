import { test, expect } from '@playwright/test'
import { navigateTo, waitForAppReady } from './helpers'

test.describe('HR Recruitment job posting', () => {
  test('can create a job listing from the Recruitment tab', async ({ page }) => {
    await navigateTo(page, '/hr')

    if (!page.url().includes('/hr')) {
      test.skip(true, 'Redirected away from HR (no module access or not signed in)')
      return
    }

    await page.getByRole('tab', { name: /^recruitment$/i }).click()
    await waitForAppReady(page)

    await page.getByRole('button', { name: /new job listing/i }).click()

    await page.getByPlaceholder('e.g. Senior Software Engineer').fill('QA Test Engineer')
    await page.getByPlaceholder('e.g. Engineering').fill('Engineering')

    await page.getByRole('button', { name: /create listing/i }).click()

    const successToast = page.getByText('Job listing created successfully!', { exact: true })
    const listingText = page.getByText('QA Test Engineer').first()

    await expect(successToast.or(listingText)).toBeVisible({ timeout: 20_000 })
  })
})
