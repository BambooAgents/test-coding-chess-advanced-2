import { test, expect } from '@playwright/test'

const base = '/test-coding-chess-advanced-2/'

test('home page loads and shows feature cards', async ({ page }) => {
  await page.goto(base)

  // Hero title
  await expect(page.locator('h1')).toContainText('Chess Advanced')

  // All four card titles should be visible (cards have h2 titles)
  const cardTitles = page.locator('.card__title, h2')
  await expect(cardTitles.filter({ hasText: 'Play' })).toBeVisible()
  await expect(cardTitles.filter({ hasText: 'Analyze' })).toBeVisible()
  await expect(cardTitles.filter({ hasText: 'Puzzles' })).toBeVisible()
  await expect(cardTitles.filter({ hasText: 'My Weaknesses' })).toBeVisible()
})

test('top nav is present and navigates to Play page', async ({ page }) => {
  await page.goto(base)

  // Click the nav Play link (in the header nav)
  await page.locator('nav a[href$="/play"]').click()

  // Should be on the Play page
  await expect(page).toHaveURL(/.*\/play$/)
  await expect(page.locator('h2')).toContainText('Play')
})

test('can navigate to each page via nav', async ({ page }) => {
  await page.goto(base)

  // Analyze
  await page.locator('nav a[href$="/analyze"]').click()
  await expect(page).toHaveURL(/.*\/analyze$/)

  // Puzzles
  await page.locator('nav a[href$="/puzzles"]').click()
  await expect(page).toHaveURL(/.*\/puzzles$/)

  // Weaknesses
  await page.locator('nav a[href$="/weaknesses"]').click()
  await expect(page).toHaveURL(/.*\/weaknesses$/)

  // Home (nav link with exact href matching base)
  await page.locator('nav a').first().click()
  await expect(page).toHaveURL(/.*\/$/)
})
