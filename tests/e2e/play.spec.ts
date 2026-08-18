import { test, expect } from '@playwright/test'

const base = '/test-coding-chess-advanced-2/'

test.describe('Play page', () => {
  test('page loads with board and controls', async ({ page }) => {
    await page.goto(base + 'play')

    await expect(page.getByTestId('chess-board')).toBeVisible()
    await expect(page.getByTestId('strength-select')).toBeVisible()
    await expect(page.getByTestId('side-white')).toBeVisible()
    await expect(page.getByTestId('side-black')).toBeVisible()
    await expect(page.getByTestId('new-game-btn')).toBeVisible()
    await expect(page.getByTestId('analyze-btn')).toBeVisible()
    await expect(page.getByTestId('play-status')).toContainText('Your move')
  })

  test('can select and move a piece (e2e4)', async ({ page }) => {
    await page.goto(base + 'play')

    await page.locator('[data-square="e2"]').click()
    await page.locator('[data-square="e4"]').click()

    await expect(page.getByTestId('move-list')).toContainText('e4')

    // Wait for engine to reply
    await page.waitForTimeout(3000)

    const moveListText = await page.getByTestId('move-list').textContent()
    expect(moveListText).toBeTruthy()
    expect(moveListText!.length).toBeGreaterThan(10)
  })

  test('can change difficulty', async ({ page }) => {
    await page.goto(base + 'play')

    const select = page.getByTestId('strength-select')
    await select.selectOption('Expert')
    await expect(select).toHaveValue('Expert')

    await select.selectOption('Easy')
    await expect(select).toHaveValue('Easy')
  })

  test('can switch sides to black', async ({ page }) => {
    await page.goto(base + 'play')

    await page.getByTestId('side-black').click()

    await page.waitForTimeout(500)
    const status = await page.getByTestId('play-status').textContent()
    expect(status).toMatch(/Stockfish|thinking|move/i)
  })

  test('new game resets the board', async ({ page }) => {
    await page.goto(base + 'play')

    await page.locator('[data-square="e2"]').click()
    await page.locator('[data-square="e4"]').click()
    await page.waitForTimeout(2000)

    expect(await page.getByTestId('move-list').textContent()).not.toContain('No moves yet')

    await page.getByTestId('new-game-btn').click()

    await expect(page.getByTestId('move-list')).toContainText('No moves yet')
  })

  test('take-back button is disabled with no moves', async ({ page }) => {
    await page.goto(base + 'play')

    const takebackBtn = page.getByTestId('takeback-btn')
    await expect(takebackBtn).toBeDisabled()
  })

  test('analyze button navigates to /analyze', async ({ page }) => {
    await page.goto(base + 'play')

    await page.locator('[data-square="e2"]').click()
    await page.locator('[data-square="e4"]').click()
    await page.waitForTimeout(2000)

    await page.getByTestId('analyze-btn').click()

    await expect(page).toHaveURL(new RegExp(`${base}analyze`))
  })

  test('resign button ends the game', async ({ page }) => {
    await page.goto(base + 'play')

    await page.locator('[data-square="e2"]').click()
    await page.locator('[data-square="e4"]').click()
    await page.waitForTimeout(2000)

    await page.getByTestId('resign-btn').click()

    const status = await page.getByTestId('play-status').textContent()
    expect(status).toMatch(/resign|win/i)
  })
})
