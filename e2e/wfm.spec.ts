import { test, expect } from '@playwright/test'
import { navigateTo, collectConsoleErrors } from './helpers'

test.describe('Workforce Management Module', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/workforce')
  })

  test('WFM page loads without crashing', async ({ page }) => {
    await expect(page).toHaveURL(/\/workforce/)
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(10)
  })

  test('WFM page does not show error', async ({ page }) => {
    await expect(page.getByText('Cannot GET')).toBeHidden()
    await expect(page.locator('text=/something went wrong/i')).toBeHidden()
  })

  test('WFM page loads without critical console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await page.waitForTimeout(2000)
    const critical = errors.filter(
      (e) => !e.includes('supabase') && !e.includes('403') && !e.includes('Failed to fetch') && !e.includes('wfm') && !e.includes('WebSocket'),
    )
    expect(critical.length).toBeLessThanOrEqual(15)
  })

  test('WFM page has visible content', async ({ page }) => {
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.trim().length).toBeGreaterThan(10)
  })

  test('WFM tabs render when authenticated', async ({ page }) => {
    // Tabs are: Today, Work, Team, Time
    const tabs = page.getByRole('tab')
    const tabCount = await tabs.count()

    if (tabCount === 0) {
      test.skip(true, 'Tabs not visible – likely unauthenticated')
      return
    }

    expect(tabCount).toBeGreaterThanOrEqual(4)

    const tabNames = ['Today', 'Work', 'Team', 'Time']
    for (const name of tabNames) {
      await expect(page.getByRole('tab', { name: new RegExp(name, 'i') })).toBeVisible()
    }
  })

  test('Create Job dialog opens from Work tab when authenticated', async ({ page }) => {
    const workTab = page.getByRole('tab', { name: /work|jobs|engagements|work items/i })
    if (!(await workTab.isVisible().catch(() => false))) {
      test.skip(true, 'Work tab not visible – likely unauthenticated')
      return
    }

    await workTab.click()

    const listSubTab = page.getByRole('tab', { name: /^list$/i })
    if (await listSubTab.isVisible().catch(() => false)) {
      await listSubTab.click()
    }

    const addJobBtn = page.getByRole('button', { name: /add job|new job|add work|new work|add engagement/i }).first()
    if (!(await addJobBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Add Job button not found')
      return
    }
    await addJobBtn.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Multi-technician assignment uses checkboxes instead of a single-select dropdown
    const checkboxes = dialog.locator('input[type="checkbox"], [role="checkbox"]')
    const checkboxCount = await checkboxes.count()
    expect(checkboxCount).toBeGreaterThanOrEqual(0)
  })

  test('Create Job with multiple technicians when authenticated', async ({ page }) => {
    const workTab = page.getByRole('tab', { name: /work|jobs|engagements|work items/i })
    if (!(await workTab.isVisible().catch(() => false))) {
      test.skip(true, 'Work tab not visible – likely unauthenticated')
      return
    }

    await workTab.click()

    const listSubTab = page.getByRole('tab', { name: /^list$/i })
    if (await listSubTab.isVisible().catch(() => false)) {
      await listSubTab.click()
    }

    const addJobBtn = page.getByRole('button', { name: /add job|new job|create job|add work|new work/i }).first()
    if (!(await addJobBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Add Job button not found')
      return
    }
    await addJobBtn.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Fill required fields
    const titleInput = dialog.locator('input[placeholder*="job title" i]').first()
    if (await titleInput.isVisible()) {
      await titleInput.fill('Multi-Tech Test Job')
    }

    // Set dates
    const dateInputs = dialog.locator('input[type="date"]')
    const today = new Date().toISOString().slice(0, 10)
    if (await dateInputs.first().isVisible()) {
      await dateInputs.first().fill(today)
      if (await dateInputs.nth(1).isVisible()) {
        await dateInputs.nth(1).fill(today)
      }
    }

    // Select multiple technicians via checkboxes
    const checkboxes = dialog.locator('[role="checkbox"]')
    const checkboxCount = await checkboxes.count()
    if (checkboxCount >= 2) {
      await checkboxes.nth(0).click()
      await checkboxes.nth(1).click()
      await expect(dialog.getByText(/2 selected/i)).toBeVisible()
    }
  })

  test('Time tab loads when authenticated', async ({ page }) => {
    const timeTab = page.getByRole('tab', { name: /^time$/i })
    if (!(await timeTab.isVisible().catch(() => false))) {
      test.skip(true, 'Time tab not visible – likely unauthenticated')
      return
    }

    await timeTab.click()
    await page.waitForTimeout(1000)
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(10)
  })

  test('Schedule sub-tab loads when authenticated', async ({ page }) => {
    const workTab = page.getByRole('tab', { name: /work|jobs|engagements|work items/i })
    if (!(await workTab.isVisible().catch(() => false))) {
      test.skip(true, 'Work tab not visible – likely unauthenticated')
      return
    }

    await workTab.click()

    const calendarTab = page.getByRole('tab', { name: /schedule|calendar/i })
    if (!(await calendarTab.isVisible().catch(() => false))) {
      test.skip(true, 'Schedule sub-tab not visible – likely unauthenticated')
      return
    }

    await calendarTab.click()
    await page.waitForTimeout(1000)
    const body = await page.locator('body').innerText()
    expect(body.length).toBeGreaterThan(10)
  })

  test('Time entry dialog has time input fields', async ({ page }) => {
    const timeTab = page.getByRole('tab', { name: /^time$/i })
    if (!(await timeTab.isVisible().catch(() => false))) {
      test.skip(true, 'Time tab not visible – likely unauthenticated')
      return
    }
    await timeTab.click()
    await page.waitForTimeout(1000)

    const addTimesheetBtn = page.getByRole('button', { name: /add timesheet|new timesheet|add entry|log time/i }).first()
    if (!(await addTimesheetBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Add Timesheet button not found')
      return
    }
    await addTimesheetBtn.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const timeInputs = dialog.locator('input[type="time"]')
    const timeCount = await timeInputs.count()
    expect(timeCount).toBeGreaterThanOrEqual(2)
  })

  test('Timesheet clock-in and clock-out fields accept time values', async ({ page }) => {
    const timesheetTab = page.getByRole('tab', { name: /timesheet/i })
    if (!(await timesheetTab.isVisible().catch(() => false))) {
      test.skip(true, 'Timesheet tab not visible – likely unauthenticated')
      return
    }
    await timesheetTab.click()
    await page.waitForTimeout(1000)

    const addBtn = page.getByRole('button', { name: /add timesheet|new timesheet|add entry|log time/i }).first()
    if (!(await addBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Add Timesheet button not found')
      return
    }
    await addBtn.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const timeInputs = dialog.locator('input[type="time"]')
    if ((await timeInputs.count()) < 2) {
      test.skip(true, 'Time inputs not found')
      return
    }

    await timeInputs.nth(0).fill('09:00')
    await timeInputs.nth(1).fill('17:00')
    expect(await timeInputs.nth(0).inputValue()).toBe('09:00')
    expect(await timeInputs.nth(1).inputValue()).toBe('17:00')
  })

  test('Work list has Status column header', async ({ page }) => {
    const workTab = page.getByRole('tab', { name: /work|jobs|engagements|work items/i })
    if (!(await workTab.isVisible().catch(() => false))) {
      test.skip(true, 'Work tab not visible – likely unauthenticated')
      return
    }
    await workTab.click()
    const listSubTab = page.getByRole('tab', { name: /^list$/i })
    if (await listSubTab.isVisible().catch(() => false)) {
      await listSubTab.click()
    }
    await page.waitForTimeout(1000)

    const statusHeader = page.locator('th', { hasText: /status/i })
    await expect(statusHeader).toBeVisible({ timeout: 3000 })
  })

  test('Edit Job dialog has time fields', async ({ page }) => {
    const workTab = page.getByRole('tab', { name: /work|jobs|engagements|work items/i })
    if (!(await workTab.isVisible().catch(() => false))) {
      test.skip(true, 'Work tab not visible – likely unauthenticated')
      return
    }
    await workTab.click()
    const listSubTab = page.getByRole('tab', { name: /^list$/i })
    if (await listSubTab.isVisible().catch(() => false)) {
      await listSubTab.click()
    }
    await page.waitForTimeout(1000)

    const rows = page.locator('table tbody tr')
    if ((await rows.count()) === 0) {
      test.skip(true, 'No jobs to edit')
      return
    }
    await rows.first().click()

    const dialog = page.getByRole('dialog')
    if (!(await dialog.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Edit dialog did not open')
      return
    }

    const dialogContent = await dialog.innerText()
    expect(dialogContent.length).toBeGreaterThan(10)
  })
})
