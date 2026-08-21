import { chromium } from 'playwright'
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto(`${BASE}/analyze`, { waitUntil: 'load' })
await page.waitForSelector('[data-testid="pgn-input"]')

const pgn = '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+'
await page.fill('[data-testid="pgn-input"]', pgn)
await page.click('button:has-text("Load PGN")')

// Wait for analysis
for (let i = 0; i < 90; i++) {
  if (!(await page.$('[data-testid="analyzing"]'))) break
  await sleep(1000)
}
await sleep(500)

// Scrub to ply 3 (after Nf3 — should have an arrow for the last move)
for (let i = 0; i < 3; i++) {
  await page.click('button:has-text("▶")')
  await sleep(100)
}
await sleep(500)

// Screenshot
await page.screenshot({ path: '.pi/acceptance/swarm2/screenshots/user-arrow-check.png' })

// Also get bounding rects of the board-arrows SVG and the move-list
const rects = await page.evaluate(() => {
  const arrows = document.querySelector('[data-testid="board-arrows"]')
  const moveList = document.querySelector('[data-testid="move-list"]')
  const board = document.querySelector('[data-testid="chess-board"]')
  return {
    arrows: arrows ? arrows.getBoundingClientRect() : null,
    moveList: moveList ? moveList.getBoundingClientRect() : null,
    board: board ? board.getBoundingClientRect() : null,
  }
})
console.log('Bounding rects:', JSON.stringify(rects, null, 2))

await browser.close()
