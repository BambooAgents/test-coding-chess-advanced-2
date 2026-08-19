import { test, expect } from '@playwright/test'

/**
 * Puzzle Rush + Death-Match e2e (#18).
 * Covers the mode selector, start, and the mode stats panels.
 * Solving puzzles requires board interaction + the puzzle bundle; we test
 * the mode UI shell (start button → stats render → timer ticks).
 */

test.describe('Puzzles page — Rush mode', () => {
  test('rush mode shows a start button and starts the timer on click', async ({ page }) => {
    await page.goto('puzzles')

    // Switch to rush mode.
    await page.locator('[data-testid="mode-rush"]').click()

    // The rush panel appears with a start button.
    await expect(page.locator('[data-testid="rush-panel"]')).toBeVisible()
    await expect(page.locator('[data-testid="start-rush"]')).toBeVisible()

    // Start the rush.
    await page.locator('[data-testid="start-rush"]').click()

    // The timer, score, and wrong stats should appear.
    await expect(page.locator('[data-testid="rush-time"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid="rush-score"]')).toHaveText('0')
    await expect(page.locator('[data-testid="rush-wrong"]')).toHaveText('0/3')

    // The board should be present (a puzzle loaded).
    await expect(page.locator('[data-testid="chess-board"]')).toBeVisible()
  })

  test('rush timer counts down', async ({ page }) => {
    await page.goto('puzzles')
    await page.locator('[data-testid="mode-rush"]').click()
    await page.locator('[data-testid="start-rush"]').click()
    await expect(page.locator('[data-testid="rush-time"]')).toBeVisible({ timeout: 10_000 })

    // Capture the initial time text.
    const initial = await page.locator('[data-testid="rush-time"]').textContent()
    expect(initial).toContain('3:00')

    // Wait ~3 seconds and verify the timer decreased.
    await page.waitForTimeout(3500)
    const later = await page.locator('[data-testid="rush-time"]').textContent()
    // The timer should be at or below 2:58 (allow slack for timing).
    expect(later).not.toBe('3:00')
  })
})

test.describe('Puzzles page — Death Match mode', () => {
  test('death match mode shows a start button and stats on click', async ({ page }) => {
    await page.goto('puzzles')

    await page.locator('[data-testid="mode-deathmatch"]').click()

    await expect(page.locator('[data-testid="deathmatch-panel"]')).toBeVisible()
    await expect(page.locator('[data-testid="start-dm"]')).toBeVisible()

    await page.locator('[data-testid="start-dm"]').click()

    // Lives, score, and in-a-row should appear.
    await expect(page.locator('[data-testid="dm-lives"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid="dm-score"]')).toHaveText('0')
    await expect(page.locator('[data-testid="dm-streak"]')).toHaveText('0')

    // 3 starting lives.
    await expect(page.locator('[data-testid="dm-lives"]')).toHaveText('❤❤❤')

    // The board should be present.
    await expect(page.locator('[data-testid="chess-board"]')).toBeVisible()
  })
})
