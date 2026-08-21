import { chromium } from 'playwright'
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const PGN = `[Event "Casual Game"]
[White "Paul Morphy"]
[Black "Duke Karl"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qxe5 15. Bd3 Nd7 16. Qf3 Bb4 17. Rd5 Qxd5 18. Bxd7 Qxd7 19. Qxd7+ Kxd7 20. Qd5+ Ke8 21. Qd7# 1-0`
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.locator('nav a', { hasText: 'Analyze' }).first().click()
await page.waitForTimeout(700)
await page.locator('[data-testid="pgn-input"]').fill(PGN)
await page.getByRole('button', { name: /Load PGN/i }).click()
await page.waitForTimeout(3000)
const err = await page.evaluate(() => document.querySelector('[data-testid="analyze-error"]')?.textContent?.trim())
const board = await page.locator('[data-testid="chess-board"]').count()
const moves = await page.evaluate(() => document.querySelector('[data-testid="move-list"]')?.textContent?.trim()?.slice(0,80))
console.log('RESULT err:', err, 'board:', board)
console.log('moves:', moves)
await browser.close()
