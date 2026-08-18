import { test, expect } from '@playwright/test'

const base = '/test-coding-chess-advanced-2/'

/**
 * Integration test proving Stockfish WASM loads and returns a best move.
 *
 * This runs in a real browser via Playwright where WebAssembly and Web
 * Workers are available. This satisfies issue #12's requirement:
 * "prove it loads and returns a best move for a FEN in a test".
 *
 * We navigate to a dedicated test HTML page (public/stockfish-test.html)
 * that imports the StockfishEngine via Vite's dev server, initialises the
 * engine, and writes the results to the DOM. This avoids the limitation
 * that page.evaluate callbacks can't use dynamic import() with Vite's
 * module resolution.
 */

test('Stockfish WASM loads and responds to uci with uciok', async ({ page }) => {
  await page.goto(base + 'stockfish-test.html')

  // Wait for the engine to initialise (status shows "uciok" or "error: ...")
  await expect(page.locator('#status')).toHaveText(/uciok|error/, { timeout: 30_000 })
  await expect(page.locator('#status')).toHaveText('uciok')
})

test('Stockfish WASM returns a legal best move for the starting position', async ({ page }) => {
  await page.goto(base + 'stockfish-test.html')

  // Wait for the best move to appear
  await expect(page.locator('#bestmove')).not.toBeEmpty({ timeout: 30_000 })
  const bestMove = await page.locator('#bestmove').textContent()

  // Best move should be a 4-5 character UCI move (e.g. "e2e4", "g1f3")
  expect(bestMove).toBeTruthy()
  expect(bestMove).not.toBe('(none)')
  expect(bestMove).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/)
})
