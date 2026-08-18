import { test, expect } from '@playwright/test'

const base = '/test-coding-chess-advanced-2/'

test.describe('Puzzles page', () => {
  test('renders the puzzles page with mode selector', async ({ page }) => {
    await page.goto(base + 'puzzles')

    await expect(page.getByText('🧩 Puzzles')).toBeVisible()
    await expect(page.getByText('Plain Puzzles')).toBeVisible()
    await expect(page.getByText('Themed Sets')).toBeVisible()
  })

  test('loads a puzzle and shows the board', async ({ page }) => {
    await page.goto(base + 'puzzles')

    // The board should be rendered — piece images are visible
    await expect(page.locator('img[alt="bK"], img[alt="wK"]').first()).toBeVisible({ timeout: 10_000 })

    // Stats bar should show
    await expect(page.getByText('Streak')).toBeVisible()
    await expect(page.getByText('Best', { exact: true })).toBeVisible()
    await expect(page.getByText('Solved')).toBeVisible()
  })

  test('can switch to themed sets and see theme selector', async ({ page }) => {
    await page.goto(base + 'puzzles')

    await page.getByText('Themed Sets').click()

    // Theme selector should appear with endgame and opening groups
    await expect(page.getByText('Endgame Sets')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Opening Sets')).toBeVisible()
    await expect(page.getByText('All Endgames')).toBeVisible()
  })

  test('can select an opening-themed set and load puzzles', async ({ page }) => {
    await page.goto(base + 'puzzles')

    await page.getByText('Themed Sets').click()

    // Wait for opening chips to appear, then click one
    const openingChip = page.locator('button', { hasText: /Lopez|Gambit|Sicilian|Italian|Queen/ }).first()
    await expect(openingChip).toBeVisible({ timeout: 5_000 })
    await openingChip.click()

    // A puzzle should load — piece images visible
    await expect(page.locator('img[alt="bK"], img[alt="wK"]').first()).toBeVisible({ timeout: 10_000 })
  })

  test('shows feedback area with "to move" instruction', async ({ page }) => {
    await page.goto(base + 'puzzles')

    // Should show either "White to move" or "Black to move"
    await expect(page.getByText(/to move/)).toBeVisible({ timeout: 10_000 })
  })
})
