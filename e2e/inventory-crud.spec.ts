import { test, expect } from '@playwright/test'
import { navigateTo } from './helpers'

test.describe('Inventory CRUD flows', () => {
  test('suppliers add flow, scan-in and check-out pages load', async ({ page }) => {
    await navigateTo(page, '/inventory/suppliers')

    const addSupplierTrigger = page.getByRole('button', { name: /^add supplier$/i }).first()
    if (!(await addSupplierTrigger.isVisible().catch(() => false))) {
      test.skip(true, 'Supplier UI unavailable (likely Supabase not configured)')
      return
    }

    await addSupplierTrigger.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByPlaceholder('Company name').fill('Test Supplier QA')

    await dialog.getByRole('button', { name: /^add supplier$/i }).click()

    await expect(page.getByText('Test Supplier QA').first()).toBeVisible({ timeout: 20_000 })

    await navigateTo(page, '/inventory/scan-in')
    await expect(page.getByRole('heading', { name: /^scan-in$/i })).toBeVisible()

    await navigateTo(page, '/inventory/check-out')
    await expect(page.getByRole('heading', { name: /^check-out$/i })).toBeVisible()
  })
})
