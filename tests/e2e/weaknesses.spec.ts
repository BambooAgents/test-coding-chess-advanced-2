import { test, expect } from '@playwright/test'

const base = '/test-coding-chess-advanced-2/'

test('weaknesses page loads with input form', async ({ page }) => {
  await page.goto(base + 'weaknesses')

  await expect(page.locator('h1')).toContainText('My Weaknesses')
  await expect(page.locator('input#username')).toBeVisible()
  await expect(page.locator('select#gameCount')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Analyze' })).toBeVisible()
})

test('weaknesses page shows error for empty username', async ({ page }) => {
  await page.goto(base + 'weaknesses')

  await page.getByRole('button', { name: 'Analyze' }).click()

  await expect(page.locator('text=Please enter a chess.com username')).toBeVisible()
})

test('weaknesses page has game count options 20/50/100', async ({ page }) => {
  await page.goto(base + 'weaknesses')

  const select = page.locator('select#gameCount')
  const options = select.locator('option')
  await expect(options).toHaveCount(3)
  await expect(options.nth(0)).toHaveValue('20')
  await expect(options.nth(1)).toHaveValue('50')
  await expect(options.nth(2)).toHaveValue('100')
})
