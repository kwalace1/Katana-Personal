import { test, expect } from '@playwright/test'
import { navigateTo } from './helpers'

test.describe('Inventory Module', () => {
  test('inventory overview page loads', async ({ page }) => {
    await navigateTo(page, '/inventory')
    await expect(page).toHaveURL(/\/inventory/)
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(10)
  })

  test('inventory page does not crash', async ({ page }) => {
    await navigateTo(page, '/inventory')
    await expect(page.getByText('Cannot GET')).toBeHidden()
  })
})

test.describe('Inventory Sub-Pages', () => {
  const subPages = [
    { path: '/inventory/check-out', name: 'Check Out' },
    { path: '/inventory/scan-in', name: 'Scan In' },
    { path: '/inventory/purchase-orders', name: 'Purchase Orders' },
    { path: '/inventory/suppliers', name: 'Suppliers' },
    { path: '/inventory/transactions', name: 'Transactions' },
  ]

  for (const { path, name } of subPages) {
    test(`${name} page loads at ${path}`, async ({ page }) => {
      await navigateTo(page, path)
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/')))
      const body = await page.locator('body').innerText()
      expect(body.length).toBeGreaterThan(10)
    })

    test(`${name} page does not show error`, async ({ page }) => {
      await navigateTo(page, path)
      await expect(page.getByText('Cannot GET')).toBeHidden()
      await expect(page.locator('text=/something went wrong/i')).toBeHidden()
    })
  }
})

test.describe('Inventory Item Detail', () => {
  test('non-existent item does not crash', async ({ page }) => {
    await navigateTo(page, '/inventory/items/fake-id')
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(0)
  })
})

test.describe('Purchase Order Detail', () => {
  test('non-existent PO does not crash', async ({ page }) => {
    await navigateTo(page, '/inventory/purchase-orders/fake-id')
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(0)
  })
})
