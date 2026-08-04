import { test, expect } from '@playwright/test'

test.describe('App entrance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('shows Katana entrance with Open / Sign in', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Katana' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open Katana' })).toBeVisible()
  })

  test('can switch to sign-in form', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign in & open/i })).toBeVisible()
  })
})
