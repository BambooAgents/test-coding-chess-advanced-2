import { test, expect } from '@playwright/test'

/**
 * Analyze page e2e.
 *
 * NOTE: full engine analysis requires Stockfish-WASM which is slow/flaky in CI.
 * These tests cover the UI shell (PGN load, scrubber, move list, eval bar)
 * which renders immediately from the PGN before analysis completes.
 */

const SAMPLE_PGN = `[Event "Test"]
[White "A"]
[Black "B"]
[Result "*"]
[Opening "Ruy Lopez"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 *
`

test('loads a pasted PGN and shows the board + move list', async ({ page }) => {
  await page.goto('analyze')

  // Paste PGN and load.
  await page.locator('[data-testid="pgn-input"]').fill(SAMPLE_PGN)
  await page.locator('button:has-text("Load PGN")').click()

  // The opening name should appear (scope to avoid matching the PGN textarea).
  await expect(page.getByText('Ruy Lopez', { exact: true })).toBeVisible({ timeout: 10_000 })

  // The board renders (chess-board test id from the ChessBoard component).
  await expect(page.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10_000 })

  // The move list shows the first SAN moves.
  await expect(page.locator('[data-testid="move-list"]')).toBeVisible()
  await expect(page.locator('[data-testid="move-list"]')).toContainText('e4')
  await expect(page.locator('[data-testid="move-list"]')).toContainText('Nf3')
})

test('scrubber navigates forward and back through moves', async ({ page }) => {
  await page.goto('analyze')
  await page.locator('[data-testid="pgn-input"]').fill(SAMPLE_PGN)
  await page.locator('button:has-text("Load PGN")').click()
  await expect(page.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10_000 })

  // Scrubber shows 0 / 7 initially (7 half-moves in the PGN).
  await expect(page.locator('[data-testid="scrubber"]')).toContainText('0 / 7')

  // Forward.
  await page.locator('[data-testid="scrubber"] button:has-text("▶")').click()
  await expect(page.locator('[data-testid="scrubber"]')).toContainText('1 / 7')
  await page.locator('[data-testid="scrubber"] button:has-text("▶")').click()
  await page.locator('[data-testid="scrubber"] button:has-text("▶")').click()
  await expect(page.locator('[data-testid="scrubber"]')).toContainText('3 / 7')

  // Back.
  await page.locator('[data-testid="scrubber"] button:has-text("◀")').click()
  await expect(page.locator('[data-testid="scrubber"]')).toContainText('2 / 7')

  // First.
  await page.locator('[data-testid="scrubber"] button:has-text("⏮")').click()
  await expect(page.locator('[data-testid="scrubber"]')).toContainText('0 / 7')

  // Last.
  await page.locator('[data-testid="scrubber"] button:has-text("⏭")').click()
  await expect(page.locator('[data-testid="scrubber"]')).toContainText('7 / 7')
})

test('eval bar renders after a PGN is loaded', async ({ page }) => {
  await page.goto('analyze')
  await page.locator('[data-testid="pgn-input"]').fill(SAMPLE_PGN)
  await page.locator('button:has-text("Load PGN")').click()
  await expect(page.locator('[data-testid="eval-bar"]')).toBeVisible({ timeout: 10_000 })
})

test('clicking a move in the list scrubs to that move', async ({ page }) => {
  await page.goto('analyze')
  await page.locator('[data-testid="pgn-input"]').fill(SAMPLE_PGN)
  await page.locator('button:has-text("Load PGN")').click()
  await expect(page.locator('[data-testid="move-list"]')).toBeVisible({ timeout: 10_000 })

  // Click a later move row (Nf3 is ply 2).
  const nf3Row = page.locator('[data-testid="move-list"] button:has-text("Nf3")').first()
  await nf3Row.click()
  await expect(page.locator('[data-testid="scrubber"]')).toContainText(/2 \/ 7|3 \/ 7/)
})

test('handoff via ?pgn= query param loads the game', async ({ page }) => {
  const pgn = encodeURIComponent(SAMPLE_PGN)
  await page.goto(`analyze?pgn=${pgn}`)
  await expect(page.locator('[data-testid="chess-board"]')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Ruy Lopez', { exact: true })).toBeVisible({ timeout: 10_000 })
})
