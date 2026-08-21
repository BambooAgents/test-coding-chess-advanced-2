import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const SHOT_DIR = resolve('.pi/acceptance/swarm4/screenshots')
const PROBE_DIR = resolve('.pi/acceptance/swarm4/probes')
const PGN = `[Event "Ruy Lopez Closed"]
[White "A"]
[Black "B"]
[Result "*"]
[Opening "Ruy Lopez"]
1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 Bb7 12. Bc2 Re8 13. a4 c5 14. b4 c4 15. Bb3 Qc7 16. Nf1 Rac8 17. Ng3 g6 18. d5 *`
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.locator('nav a', { hasText: 'Analyze' }).first().click()
await page.waitForTimeout(600)
await page.locator('[data-testid="pgn-input"]').fill(PGN)
await page.getByRole('button', { name: /Load PGN/i }).click()
await page.locator('[data-testid="chess-board"]').first().waitFor({ state: 'visible', timeout: 10000 })
// wait for analysis
const start = Date.now()
while (Date.now()-start < 90000) {
  if ((await page.locator('[data-testid="analyzing"]').count())===0) break
  await page.waitForTimeout(1500)
}
await page.waitForTimeout(400)
const probe = await page.evaluate(() => {
  const ml = document.querySelector('[data-testid="move-list"]')
  const board = document.querySelector('[data-testid="chess-board"]')
  const cs = getComputedStyle(ml)
  const mlr = ml.getBoundingClientRect()
  const bdr = board.getBoundingClientRect()
  // All move rows (children with data-ply) — check horizontal containment & overlap with board
  const rows = Array.from(ml.querySelectorAll('[data-ply]')).map(el => {
    const r = el.getBoundingClientRect()
    return { ply: el.getAttribute('data-ply'), x: r.x, y: r.y, w: r.width, right: r.right }
  })
  // check if any move content is horizontally within board x-range (overlap)
  const overlapBoardX = rows.some(r => r.x < bdr.right && r.right > bdr.x)
  // badges
  const badges = Array.from(ml.querySelectorAll('*')).filter(el => {
    const t = el.textContent?.trim() ?? ''
    return ['??','‼','?!','?','!','✓','☆','★','!?'].includes(t)
  }).map(el => {
    const r = el.getBoundingClientRect()
    return { text: el.textContent.trim(), x: r.x, right: r.right,
      inColumn: r.x >= mlr.x && r.right <= mlr.right }
  })
  return {
    moveListOverflow: cs.overflow, moveListOverflowY: cs.overflowY,
    moveListMaxHeight: cs.maxHeight, moveListHeight: cs.height,
    moveList: {x:mlr.x,y:mlr.y,w:mlr.width,h:mlr.height,right:mlr.right,bottom:mlr.bottom},
    board: {x:bdr.x,y:bdr.y,w:bdr.width,h:bdr.height,right:bdr.right,bottom:bdr.bottom},
    rowCount: rows.length,
    overlapBoardX,
    badgesInColumn: badges.every(b=>b.inColumn),
    badgeCount: badges.length,
    badgeXs: badges.map(b=>b.x),
  }
})
writeFileSync(resolve(PROBE_DIR, 'step5-movelist-style.json'), JSON.stringify(probe, null, 2))
console.log(JSON.stringify(probe, null, 2))
await browser.close()
