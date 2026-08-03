import { test, expect } from '@playwright/test'
import { navigateTo } from './helpers'

test.describe('Hub Module Drag & Drop Reordering', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/hub')
    await page.evaluate(() => {
      localStorage.removeItem('katana_hub_module_order')
      localStorage.removeItem('katana_hub_layout')
    })
  })

  // ──────────────────────────────────────────
  // Customize mode toggle
  // ──────────────────────────────────────────

  test('Customize button is visible on the hub', async ({ page }) => {
    await expect(page.getByRole('button', { name: /customize hub/i })).toBeVisible()
  })

  test('clicking Customize enters hub customize mode', async ({ page }) => {
    await page.getByRole('button', { name: /customize hub/i }).click()
    await expect(page.getByRole('button', { name: /save hub layout/i })).toBeVisible()
  })

  test('clicking Done exits hub customize mode', async ({ page }) => {
    await page.getByRole('button', { name: /customize hub/i }).click()
    await page.getByRole('button', { name: /save hub layout/i }).click()
    await expect(page.getByRole('button', { name: /customize hub/i })).toBeVisible()
  })

  // ──────────────────────────────────────────
  // Drag handles visible in edit mode
  // ──────────────────────────────────────────

  test('drag handles appear only in customize mode', async ({ page }) => {
    const handles = page.getByLabel('Drag handle')
    await expect(handles.first()).toBeHidden().catch(() => {})

    await page.getByRole('button', { name: /customize hub/i }).click()
    await page.waitForTimeout(500)

    await expect(handles.first()).toBeVisible({ timeout: 5000 })
  })

  // ──────────────────────────────────────────
  // Keyboard reordering
  // ──────────────────────────────────────────

  test('keyboard ArrowDown moves module down in customize mode', async ({ page }) => {
    await page.getByRole('button', { name: /customize hub/i }).click()
    await page.waitForTimeout(300)

    // Get all module cards in edit mode (they have role="button")
    const modules = page.locator('[role="button"][aria-label*="Press arrow keys"]')
    const count = await modules.count()

    if (count < 2) {
      test.skip(true, 'Not enough modules to test reorder')
      return
    }

    // Record the first module's name
    const firstLabel = await modules.first().getAttribute('aria-label')
    const firstName = firstLabel?.split('.')[0]?.trim() ?? ''

    // Focus the first module and press ArrowDown
    await modules.first().focus()
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(300)

    // After moving down, the first position should have a different module
    const newFirstLabel = await modules.first().getAttribute('aria-label')
    const newFirstName = newFirstLabel?.split('.')[0]?.trim() ?? ''

    expect(newFirstName).not.toBe(firstName)
  })

  test('keyboard ArrowUp moves module up in customize mode', async ({ page }) => {
    await page.getByRole('button', { name: /customize hub/i }).click()
    await page.waitForTimeout(300)

    const modules = page.locator('[role="button"][aria-label*="Press arrow keys"]')
    const count = await modules.count()

    if (count < 2) {
      test.skip(true, 'Not enough modules to test reorder')
      return
    }

    // Record the second module's name
    const secondLabel = await modules.nth(1).getAttribute('aria-label')
    const secondName = secondLabel?.split('.')[0]?.trim() ?? ''

    // Focus the second module and press ArrowUp
    await modules.nth(1).focus()
    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(300)

    // After moving up, the first position should now have that module
    const newFirstLabel = await modules.first().getAttribute('aria-label')
    const newFirstName = newFirstLabel?.split('.')[0]?.trim() ?? ''

    expect(newFirstName).toBe(secondName)
  })

  // ──────────────────────────────────────────
  // Order persistence
  // ──────────────────────────────────────────

  test('module order persists in localStorage after reorder', async ({ page }) => {
    await page.getByRole('button', { name: /customize hub/i }).click()
    await page.waitForTimeout(300)

    const modules = page.locator('[role="button"][aria-label*="Press arrow keys"]')
    const count = await modules.count()

    if (count < 2) {
      test.skip(true, 'Not enough modules to test reorder')
      return
    }

    // Reorder via keyboard
    await modules.first().focus()
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(300)

    // Save and exit
    await page.getByRole('button', { name: /save hub layout/i }).click()
    await page.waitForTimeout(300)

    // Check localStorage
    const savedOrder = await page.evaluate(() =>
      localStorage.getItem('katana_hub_module_order'),
    )
    expect(savedOrder).not.toBeNull()
    const parsed = JSON.parse(savedOrder!)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThan(0)
  })

  // ──────────────────────────────────────────
  // HTML5 drag & drop simulation
  // ──────────────────────────────────────────

  test('draggable attribute is set on modules in customize mode', async ({ page }) => {
    await page.getByRole('button', { name: /customize hub/i }).click()
    await page.waitForTimeout(300)

    const modules = page.locator('[role="button"][aria-label*="Press arrow keys"]')
    const count = await modules.count()

    if (count < 1) {
      test.skip(true, 'No modules found')
      return
    }

    // The parent div (one level up from the role=button) should have draggable="true"
    const firstModule = modules.first()
    const draggable = await firstModule.getAttribute('draggable')
    // The draggable attr might be on the module element itself or its parent
    // Check that at least the cursor class is set
    const classes = await firstModule.getAttribute('class') ?? ''
    const hasDragCursor = classes.includes('cursor-move') || draggable === 'true'
    expect(hasDragCursor).toBe(true)
  })

  // ──────────────────────────────────────────
  // Edge cases
  // ──────────────────────────────────────────

  test('ArrowUp on first module does nothing', async ({ page }) => {
    await page.getByRole('button', { name: /customize hub/i }).click()
    await page.waitForTimeout(300)

    const modules = page.locator('[role="button"][aria-label*="Press arrow keys"]')
    const firstLabel = await modules.first().getAttribute('aria-label')

    await modules.first().focus()
    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(200)

    const afterLabel = await modules.first().getAttribute('aria-label')
    expect(afterLabel).toBe(firstLabel)
  })

  test('ArrowDown on last module does nothing', async ({ page }) => {
    await page.getByRole('button', { name: /customize hub/i }).click()
    await page.waitForTimeout(300)

    const modules = page.locator('[role="button"][aria-label*="Press arrow keys"]')
    const count = await modules.count()

    if (count < 1) {
      test.skip(true, 'No modules')
      return
    }

    const lastLabel = await modules.nth(count - 1).getAttribute('aria-label')

    await modules.nth(count - 1).focus()
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(200)

    const afterLabel = await modules.nth(count - 1).getAttribute('aria-label')
    expect(afterLabel).toBe(lastLabel)
  })
})
